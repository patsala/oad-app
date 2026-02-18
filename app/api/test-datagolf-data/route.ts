import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const endpoints = [
      {
        name: 'skill-decompositions',
        url: `https://feeds.datagolf.com/preds/skill-decompositions?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`,
        description: 'Player skills: driving, approach, short game, putting'
      },
      {
        name: 'player-list',
        url: `https://feeds.datagolf.com/get-player-list?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`,
        description: 'All players with IDs'
      },
      {
        name: 'historical-event-results',
        url: `https://feeds.datagolf.com/historical-dg-event-results?tour=pga&event_id=7&file_format=json&key=${process.env.DATAGOLF_API_KEY}`,
        description: 'Event-specific historical finishes (event_id=7 for Genesis)'
      },
      {
        name: 'historical-raw-rounds',
        url: `https://feeds.datagolf.com/historical-raw-data/rounds?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`,
        description: 'Round-by-round scoring and stats'
      },
      {
        name: 'pre-tournament-detailed',
        url: `https://feeds.datagolf.com/preds/pre-tournament?tour=pga&add_position=top_5,top_10,top_20,make_cut&file_format=json&key=${process.env.DATAGOLF_API_KEY}`,
        description: 'Pre-tournament predictions with all positions'
      }
    ];

    const results: any = {};

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url);
        const data = await response.json();
        
        results[endpoint.name] = {
          description: endpoint.description,
          status: 'success',
          structure: {
            type: Array.isArray(data) ? 'array' : 'object',
            keys: Object.keys(data),
            sample: Array.isArray(data) 
              ? data.slice(0, 2)  // First 2 items
              : Object.keys(data).slice(0, 5).reduce((obj: any, key) => {
                  obj[key] = Array.isArray(data[key]) 
                    ? data[key].slice(0, 2) 
                    : data[key];
                  return obj;
                }, {})
          }
        };
      } catch (error) {
        results[endpoint.name] = {
          description: endpoint.description,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return NextResponse.json(results, { 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}