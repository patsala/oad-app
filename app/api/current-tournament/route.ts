import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Auto-complete any tournaments whose end_date has passed but aren't marked done.
    // This keeps state correct without requiring a manual DB update after every tournament.
    await query(
      `UPDATE tournaments
       SET is_completed = true
       WHERE end_date < $1
         AND is_completed = false`,
      [today]
    );

    // 1. Active: tournament in progress right now (today within date range)
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

    // 2. Upcoming: next tournament that hasn't started yet
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

    return NextResponse.json({ error: 'No available tournaments' }, { status: 404 });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch tournament' }, { status: 500 });
  }
}