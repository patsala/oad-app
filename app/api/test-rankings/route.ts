import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(
      `https://feeds.datagolf.com/preds/get-dg-rankings?file_format=json&key=${process.env.DATAGOLF_API_KEY}`
    );
    
    const data = await response.json();
    
    // Return first 3 players to see structure
    return NextResponse.json({
      sample: data.rankings?.slice(0, 5),
      total: data.rankings?.length,
      first_player_keys: data.rankings?.[0] ? Object.keys(data.rankings[0]) : []
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}