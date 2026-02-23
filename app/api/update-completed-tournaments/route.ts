import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  try {
    // Find tournaments whose end_date has passed but aren't marked complete
    const staleTournaments = await query(
      `SELECT id, event_name, event_id FROM tournaments
       WHERE end_date < CURRENT_DATE
       AND is_completed = false`
    );

    if (staleTournaments.length === 0) {
      return NextResponse.json({ success: true, message: 'All past tournaments already marked complete', updated: [] });
    }

    const updates: { tournament: string; winner: string | null }[] = [];

    for (const tournament of staleTournaments) {
      let winner: string | null = null;

      // Try fetching winner from DataGolf historical event-level data
      try {
        const histResponse = await fetch(
          `https://feeds.datagolf.com/historical-raw-data/event-level?tour=pga&event_id=${tournament.id}&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
        );

        if (histResponse.ok) {
          const histData = await histResponse.json();
          const results: any[] = histData.results || histData.leaderboard || [];

          if (results.length > 0) {
            // Winner = position 1, or lowest finish position value
            const sorted = results
              .filter((r: any) => r.fin_text === '1' || r.position === 1 || r.position === '1')
              .slice(0, 1);

            if (sorted.length > 0) {
              const raw = sorted[0].player_name || sorted[0].name || null;
              // DataGolf returns "Last, First" — convert to "First Last"
              if (raw && raw.includes(',')) {
                const parts = raw.split(',').map((s: string) => s.trim());
                winner = parts.length === 2 ? `${parts[1]} ${parts[0]}` : raw;
              } else {
                winner = raw;
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Could not fetch historical data for ${tournament.event_name}:`, err);
      }

      // If historical data had no results, try the live field-updates endpoint
      // (works for the most recently completed tournament before DataGolf rolls over)
      if (!winner) {
        try {
          const fieldResponse = await fetch(
            `https://feeds.datagolf.com/field-updates?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
          );
          if (fieldResponse.ok) {
            const fieldData = await fieldResponse.json();
            // Match by event name (fuzzy: check if one contains the other)
            const nameMatch =
              fieldData.event_name &&
              (fieldData.event_name.toLowerCase().includes(tournament.event_name.toLowerCase().split(' ')[0]) ||
                tournament.event_name.toLowerCase().includes(fieldData.event_name.toLowerCase().split(' ')[0]));

            if (nameMatch && Array.isArray(fieldData.field)) {
              const sorted = [...fieldData.field].sort(
                (a: any, b: any) => (a.total_strokes || 999) - (b.total_strokes || 999)
              );
              if (sorted[0]?.player_name) {
                const raw = sorted[0].player_name;
                if (raw.includes(',')) {
                  const parts = raw.split(',').map((s: string) => s.trim());
                  winner = parts.length === 2 ? `${parts[1]} ${parts[0]}` : raw;
                } else {
                  winner = raw;
                }
              }
            }
          }
        } catch (err) {
          console.warn(`Could not fetch field data for ${tournament.event_name}:`, err);
        }
      }

      // Mark as completed (with or without winner)
      await query(
        `UPDATE tournaments
         SET is_completed = true,
             winner = COALESCE($1, winner)
         WHERE id = $2`,
        [winner, tournament.id]
      );

      updates.push({ tournament: tournament.event_name, winner });
    }

    return NextResponse.json({
      success: true,
      updated: updates,
      message: `Marked ${updates.length} tournament(s) as completed`,
    });
  } catch (error) {
    console.error('Auto-update error:', error);
    return NextResponse.json(
      { error: 'Failed to update tournaments', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
