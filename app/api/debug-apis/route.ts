import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Diagnostic: shows raw DataGolf API response structure for the first player
// in each feed so we can verify field names and value formats.
// DELETE this route after debugging is complete.
export async function GET() {
  const key = process.env.DATAGOLF_API_KEY;

  const [fieldRes, oddsRes, predsRes] = await Promise.all([
    fetch(`https://feeds.datagolf.com/field-updates?tour=pga&file_format=json&key=${key}`),
    fetch(`https://feeds.datagolf.com/betting-tools/outrights?tour=pga&market=win&odds_format=american&file_format=json&key=${key}`),
    fetch(`https://feeds.datagolf.com/preds/pre-tournament?tour=pga&file_format=json&key=${key}`),
  ]);

  const [fieldData, oddsData, predsData] = await Promise.all([
    fieldRes.json(),
    oddsRes.json(),
    predsRes.json(),
  ]);

  const firstFieldPlayer = (fieldData.field || [])[0] ?? null;
  const firstOddsPlayer  = (oddsData.odds || [])[0] ?? null;
  const firstPred        = (predsData.baseline || [])[0] ?? null;

  return NextResponse.json({
    field: {
      top_level_keys: fieldData ? Object.keys(fieldData) : null,
      sample_player: firstFieldPlayer,
    },
    odds: {
      top_level_keys: oddsData ? Object.keys(oddsData) : null,
      // Show first player fully so we can see the exact book field names and value types
      sample_player: firstOddsPlayer,
    },
    predictions: {
      top_level_keys: predsData ? Object.keys(predsData) : null,
      sample_baseline: firstPred,
    },
  });
}
