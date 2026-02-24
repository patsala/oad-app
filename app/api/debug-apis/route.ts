import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Diagnostic endpoint — checks raw DataGolf API responses.
// DELETE this route after debugging is complete.
export async function GET(request: Request) {
  const key = process.env.DATAGOLF_API_KEY;
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'feeds';

  // mode=historical: inspect the historical-event-data/events response for a given event+year
  if (mode === 'historical') {
    const eventId = searchParams.get('event_id') || '10';
    const year = searchParams.get('year') || '2023';
    const res = await fetch(
      `https://feeds.datagolf.com/historical-event-data/events?tour=pga&event_id=${eventId}&year=${year}&file_format=json&key=${key}`
    );
    const status = res.status;
    const rawText = await res.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      return NextResponse.json({
        http_status: status,
        parse_error: true,
        raw_text_preview: rawText.slice(0, 1000),
      });
    }
    const topKeys = data ? Object.keys(data) : [];
    const firstEntry = Array.isArray(data) ? data[0] :
      (data.event_stats?.[0] ?? data.results?.[0] ?? data.leaderboard?.[0] ?? data[topKeys[0]]?.[0] ?? null);
    return NextResponse.json({
      http_status: status,
      top_level_keys: topKeys,
      is_array: Array.isArray(data),
      array_length: Array.isArray(data) ? data.length : null,
      sample_entry: firstEntry,
      // Show counts for any array-valued keys
      array_key_lengths: Object.fromEntries(
        topKeys.filter(k => Array.isArray(data[k])).map(k => [k, data[k].length])
      ),
    });
  }

  // mode=event_list: inspect a year-specific event list and find course-related fields
  if (mode === 'event_list') {
    const year = searchParams.get('year') || '2023';
    const res = await fetch(
      `https://feeds.datagolf.com/historical-event-data/event-list?tour=pga&year=${year}&file_format=json&key=${key}`
    );
    const data = await res.json();
    const events: any[] = data.events || data || [];
    return NextResponse.json({
      http_status: res.status,
      top_level_keys: data && !Array.isArray(data) ? Object.keys(data) : ['(array)'],
      total_events: events.length,
      sample_event: events[0] ?? null,
      honda_matches: events.filter((e: any) =>
        (e.event_name || '').toLowerCase().includes('honda')
      ),
    });
  }

  // default mode=feeds: original diagnostics
  const [fieldRes, oddsRes, predsRes] = await Promise.all([
    fetch(`https://feeds.datagolf.com/field-updates?tour=pga&file_format=json&key=${key}`),
    fetch(`https://feeds.datagolf.com/betting-tools/outrights?tour=pga&market=win&odds_format=american&file_format=json&key=${key}`),
    fetch(`https://feeds.datagolf.com/preds/pre-tournament?tour=pga&file_format=json&key=${key}`),
  ]);
  const [fieldData, oddsData, predsData] = await Promise.all([
    fieldRes.json(), oddsRes.json(), predsRes.json(),
  ]);
  return NextResponse.json({
    field:   { top_level_keys: Object.keys(fieldData), sample_player: (fieldData.field || [])[0] },
    odds:    { top_level_keys: Object.keys(oddsData),  sample_player: (oddsData.odds || [])[0] },
    predictions: { top_level_keys: Object.keys(predsData), sample_baseline: (predsData.baseline || [])[0] },
  });
}
