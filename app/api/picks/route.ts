import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

// GET all picks
export async function GET() {
  try {
    const picks = await query('SELECT * FROM picks ORDER BY pick_date DESC');
    return NextResponse.json({ picks });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch picks' }, { status: 500 });
  }
}

// POST a new pick
export async function POST(request: Request) {
  try {
    const { tournament_id, player_name, earnings, finish_position } = await request.json();
    
    const result = await query(
      'INSERT INTO picks (tournament_id, player_name, earnings, finish_position) VALUES ($1, $2, $3, $4) RETURNING *',
      [tournament_id, player_name, earnings || 0, finish_position || null]
    );
    
    return NextResponse.json({ pick: result[0] }, { status: 201 });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to create pick' }, { status: 500 });
  }
}