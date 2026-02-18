import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const endpoints = [
      {
        name: 'player-skill-decompositions',
        url: `https://feeds.datagolf.com/preds/player-decompositions?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`,
        description: 'Detailed breakdown of strokes-gained prediction by skill'
      },
      {
        name: 'player-skill-ratings',
        url: `https://feeds.datagolf.com/preds/skill-ratings?file_format=json&key=${process.env.DATAGOLF_API_KEY}`,
        description: 'Skill estimates and ranks for all players'
      },
      {
        name: 'detailed-approach-skill',
        url: `https://feeds.datagolf.com/preds/approach-skill?period=l24&file_format=json&key=${process.env.DATAGOLF_API_KEY}`,
        description: 'Approach performance stats across yardage/lie buckets'
      },
      {
        name: 'historical-event-list',
        url: `https://feeds.datagolf.com/historical-raw-data/event-list?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`,
        description: 'List of tournaments and IDs for historical data'
      },
      {
        name: 'round-scoring-strokes-gained',
        url: `https://feeds.datagolf.com/historical-raw-data/rounds?tour=pga&event_id=7&year=2025&file_format=json&key=${process.env.DATAGOLF_API_KEY}`,
        description: 'Round-level scoring, stats, and strokes-gained (testing with event_id=7, year=2025)'
      }
    ];

    const results: any = {};

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url);
        const text = await response.text();
        
        if (text.startsWith('<!') || text.startsWith('<')) {
          results[endpoint.name] = {
            description: endpoint.description,
            status: 'error',
            error: 'HTML response - check endpoint or auth'
          };
          continue;
        }
        
        const data = JSON.parse(text);
        
        results[endpoint.name] = {
          description: endpoint.description,
          status: 'success',
          structure: {
            type: Array.isArray(data) ? 'array' : 'object',
            keys: Object.keys(data).slice(0, 10),
            sample: Array.isArray(data) 
              ? data.slice(0, 2)
              : Object.keys(data).slice(0, 5).reduce((obj: any, key) => {
                  const val = data[key];
                  obj[key] = Array.isArray(val) ? val.slice(0, 2) : val;
                  return obj;
                }, {})
          }
        };
      } catch (error) {
        results[endpoint.name] = {
          description: endpoint.description,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown'
        };
      }
    }

    return NextResponse.json(results);

  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}