import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

// Calculate earnings based on finish position
function calculateEarnings(finishPosition: number, purse: number, multiplier: number): number {
  // PGA Tour standard payout percentages (top 70 get paid)
  const payoutPercentages: { [key: number]: number } = {
    1: 0.18,   // Winner gets 18%
    2: 0.109,  // 2nd place gets 10.9%
    3: 0.069,
    4: 0.049,
    5: 0.041,
    6: 0.0365,
    7: 0.034,
    8: 0.0315,
    9: 0.0295,
    10: 0.0275,
    11: 0.0255,
    12: 0.0235,
    13: 0.0223,
    14: 0.0211,
    15: 0.02,
    16: 0.0189,
    17: 0.0178,
    18: 0.0167,
    19: 0.0156,
    20: 0.0145,
    // Simplified: positions 21-70 get progressively less
  };
  
  if (finishPosition > 70) return 0; // Missed cut or outside money
  
  const percentage = payoutPercentages[finishPosition] || 0.01; // Default 1% for 21-70
  const effectivePurse = purse * multiplier;
  
  return Math.round(effectivePurse * percentage);
}

export async function POST(request: Request) {
  try {
    const { tournament_id, player_name, finish_position } = await request.json();
    
    // Get tournament info for purse and multiplier
    const tournament = await query(
      'SELECT * FROM tournaments WHERE id = $1',
      [tournament_id]
    );
    
    if (!tournament || tournament.length === 0) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }
    
    const { purse, multiplier, segment } = tournament[0];
    
    // Calculate earnings
    const earnings = calculateEarnings(finish_position, purse, multiplier);
    
    // Update the pick with results
    await query(
      `UPDATE picks 
       SET finish_position = $1, earnings = $2 
       WHERE tournament_id = $3`,
      [finish_position, earnings, tournament_id]
    );
    
    // Update tournament as completed
    await query(
      `UPDATE tournaments 
       SET is_completed = true, winner = $1 
       WHERE id = $2`,
      [player_name, tournament_id]
    );
    
    // Update segment standings
    const currentStandings = await query(
      'SELECT * FROM segment_standings WHERE segment = $1',
      [segment]
    );
    
    if (currentStandings && currentStandings.length > 0) {
      const newTotal = parseFloat(currentStandings[0].total_earnings) + earnings;
      const newCompleted = currentStandings[0].events_completed + 1;
      
      await query(
        `UPDATE segment_standings 
         SET total_earnings = $1, 
             events_completed = $2,
             best_finish = LEAST(COALESCE(best_finish, 999), $3),
             updated_at = NOW()
         WHERE segment = $4`,
        [newTotal, newCompleted, finish_position, segment]
      );
    }
    
    return NextResponse.json({ 
      success: true,
      earnings,
      message: `${player_name} finished T${finish_position} - earned $${earnings.toLocaleString()}`
    });
    
  } catch (error) {
    console.error('Results error:', error);
    return NextResponse.json({ 
      error: 'Failed to log results',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}