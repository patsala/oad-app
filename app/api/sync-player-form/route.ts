import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Debug: probe the historical API against the most recent 2025 event to verify it works
export async function GET() {
  try {
    const schedRes = await fetch(
      `https://feeds.datagolf.com/get-schedule?tour=pga&season=2025&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
    );
    if (!schedRes.ok) return NextResponse.json({ error: `Schedule fetch failed: ${schedRes.status}` });
    const schedData = await schedRes.json();

    const today = new Date().toISOString().split('T')[0];
    const completed2025 = (schedData.schedule || [])
      .filter((e: any) => e.start_date && e.start_date < today)
      .sort((a: any, b: any) => b.start_date.localeCompare(a.start_date));

    if (completed2025.length === 0) {
      return NextResponse.json({ message: 'No completed 2025 events found' });
    }

    const sample2025 = completed2025[0];
    const url = `https://feeds.datagolf.com/historical-raw-data/event-level?tour=pga&season=2025&event_id=${sample2025.event_id}&file_format=json&key=${process.env.DATAGOLF_API_KEY}`;
    const res = await fetch(url);
    const rawText = await res.text();

    let parsed: any = null;
    let parseError: string | null = null;
    try { parsed = JSON.parse(rawText); } catch (e) { parseError = String(e); }

    return NextResponse.json({
      probing_event: sample2025.event_name,
      event_id: sample2025.event_id,
      http_status: res.status,
      content_type: res.headers.get('content-type'),
      parse_error: parseError,
      top_level_keys: parsed ? Object.keys(parsed) : null,
      sample_player: parsed ? (parsed.results || parsed.scores || parsed.leaderboard || parsed.players || [])[0] ?? null : null,
      raw_preview: parsed ? null : rawText.slice(0, 500),
      total_2025_completed: completed2025.length,
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

async function fetchEventResults(
  eventId: string | number,
  season: number,
  eventName: string,
  endDate: string
): Promise<{ event_name: string; end_date: string; results: any[] }> {
  try {
    const res = await fetch(
      `https://feeds.datagolf.com/historical-raw-data/event-level?tour=pga&season=${season}&event_id=${eventId}&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
    );
    if (!res.ok) return { event_name: eventName, end_date: endDate, results: [] };
    const data = await res.json();
    const players = data.results || data.scores || data.leaderboard || data.players || [];
    return { event_name: eventName, end_date: endDate, results: players };
  } catch {
    return { event_name: eventName, end_date: endDate, results: [] };
  }
}

export async function POST() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Get 2026 completed events from our DB
    const completed2026 = await query(
      `SELECT id, event_name, end_date FROM tournaments WHERE is_completed = true ORDER BY end_date DESC LIMIT 10`
    );

    // 2. Fetch 2025 schedule from DataGolf to fill out the last-5 window
    let events2025: { event_id: string; event_name: string; end_date: string }[] = [];
    try {
      const schedRes = await fetch(
        `https://feeds.datagolf.com/get-schedule?tour=pga&season=2025&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
      );
      if (schedRes.ok) {
        const schedData = await schedRes.json();
        // Filter to completed PGA Tour events, sort most recent first
        events2025 = (schedData.schedule || [])
          .filter((e: any) => e.start_date && e.start_date < today && e.event_id)
          .sort((a: any, b: any) => b.start_date.localeCompare(a.start_date))
          .slice(0, 10)
          .map((e: any) => ({
            event_id: e.event_id,
            event_name: e.event_name,
            // Approximate end date (start + 3 days)
            end_date: (() => {
              const d = new Date(e.start_date);
              d.setDate(d.getDate() + 3);
              return d.toISOString().split('T')[0];
            })(),
          }));
      }
    } catch {
      // 2025 schedule unavailable — continue with whatever 2026 data we have
    }

    // 3. Fetch results for all events in parallel
    const [results2026, results2025] = await Promise.all([
      Promise.all(
        completed2026.map((t: any) => fetchEventResults(t.id, 2026, t.event_name, t.end_date))
      ),
      Promise.all(
        events2025.map(e => fetchEventResults(e.event_id, 2025, e.event_name, e.end_date))
      ),
    ]);

    // 4. Merge all event results, sorted most recent first
    // 2026 events are more recent than 2025 events
    const allEventResults = [
      ...results2026.filter(e => e.results.length > 0),
      ...results2025.filter(e => e.results.length > 0),
    ];

    const debug = {
      events_2026_fetched: completed2026.length,
      events_2026_with_data: results2026.filter(e => e.results.length > 0).length,
      events_2025_fetched: events2025.length,
      events_2025_with_data: results2025.filter(e => e.results.length > 0).length,
      events_by_name: allEventResults.map(e => ({ event: e.event_name, players: e.results.length })),
    };

    if (allEventResults.length === 0) {
      return NextResponse.json({
        success: true,
        updated: 0,
        message: 'No historical data available from DataGolf yet',
        debug,
      });
    }

    // 5. Build per-player map: dg_id → all results sorted most recent first
    const playerResultsMap = new Map<number, {
      event_name: string;
      end_date: string;
      finish_label: string;
      position: number | null;
      made_cut: boolean;
      withdrew: boolean;
    }[]>();

    // Keep track of raw results for player name lookup
    const allRawResults: any[] = allEventResults.flatMap(e => e.results);

    for (const { event_name, end_date, results } of allEventResults) {
      for (const r of results) {
        const dgId = r.dg_id;
        if (!dgId) continue;

        const parsed = parseFinish(r.fin_text);

        if (!playerResultsMap.has(dgId)) playerResultsMap.set(dgId, []);
        playerResultsMap.get(dgId)!.push({
          event_name,
          end_date,
          ...parsed,
        });
      }
    }

    // 6. Compute form for each player and upsert
    let updated = 0;

    for (const [dgId, allResults] of playerResultsMap) {
      // Results are already ordered most-recent-first (2026 before 2025)
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

      const playerRow = allRawResults.find((r: any) => r.dg_id === dgId);
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
      message: `Updated form for ${updated} players`,
      debug,
    });

  } catch (error) {
    console.error('Sync player form error:', error);
    return NextResponse.json(
      { error: 'Failed to sync player form', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
