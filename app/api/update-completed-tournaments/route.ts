import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Diagnostic: returns current DB state for past tournaments without modifying anything
export async function GET() {
  try {
    const rows = await query(
      `SELECT id, event_name, end_date, is_completed, winner
       FROM tournaments
       WHERE end_date < CURRENT_DATE
       ORDER BY end_date ASC`
    );
    return NextResponse.json({ past_tournaments: rows });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST() {
  try {
    // First: ensure all past tournaments are marked is_completed regardless of winner status.
    // sync-tournaments may store is_completed=false if DataGolf's status string isn't exactly 'completed'.
    await query(
      `UPDATE tournaments SET is_completed = true WHERE end_date < CURRENT_DATE AND is_completed = false`
    );

    // Find tournaments whose end_date has passed and still have no winner (or malformed/placeholder winner).
    const staleTournaments = await query(
      `SELECT id, event_name, event_id FROM tournaments
       WHERE end_date < CURRENT_DATE
       AND (winner IS NULL OR winner = '' OR winner = 'TBD' OR winner LIKE '%,%' OR winner LIKE '%(%)%')`
    );

    if (staleTournaments.length === 0) {
      return NextResponse.json({ success: true, message: 'All past tournaments already have winners recorded', updated: [] });
    }

    // Fetch the full 2026 schedule once — it includes winner fields for completed events
    let scheduleByEventId: Map<string, string | null> = new Map();
    try {
      const schedRes = await fetch(
        `https://feeds.datagolf.com/get-schedule?tour=pga&season=2026&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
      );
      if (schedRes.ok) {
        const schedData = await schedRes.json();
        for (const event of schedData.schedule || []) {
          if (event.event_id && event.winner) {
            scheduleByEventId.set(String(event.event_id), event.winner);
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch schedule for winner lookup:', err);
    }

    function parseWinnerName(raw: string | null): string | null {
      if (!raw) return null;
      // Strip trailing " (dg_id)" e.g. "Morikawa, Collin (22085)" → "Morikawa, Collin"
      const stripped = raw.replace(/\s*\(\d+\)\s*$/, '').trim();
      // Flip "Last, First" → "First Last"
      if (stripped.includes(',')) {
        const parts = stripped.split(',').map((s: string) => s.trim());
        return parts.length === 2 ? `${parts[1]} ${parts[0]}` : stripped;
      }
      return stripped;
    }

    const updates: { tournament: string; winner: string | null; source: string }[] = [];

    for (const tournament of staleTournaments) {
      let winner: string | null = null;
      let source = 'none';

      // Source 1: DataGolf schedule API (updated in real-time after each event)
      const schedWinner = scheduleByEventId.get(String(tournament.id));
      if (schedWinner) {
        winner = parseWinnerName(schedWinner);
        source = 'schedule';
      }

      // Source 2: DataGolf historical event-level (may lag by a few days)
      if (!winner) {
        try {
          const histResponse = await fetch(
            `https://feeds.datagolf.com/historical-event-data/events?tour=pga&year=2026&event_id=${tournament.id}&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
          );
          if (histResponse.ok) {
            const histData = await histResponse.json();
            const results: any[] = histData.results || histData.leaderboard || [];
            const top = results.find(
              (r: any) => r.fin_text === '1' || r.position === 1 || r.position === '1'
            );
            if (top) {
              winner = parseWinnerName(top.player_name || top.name || null);
              if (winner) source = 'historical';
            }
          }
        } catch (err) {
          console.warn(`Could not fetch historical data for ${tournament.event_name}:`, err);
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

      updates.push({ tournament: tournament.event_name, winner, source });
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
