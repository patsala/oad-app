import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export async function GET() {
  try {
    const reservations = await query(
      `SELECT r.*, t.event_name, t.purse, t.multiplier, t.segment, t.event_type, t.start_date
       FROM reservations r
       LEFT JOIN tournaments t ON t.week_number = r.week_number
       ORDER BY r.week_number ASC`
    );
    return NextResponse.json({ reservations });
  } catch (error) {
    console.error('Failed to fetch reservations:', error);
    return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { dg_id, player_name, week_number } = await request.json();

    if (!dg_id || !player_name || !week_number) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check player isn't already "used" (actually picked)
    const usedCheck = await query(
      'SELECT used_in_tournament_id FROM players WHERE dg_id = $1',
      [dg_id]
    );
    if (usedCheck.length > 0 && usedCheck[0].used_in_tournament_id) {
      return NextResponse.json({ error: 'Player already used in a tournament' }, { status: 400 });
    }

    // Check tournament isn't completed
    const tournamentCheck = await query(
      'SELECT is_completed FROM tournaments WHERE week_number = $1',
      [week_number]
    );
    if (tournamentCheck.length > 0 && tournamentCheck[0].is_completed) {
      return NextResponse.json({ error: 'Tournament already completed' }, { status: 400 });
    }

    // Check if target week already has a different player reserved — clear it
    await query(
      'DELETE FROM reservations WHERE week_number = $1 AND dg_id != $2',
      [week_number, dg_id]
    );

    // Upsert: if player already reserved elsewhere, move them to this week
    await query(
      `INSERT INTO reservations (dg_id, player_name, week_number, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (dg_id) DO UPDATE SET
         week_number = $3,
         updated_at = NOW()`,
      [dg_id, player_name, week_number]
    );

    return NextResponse.json({ success: true, message: `${player_name} reserved for Week ${week_number}` });
  } catch (error) {
    console.error('Failed to create reservation:', error);
    return NextResponse.json(
      { error: 'Failed to create reservation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { dg_id, week_number } = await request.json();

    if (dg_id) {
      await query('DELETE FROM reservations WHERE dg_id = $1', [dg_id]);
    } else if (week_number) {
      await query('DELETE FROM reservations WHERE week_number = $1', [week_number]);
    } else {
      return NextResponse.json({ error: 'Must provide dg_id or week_number' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete reservation:', error);
    return NextResponse.json({ error: 'Failed to delete reservation' }, { status: 500 });
  }
}
