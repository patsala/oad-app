import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(
      `https://feeds.datagolf.com/get-schedule?tour=pga&season=2026&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
    );
    
    const data = await response.json();
    
    // Return first 3 events to see structure
    return NextResponse.json({
      sample: data.schedule?.slice(0, 3),
      total: data.schedule?.length,
      first_event_keys: data.schedule?.[0] ? Object.keys(data.schedule[0]) : []
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}