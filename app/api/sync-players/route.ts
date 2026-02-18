import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { getPlayerRankings, calculateTier } from '@/app/lib/datagolf';

// Function to transform "Last, First" to "First Last"
function formatPlayerName(name: string): string {
  if (!name.includes(',')) return name; // Already in correct format
  
  const parts = name.split(',').map(s => s.trim());
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`; // "Last, First" -> "First Last"
  }
  return name;
}

export async function POST() {
  try {
    const rankings = await getPlayerRankings();
    
    // Clear existing players
    await query('DELETE FROM players');
    
    // Insert all players with formatted names
    for (const player of rankings.rankings) {
      const tier = calculateTier(player.owgr || 999);
      const formattedName = formatPlayerName(player.player_name);
      
      await query(
        'INSERT INTO players (name, tier) VALUES ($1, $2)',
        [formattedName, tier]
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