import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export async function GET() {
  try {
    // Compute standings live from picks + tournaments so they always reflect
    // the current state without depending on a separately maintained table.
    const [segmentRows, seasonRow] = await Promise.all([
      // Per-segment totals
      query(`
        SELECT
          t.segment,
          COALESCE(SUM(p.earnings), 0)::numeric          AS total_earnings,
          COUNT(CASE WHEN p.finish_position IS NOT NULL THEN 1 END)::int AS events_completed,
          MIN(CASE WHEN p.finish_position IS NOT NULL THEN p.finish_position END) AS best_finish
        FROM picks p
        JOIN tournaments t ON p.tournament_id = t.id
        GROUP BY t.segment
        ORDER BY t.segment ASC
      `),
      // Season total across all picks
      query(`SELECT COALESCE(SUM(earnings), 0)::numeric AS season_total FROM picks`),
    ]);

    // Bonus data is optional — don't let a missing table fail the whole endpoint
    let bonusRows: any[] = [];
    try {
      bonusRows = await query(`SELECT segment, segment_winner_bonus FROM segment_standings`);
    } catch {
      // segment_standings table may not exist yet
    }

    const seasonTotal = Number(seasonRow[0]?.season_total ?? 0);
    const bonusMap = new Map(bonusRows.map((r: any) => [r.segment, r.segment_winner_bonus]));

    const standings = segmentRows.map((row: any) => ({
      segment: row.segment,
      total_earnings: Number(row.total_earnings),
      season_total_earnings: seasonTotal,
      events_completed: Number(row.events_completed),
      best_finish: row.best_finish ? Number(row.best_finish) : null,
      segment_winner_bonus: bonusMap.get(row.segment) ?? 0,
    }));

    return NextResponse.json({ standings });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 });
  }
}