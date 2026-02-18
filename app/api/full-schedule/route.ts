import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const tournaments = await query(
      `SELECT id, event_name, course_name, city, country, start_date, end_date, 
              week_number, segment, event_type, purse, multiplier, 
              is_completed, winner
       FROM tournaments 
       ORDER BY week_number ASC`
    );
    
    return NextResponse.json({ tournaments });
    
  } catch (error) {
    console.error('Schedule fetch error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch schedule',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}