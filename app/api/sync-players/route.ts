import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { getPlayerRankings, calculateTier } from '@/app/lib/datagolf';

export async function POST() {
  try {
    const rankings = await getPlayerRankings();
    
    // Clear existing players
    await query('DELETE FROM players');
    
    // Insert all players
    for (const player of rankings.rankings) {
      const tier = calculateTier(player.owgr || 999);
      
      await query(
        'INSERT INTO players (name, tier) VALUES ($1, $2)',
        [player.player_name, tier]
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      count: rankings.rankings.length 
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ 
      error: 'Failed to sync players' 
    }, { status: 500 });
  }
}