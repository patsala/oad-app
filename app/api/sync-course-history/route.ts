import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function parseFinish(finText: string | null | undefined): {
  position: number | null;
  made_cut: boolean;
  withdrew: boolean;
  finish_label: string;
} {
  if (!finText) return { position: null, made_cut: false, withdrew: false, finish_label: 'DNP' };

  const upper = finText.toUpperCase().trim();

  if (upper === 'WD') return { position: null, made_cut: false, withdrew: true, finish_label: 'WD' };
  if (upper === 'MC' || upper === 'DQ' || upper === 'MDF' || upper === 'DNF') {
    return { position: null, made_cut: false, withdrew: false, finish_label: upper };
  }

  const num = parseInt(upper.replace(/^T/, ''), 10);
  if (!isNaN(num)) {
    return { position: num, made_cut: true, withdrew: false, finish_label: upper };
  }

  return { position: null, made_cut: false, withdrew: false, finish_label: upper };
}

export async function POST() {
  try {
    // 1. Get the next upcoming tournament
    const tournaments = await query(
      `SELECT id, event_name, course_name FROM tournaments
       WHERE is_completed = false
       ORDER BY start_date ASC
       LIMIT 1`
    );

    if (!tournaments || tournaments.length === 0) {
      return NextResponse.json({ success: false, message: 'No upcoming tournament found' });
    }

    const tournament = tournaments[0];
    const eventId = Number(tournament.id);
    const currentYear = new Date().getFullYear();

    // 2. Fetch the full historical event list to find which years this event ran
    const eventListRes = await fetch(
      `https://feeds.datagolf.com/historical-event-data/event-list?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
    );
    if (!eventListRes.ok) {
      return NextResponse.json({ success: false, message: `event-list fetch failed: ${eventListRes.status}` }, { status: 500 });
    }
    const eventListData = await eventListRes.json();
    const allEvents: any[] = eventListData.events || eventListData || [];

    // Known name aliases for renamed tournaments (substring match on current event name)
    const TOURNAMENT_ALIASES: Record<string, string[]> = {
      'Cognizant Classic': ['Honda Classic'],
      'RBC Heritage': ['Heritage Classic', 'MCI Heritage'],
      'Travelers Championship': ['Buick Championship', 'Greater Hartford Open'],
      // Add more as needed
    };

    const aliasNames: string[] = Object.entries(TOURNAMENT_ALIASES)
      .filter(([key]) => tournament.event_name.includes(key))
      .flatMap(([, aliases]) => aliases);

    // 3. Build candidate years to try.
    //    The global event-list only covers recent seasons, so we combine:
    //    a) Matches from the event-list (by event_id or alias name)
    //    b) Direct probes for the last 7 years using the current event_id
    //       — DataGolf's historical events endpoint has data accessible by event_id+year
    //         even when the event-list doesn't include older seasons.
    const seenYears = new Set<number>();
    const candidatesFromList = allEvents
      .filter((e: any) => {
        const pastYear = e.calendar_year < currentYear;
        const matchById = Number(e.event_id) === eventId;
        const matchByAlias = aliasNames.some((alias: string) =>
          (e.event_name || '').toLowerCase().includes(alias.toLowerCase())
        );
        return pastYear && (matchById || matchByAlias);
      })
      .map((e: any) => ({ year: e.calendar_year, event_name: e.event_name, fetch_event_id: e.event_id }));

    // Direct probes for the last 7 years as fallback for any gaps
    const directProbes = Array.from({ length: 7 }, (_, i) => currentYear - 1 - i).map(year => ({
      year,
      event_name: tournament.event_name,
      fetch_event_id: eventId,
    }));

    // Merge: event-list entries take priority (correct names), fill gaps with direct probes
    const allCandidates = [...candidatesFromList, ...directProbes]
      .sort((a, b) => b.year - a.year)
      .filter(c => {
        if (seenYears.has(c.year)) return false;
        seenYears.add(c.year);
        return true;
      })
      .slice(0, 7);

    // 4. Fetch results in parallel; years with no data are silently dropped
    const yearResults = await Promise.all(
      allCandidates.map(async ({ year, event_name, fetch_event_id }) => {
        try {
          const res = await fetch(
            `https://feeds.datagolf.com/historical-event-data/events?tour=pga&event_id=${fetch_event_id}&year=${year}&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
          );
          if (!res.ok) return { year, event_name, players: [] };
          const data = await res.json();
          const players = data.event_stats || data.results || data.leaderboard || [];
          return { year, event_name, players };
        } catch {
          return { year, event_name, players: [] };
        }
      })
    );

    const yearsWithData = yearResults.filter(r => r.players.length > 0);

    // 5. Upsert individual course_history rows
    let totalInserted = 0;
    for (const { year, event_name, players } of yearsWithData) {
      for (const player of players) {
        const dgId = player.dg_id;
        if (!dgId) continue;

        const finText = player.fin_text ?? player.finish ?? String(player.position ?? '');
        const parsed = parseFinish(finText);
        const earnings = player.earnings ?? null;

        await query(
          `INSERT INTO course_history (
            dg_id, player_name, event_id, event_name, year,
            finish_position, finish_label, made_cut, withdrew, earnings
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (dg_id, event_id, year) DO UPDATE SET
            player_name = EXCLUDED.player_name,
            event_name = EXCLUDED.event_name,
            finish_position = EXCLUDED.finish_position,
            finish_label = EXCLUDED.finish_label,
            made_cut = EXCLUDED.made_cut,
            withdrew = EXCLUDED.withdrew,
            earnings = EXCLUDED.earnings`,
          [
            dgId,
            player.player_name || '',
            eventId,
            event_name,
            year,
            parsed.position,
            parsed.finish_label,
            parsed.made_cut,
            parsed.withdrew,
            earnings,
          ]
        );
        totalInserted++;
      }
    }

    // 6. Compute per-player aggregates and upsert into course_performance_summary
    const summaryRows = await query(
      `SELECT
         dg_id,
         MAX(player_name) AS player_name,
         COUNT(*)::int AS times_played,
         SUM(CASE WHEN made_cut THEN 1 ELSE 0 END)::int AS times_made_cut,
         ROUND(100.0 * SUM(CASE WHEN made_cut THEN 1 ELSE 0 END) / COUNT(*), 1) AS cut_percentage,
         ROUND(AVG(CASE WHEN finish_position IS NOT NULL THEN finish_position END)::numeric, 1) AS average_finish,
         MIN(finish_position) AS best_finish
       FROM course_history
       WHERE event_id = $1
       GROUP BY dg_id`,
      [eventId]
    );

    const eventNameForSummary = yearsWithData[0]?.event_name || tournament.event_name;

    for (const row of summaryRows) {
      await query(
        `INSERT INTO course_performance_summary (
           dg_id, player_name, event_id, event_name,
           times_played, times_made_cut, cut_percentage, average_finish, best_finish,
           last_updated
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (dg_id, event_id) DO UPDATE SET
           player_name = EXCLUDED.player_name,
           event_name = EXCLUDED.event_name,
           times_played = EXCLUDED.times_played,
           times_made_cut = EXCLUDED.times_made_cut,
           cut_percentage = EXCLUDED.cut_percentage,
           average_finish = EXCLUDED.average_finish,
           best_finish = EXCLUDED.best_finish,
           last_updated = NOW()`,
        [
          row.dg_id,
          row.player_name,
          eventId,
          eventNameForSummary,
          row.times_played,
          row.times_made_cut,
          row.cut_percentage,
          row.average_finish,
          row.best_finish,
        ]
      );
    }

    return NextResponse.json({
      success: true,
      event_name: tournament.event_name,
      event_id: eventId,
      years_fetched: yearsWithData.map(r => ({ year: r.year, players: r.players.length })),
      history_rows_upserted: totalInserted,
      players_in_summary: summaryRows.length,
    });
  } catch (error) {
    console.error('sync-course-history error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
