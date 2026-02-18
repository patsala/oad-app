import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

// GET all picks
export async function GET() {
  try {
    const picks = await query(`
      SELECT p.*, t.event_name, t.week_number, t.segment 
      FROM picks p
      LEFT JOIN tournaments t ON p.tournament_id = t.id
      ORDER BY p.pick_date DESC
    `);
    return NextResponse.json({ picks });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch picks' }, { status: 500 });
  }
}

// POST a new pick (with validation)
export async function POST(request: Request) {
  try {
    const { tournament_id, player_name } = await request.json();
    
    // Validation 1: Check if tournament exists and is not completed
    const tournament = await query(
      'SELECT * FROM tournaments WHERE id = $1',
      [tournament_id]
    );
    
    if (!tournament || tournament.length === 0) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }
    
    if (tournament[0].is_completed) {
      return NextResponse.json({ error: 'Cannot pick for completed tournament' }, { status: 400 });
    }
    
    // Validation 2: Check if already made a pick for this tournament
    const existingPick = await query(
      'SELECT * FROM picks WHERE tournament_id = $1',
      [tournament_id]
    );
    
    if (existingPick && existingPick.length > 0) {
      return NextResponse.json({ 
        error: 'You already made a pick for this tournament',
        existing_pick: existingPick[0].player_name
      }, { status: 400 });
    }
    
    // Validation 3: Check if player has already been used
    const playerUsage = await query(
      'SELECT * FROM players WHERE name = $1 AND used_in_tournament_id IS NOT NULL',
      [player_name]
    );
    
    if (playerUsage && playerUsage.length > 0) {
      return NextResponse.json({ 
        error: `${player_name} was already used in week ${playerUsage[0].used_in_week}`,
        used_week: playerUsage[0].used_in_week
      }, { status: 400 });
    }
    
    // All validations passed - create the pick
    const result = await query(
      `INSERT INTO picks (tournament_id, player_name, earnings, finish_position) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [tournament_id, player_name, 0, null]
    );
    
    // Mark player as used
    await query(
      `UPDATE players 
       SET used_in_tournament_id = $1, used_in_week = $2 
       WHERE name = $3`,
      [tournament_id, tournament[0].week_number, player_name]
    );
    
    return NextResponse.json({ 
      pick: result[0],
      message: `Successfully locked in ${player_name} for ${tournament[0].event_name}`
    }, { status: 201 });
    
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ 
      error: 'Failed to create pick',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}