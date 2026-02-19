import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export async function GET() {
  try {
    const players = await query(
      'SELECT id, name, tier, dg_id, used_in_tournament_id, used_in_week, owgr_rank, primary_tour FROM players ORDER BY name ASC'
    );
    return NextResponse.json({ players });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }
}