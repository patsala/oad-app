import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [field, odds] = await Promise.all([
      fetch(`https://feeds.datagolf.com/field-updates?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`),
      fetch(`https://feeds.datagolf.com/betting-tools/outrights?tour=pga&market=win&odds_format=american&file_format=json&key=${process.env.DATAGOLF_API_KEY}`)
    ]);
    
    const fieldData = await field.json();
    const oddsData = await odds.json();
    
    return NextResponse.json({
      field_structure: Array.isArray(fieldData) ? 'array' : 'object',
      field_keys: Object.keys(fieldData),
      field_sample: Array.isArray(fieldData) ? fieldData[0] : fieldData,
      odds_structure: Array.isArray(oddsData) ? 'array' : 'object', 
      odds_keys: Object.keys(oddsData),
      odds_sample: oddsData
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown' }, { status: 500 });
  }
}