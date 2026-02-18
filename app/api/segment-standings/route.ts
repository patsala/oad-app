import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export async function GET() {
  try {
    const segmentStandings = await query(
      'SELECT segment, total_earnings, season_total_earnings, events_completed, best_finish, segment_winner_bonus FROM segment_standings ORDER BY segment ASC'
    );
    return NextResponse.json({ standings: segmentStandings });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 });
  }
}