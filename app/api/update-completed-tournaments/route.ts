import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  try {
    // Find tournaments whose end_date has passed and still have no winner.
    // We intentionally include already-completed ones (winner IS NULL) because
    // current-tournament/route.ts auto-marks them is_completed=true on every
    // page load — before the winner fetch has a chance to run.
    const staleTournaments = await query(
      `SELECT id, event_name, event_id FROM tournaments
       WHERE end_date < CURRENT_DATE
       AND winner IS NULL`
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
      // DataGolf sometimes returns "Last, First" — convert to "First Last"
      if (raw.includes(',')) {
        const parts = raw.split(',').map((s: string) => s.trim());
        return parts.length === 2 ? `${parts[1]} ${parts[0]}` : raw;
      }
      return raw;
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
            `https://feeds.datagolf.com/historical-raw-data/event-level?tour=pga&season=2026&event_id=${tournament.id}&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
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
