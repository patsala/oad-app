import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const endpoints = [
      { name: 'skill-decompositions', url: `https://feeds.datagolf.com/preds/skill-decompositions?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}` },
      { name: 'pre-tournament', url: `https://feeds.datagolf.com/preds/pre-tournament?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}` },
      { name: 'player-stats', url: `https://feeds.datagolf.com/historical-raw-data/player-stats?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}` }
    ];
    
    const results: any = {};
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url);
        const data = await response.json();
        results[endpoint.name] = {
          type: Array.isArray(data) ? 'array' : 'object',
          keys: Object.keys(data),
          sample: Array.isArray(data) ? data[0] : Object.keys(data).reduce((obj: any, key) => {
            obj[key] = Array.isArray(data[key]) ? data[key][0] : data[key];
            return obj;
          }, {})
        };
      } catch (e) {
        results[endpoint.name] = { error: e instanceof Error ? e.message : 'Failed' };
      }
    }
    
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}