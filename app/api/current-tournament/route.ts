import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Find active tournament (today is between start and end date)
    const active = await query(
      `SELECT * FROM tournaments 
       WHERE start_date <= $1 AND end_date >= $1 AND is_completed = false
       ORDER BY start_date ASC
       LIMIT 1`,
      [today]
    );
    
    if (active && active.length > 0) {
      return NextResponse.json({ tournament: active[0], status: 'active' });
    }
    
    // No active tournament, get next upcoming (not completed)
    const upcoming = await query(
      `SELECT * FROM tournaments 
       WHERE start_date > $1 AND is_completed = false
       ORDER BY start_date ASC
       LIMIT 1`,
      [today]
    );
    
    if (upcoming && upcoming.length > 0) {
      return NextResponse.json({ tournament: upcoming[0], status: 'upcoming' });
    }
    
    // Fallback: get last incomplete tournament (for retroactive picks)
    const lastIncomplete = await query(
      `SELECT * FROM tournaments 
       WHERE is_completed = false
       ORDER BY start_date ASC
       LIMIT 1`
    );
    
    if (lastIncomplete && lastIncomplete.length > 0) {
      return NextResponse.json({ tournament: lastIncomplete[0], status: 'incomplete' });
    }
    
    return NextResponse.json({ error: 'No available tournaments' }, { status: 404 });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch tournament' }, { status: 500 });
  }
}