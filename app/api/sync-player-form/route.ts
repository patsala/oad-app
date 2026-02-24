import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

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

// Debug: show event-list so we can verify correct event IDs and structure
export async function GET() {
  try {
    const res = await fetch(
      `https://feeds.datagolf.com/historical-event-data/event-list?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
    );
    const rawText = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(rawText); } catch { /* not JSON */ }

    if (!parsed) {
      return NextResponse.json({ http_status: res.status, raw_preview: rawText.slice(0, 500) });
    }

    // Show the most recent 10 events so we can verify IDs and years
    const events: any[] = parsed.events || parsed || [];
    const sorted = [...events]
      .filter((e: any) => e.calendar_year >= 2025)
      .sort((a: any, b: any) => {
        const da = a.date || a.start_date || '';
        const db = b.date || b.start_date || '';
        return db.localeCompare(da);
      })
      .slice(0, 10);

    return NextResponse.json({
      http_status: res.status,
      top_level_keys: Object.keys(parsed),
      total_events: events.length,
      recent_events: sorted,
      sample_raw: events[0],
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST() {
  try {
    // Step 1: Fetch the event-list to get correct event IDs for the historical API
    const eventListRes = await fetch(
      `https://feeds.datagolf.com/historical-event-data/event-list?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
    );
    if (!eventListRes.ok) {
      return NextResponse.json({ error: `event-list fetch failed: ${eventListRes.status}` }, { status: 500 });
    }
    const eventListData = await eventListRes.json();
    const allHistoricalEvents: any[] = eventListData.events || eventListData || [];

    // Step 2: Filter to PGA Tour events from 2025 and 2026, sorted most recent first
    const today = new Date().toISOString().split('T')[0];
    const recentEvents = allHistoricalEvents
      .filter((e: any) => {
        const year = e.calendar_year || e.year;
        const date = e.date || e.start_date || '';
        return (year === 2025 || year === 2026) && date < today;
      })
      .sort((a: any, b: any) => {
        const da = a.date || a.start_date || '';
        const db = b.date || b.start_date || '';
        return db.localeCompare(da);
      })
      .slice(0, 12); // Fetch up to 12 recent events to get 5 results per player

    if (recentEvents.length === 0) {
      return NextResponse.json({ success: true, updated: 0, message: 'No recent events in historical event-list' });
    }

    // Step 3: Fetch results for all recent events in parallel
    const eventResults = await Promise.all(
      recentEvents.map(async (evt: any) => {
        const eventId = evt.event_id;
        const year = evt.calendar_year || evt.year;
        const eventName = evt.event_name || evt.name || `Event ${eventId}`;
        const endDate = evt.date || evt.start_date || '';

        try {
          const res = await fetch(
            `https://feeds.datagolf.com/historical-event-data/events?tour=pga&event_id=${eventId}&year=${year}&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
          );
          if (!res.ok) return { event_name: eventName, end_date: endDate, results: [] };
          const data = await res.json();
          // The endpoint returns event-level finishes — figure out the array field
          const players = data.event_stats || data.results || data.scores || data.leaderboard || [];
          return { event_name: eventName, end_date: endDate, results: players };
        } catch {
          return { event_name: eventName, end_date: endDate, results: [] };
        }
      })
    );

    const debug = {
      events_fetched: recentEvents.length,
      events_with_data: eventResults.filter(e => e.results.length > 0).length,
      events_by_name: eventResults.map(e => ({ event: e.event_name, players: e.results.length })),
    };

    const withData = eventResults.filter(e => e.results.length > 0);

    if (withData.length === 0) {
      // Return a sample of the raw response to debug field names
      const sampleRes = await fetch(
        `https://feeds.datagolf.com/historical-event-data/events?tour=pga&event_id=${recentEvents[0].event_id}&year=${recentEvents[0].calendar_year || recentEvents[0].year}&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
      );
      const sampleText = await sampleRes.text();
      let sampleParsed: any = null;
      try { sampleParsed = JSON.parse(sampleText); } catch { /* not JSON */ }
      return NextResponse.json({
        success: false,
        updated: 0,
        message: 'Events found but no player results returned',
        debug,
        sample_response_keys: sampleParsed ? Object.keys(sampleParsed) : null,
        sample_response_preview: sampleParsed ?? sampleText.slice(0, 300),
      });
    }

    // Step 4: Build per-player map: dg_id → all results sorted most recent first
    const playerResultsMap = new Map<number, {
      event_name: string;
      end_date: string;
      finish_label: string;
      position: number | null;
      made_cut: boolean;
      withdrew: boolean;
    }[]>();

    const allRawResults: any[] = withData.flatMap(e => e.results);

    for (const { event_name, end_date, results } of withData) {
      for (const r of results) {
        const dgId = r.dg_id;
        if (!dgId) continue;

        const finText = r.fin_text ?? r.finish ?? r.position_text ?? String(r.position ?? '');
        const parsed = parseFinish(finText);

        if (!playerResultsMap.has(dgId)) playerResultsMap.set(dgId, []);
        playerResultsMap.get(dgId)!.push({ event_name, end_date, ...parsed });
      }
    }

    // Step 5: Compute form and upsert
    let updated = 0;

    for (const [dgId, allResults] of playerResultsMap) {
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
