import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(
      `https://feeds.datagolf.com/preds/fantasy-projection-defaults?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
    );
    
    const data = await response.json();
    
    return NextResponse.json({
      structure: Array.isArray(data) ? 'array' : 'object',
      keys: Object.keys(data),
      sample: Array.isArray(data) ? data.slice(0, 3) : data
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}