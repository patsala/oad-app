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

    // 2. Fetch the raw-data event list to find all past years for this event_id.
    //    historical-raw-data/event-list covers PGA Tour back to the 1980s, unlike
    //    historical-event-data/event-list which only covers recent seasons.
    const eventListRes = await fetch(
      `https://feeds.datagolf.com/historical-raw-data/event-list?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
    );
    if (!eventListRes.ok) {
      return NextResponse.json({ success: false, message: `event-list fetch failed: ${eventListRes.status}` }, { status: 500 });
    }
    const allEvents: any[] = await eventListRes.json();

    // 3. Find the last 7 past years this event_id was played
    const candidateYears = allEvents
      .filter((e: any) => Number(e.event_id) === eventId && e.calendar_year < currentYear)
      .sort((a: any, b: any) => b.calendar_year - a.calendar_year)
      .slice(0, 7)
      .map((e: any) => ({ year: e.calendar_year, event_name: e.event_name }));

    // 4. Fetch round data in parallel; years with no data are silently dropped.
    //    historical-raw-data/rounds returns { scores: [{dg_id, player_name, fin_text, ...}] }
    const yearResults = await Promise.all(
      candidateYears.map(async ({ year, event_name }: { year: number; event_name: string }) => {
        try {
          const res = await fetch(
            `https://feeds.datagolf.com/historical-raw-data/rounds?tour=pga&event_id=${eventId}&year=${year}&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
          );
          if (!res.ok) return { year, event_name, players: [] };
          const data = await res.json();
          const players = data.scores || [];
          return { year, event_name, players };
        } catch {
          return { year, event_name, players: [] };
        }
      })
    );

    const yearsWithData = yearResults.filter(r => r.players.length > 0);

    // 5. Collect all rows then bulk-upsert in a single query via unnest()
    const dgIds: number[] = [];
    const playerNames: string[] = [];
    const eventIds: number[] = [];
    const eventNames: string[] = [];
    const years: number[] = [];
    const positions: (number | null)[] = [];
    const labels: string[] = [];
    const madeCuts: boolean[] = [];
    const withdrews: boolean[] = [];
    const earnings: (string | null)[] = [];

    for (const { year, event_name, players } of yearsWithData) {
      for (const player of players) {
        if (!player.dg_id) continue;
        const finText = player.fin_text ?? player.finish ?? String(player.position ?? '');
        const parsed = parseFinish(finText);
        dgIds.push(player.dg_id);
        playerNames.push(player.player_name || '');
        eventIds.push(eventId);
        eventNames.push(event_name);
        years.push(year);
        positions.push(parsed.position);
        labels.push(parsed.finish_label);
        madeCuts.push(parsed.made_cut);
        withdrews.push(parsed.withdrew);
        earnings.push(player.earnings ?? null);
      }
    }

    const totalInserted = dgIds.length;
    if (totalInserted > 0) {
      await query(
        `INSERT INTO course_history
           (dg_id, player_name, event_id, event_name, year,
            finish_position, finish_label, made_cut, withdrew, earnings)
         SELECT * FROM unnest(
           $1::int[], $2::text[], $3::int[], $4::text[], $5::int[],
           $6::int[], $7::text[], $8::bool[], $9::bool[], $10::text[]
         ) AS t(dg_id, player_name, event_id, event_name, year,
                finish_position, finish_label, made_cut, withdrew, earnings)
         ON CONFLICT (dg_id, event_id, year) DO UPDATE SET
           player_name    = EXCLUDED.player_name,
           event_name     = EXCLUDED.event_name,
           finish_position = EXCLUDED.finish_position,
           finish_label   = EXCLUDED.finish_label,
           made_cut       = EXCLUDED.made_cut,
           withdrew       = EXCLUDED.withdrew,
           earnings       = EXCLUDED.earnings`,
        [dgIds, playerNames, eventIds, eventNames, years,
         positions, labels, madeCuts, withdrews, earnings]
      );
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

    if (summaryRows.length > 0) {
      await query(
        `INSERT INTO course_performance_summary
           (dg_id, player_name, event_id, event_name,
            times_played, times_made_cut, cut_percentage, average_finish, best_finish,
            last_updated)
         SELECT u.dg_id, u.player_name, u.event_id, u.event_name,
                u.times_played, u.times_made_cut, u.cut_percentage, u.average_finish, u.best_finish,
                NOW()
         FROM unnest(
           $1::int[], $2::text[], $3::int[], $4::text[],
           $5::int[], $6::int[], $7::numeric[], $8::numeric[], $9::int[]
         ) AS u(dg_id, player_name, event_id, event_name,
                times_played, times_made_cut, cut_percentage, average_finish, best_finish)
         ON CONFLICT (dg_id, event_id) DO UPDATE SET
           player_name    = EXCLUDED.player_name,
           event_name     = EXCLUDED.event_name,
           times_played   = EXCLUDED.times_played,
           times_made_cut = EXCLUDED.times_made_cut,
           cut_percentage = EXCLUDED.cut_percentage,
           average_finish = EXCLUDED.average_finish,
           best_finish    = EXCLUDED.best_finish,
           last_updated   = NOW()`,
        [
          summaryRows.map((r: any) => r.dg_id),
          summaryRows.map((r: any) => r.player_name),
          summaryRows.map(() => eventId),
          summaryRows.map(() => eventNameForSummary),
          summaryRows.map((r: any) => r.times_played),
          summaryRows.map((r: any) => r.times_made_cut),
          summaryRows.map((r: any) => r.cut_percentage),
          summaryRows.map((r: any) => r.average_finish),
          summaryRows.map((r: any) => r.best_finish),
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
