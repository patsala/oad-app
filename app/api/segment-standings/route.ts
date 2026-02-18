import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export async function GET() {
  try {
    const standings = await query(
      'SELECT * FROM segment_standings ORDER BY segment ASC'
    );
    return NextResponse.json({ standings });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 });
  }
}