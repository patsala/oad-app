import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Debug: call GET to see the raw DataGolf API response for the most recent completed tournament
export async function GET() {
  try {
    const completed = await query(
      `SELECT id, event_name, end_date FROM tournaments WHERE is_completed = true ORDER BY end_date DESC LIMIT 1`
    );
    if (completed.length === 0) return NextResponse.json({ message: 'No completed tournaments' });

    const t = completed[0];
    const url = `https://feeds.datagolf.com/historical-raw-data/event-level?tour=pga&season=2026&event_id=${t.id}&file_format=json&key=${process.env.DATAGOLF_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    return NextResponse.json({
      tournament: t.event_name,
      event_id: t.id,
      status: res.status,
      top_level_keys: Object.keys(data),
      // Show first player from whichever array field exists
      sample: (data.results || data.scores || data.leaderboard || data.players || [])[0] || null,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// Parse fin_text like "1", "T15", "MC", "WD", "DQ", "MDF" into a numeric position or null
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
    return { position: null, made_cut: false, withdrew: false, finish_label: upper === 'MC' ? 'MC' : upper };
  }

  // "1", "2", "T3", "T45" etc.
  const num = parseInt(upper.replace(/^T/, ''), 10);
  if (!isNaN(num)) {
    return { position: num, made_cut: true, withdrew: false, finish_label: upper };
  }

  return { position: null, made_cut: false, withdrew: false, finish_label: upper };
}

function computeFormScore(results: { position: number | null; made_cut: boolean; withdrew: boolean }[]): number {
  let score = 50;
  for (const r of results) {
    if (r.withdrew) { score -= 15; continue; }
    if (!r.made_cut) { score -= 12; continue; }
    if (r.position !== null) {
      if (r.position <= 10) score += 15;
      else if (r.position <= 20) score += 8;
    }
  }
  return Math.max(0, Math.min(100, score));
}

function formCategory(score: number): string {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'steady';
  return 'cold';
}

export async function POST() {
  try {
    // Get last 10 completed tournaments (most recent first)
    const completedTournaments = await query(
      `SELECT id, event_name, end_date
       FROM tournaments
       WHERE is_completed = true
       ORDER BY end_date DESC
       LIMIT 10`
    );

    if (completedTournaments.length === 0) {
      return NextResponse.json({ success: true, message: 'No completed tournaments yet', updated: 0 });
    }

    // Fetch event-level results for each completed tournament in parallel
    const eventResults = await Promise.all(
      completedTournaments.map(async (t: any) => {
        try {
          const res = await fetch(
            `https://feeds.datagolf.com/historical-raw-data/event-level?tour=pga&season=2026&event_id=${t.id}&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
          );
          if (!res.ok) return { tournament: t, results: [] };
          const data = await res.json();
          const players = data.results || data.scores || data.leaderboard || data.players || [];
          return { tournament: t, results: players };
        } catch {
          return { tournament: t, results: [] };
        }
      })
    );

    // Build per-player map: dg_id → [results ordered most recent first]
    // completedTournaments is already DESC by end_date, so order is preserved
    const playerResultsMap = new Map<number, {
      event_name: string;
      end_date: string;
      finish_label: string;
      position: number | null;
      made_cut: boolean;
      withdrew: boolean;
    }[]>();

    for (const { tournament, results } of eventResults) {
      for (const r of results) {
        const dgId = r.dg_id;
        if (!dgId) continue;

        const parsed = parseFinish(r.fin_text);

        if (!playerResultsMap.has(dgId)) playerResultsMap.set(dgId, []);
        playerResultsMap.get(dgId)!.push({
          event_name: tournament.event_name,
          end_date: tournament.end_date,
          ...parsed,
        });
      }
    }

    // Compute form for each player and upsert
    let updated = 0;

    for (const [dgId, allResults] of playerResultsMap) {
      // Take most recent 5 (results are already ordered most recent first)
      const last5 = allResults.slice(0, 5);

      const top10 = last5.filter(r => r.position !== null && r.position <= 10).length;
      const top20 = last5.filter(r => r.position !== null && r.position <= 20).length;
      const mcs = last5.filter(r => !r.made_cut && !r.withdrew).length;
      const wds = last5.filter(r => r.withdrew).length;

      const finishPositions = last5.filter(r => r.position !== null).map(r => r.position as number);
      const avgFinish = finishPositions.length > 0
        ? finishPositions.reduce((a, b) => a + b, 0) / finishPositions.length
        : null;

      const score = computeFormScore(last5);
      const category = formCategory(score);

      const last5Json = JSON.stringify(last5.map(r => ({
        event_name: r.event_name,
        finish: r.finish_label,
        made_cut: r.made_cut,
        withdrew: r.withdrew,
      })));

      // Get player name from first result that has it
      const playerRow = eventResults
        .flatMap(e => e.results)
        .find((r: any) => r.dg_id === dgId);
      const playerName = playerRow?.player_name || '';

      await query(
        `INSERT INTO player_form (
          dg_id, player_name, last_5_results, last_5_avg_finish,
          top_10_last_5, top_20_last_5, missed_cuts_last_5, withdrawals_last_5,
          form_score, form_category, last_updated
        ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (dg_id) DO UPDATE SET
          player_name = EXCLUDED.player_name,
          last_5_results = EXCLUDED.last_5_results,
          last_5_avg_finish = EXCLUDED.last_5_avg_finish,
          top_10_last_5 = EXCLUDED.top_10_last_5,
          top_20_last_5 = EXCLUDED.top_20_last_5,
          missed_cuts_last_5 = EXCLUDED.missed_cuts_last_5,
          withdrawals_last_5 = EXCLUDED.withdrawals_last_5,
          form_score = EXCLUDED.form_score,
          form_category = EXCLUDED.form_category,
          last_updated = NOW()`,
        [dgId, playerName, last5Json, avgFinish, top10, top20, mcs, wds, score, category]
      );

      updated++;
    }

    return NextResponse.json({
      success: true,
      updated,
      tournaments_processed: completedTournaments.length,
      message: `Updated form for ${updated} players across ${completedTournaments.length} tournaments`,
      debug: eventResults.map(e => ({ event: e.tournament.event_name, players_found: e.results.length }))
    });

  } catch (error) {
    console.error('Sync player form error:', error);
    return NextResponse.json(
      { error: 'Failed to sync player form', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
