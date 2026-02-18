import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

// Function to transform "Last, First" to "First Last"
function formatPlayerName(name: string): string {
  if (!name.includes(',')) return name;
  
  const parts = name.split(',').map(s => s.trim());
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`;
  }
  return name;
}

// Calculate tier based on OWGR (world ranking)
function calculateTier(owgrRank: number | null): string {
  if (!owgrRank) return 'Tier 3';
  if (owgrRank <= 10) return 'Elite';
  if (owgrRank <= 30) return 'Tier 1';
  if (owgrRank <= 75) return 'Tier 2';
  return 'Tier 3';
}

export async function POST() {
  try {
    const response = await fetch(
      `https://feeds.datagolf.com/preds/get-dg-rankings?file_format=json&key=${process.env.DATAGOLF_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch rankings from DataGolf');
    }
    
    const data = await response.json();
    
    // Clear existing players
    await query('DELETE FROM players');
    
    // Insert all players with full DataGolf data
    let count = 0;
    for (const player of data.rankings) {
      // Only include PGA and EURO tour players (skip LIV/amateur)
      if (player.primary_tour !== 'PGA' && player.primary_tour !== 'EURO') {
        continue;
      }
      
      const tier = calculateTier(player.owgr_rank);
      const formattedName = formatPlayerName(player.player_name);
      
      await query(
        `INSERT INTO players (
          name, tier, dg_id, country, datagolf_rank, owgr_rank, 
          dg_skill_estimate, primary_tour, is_amateur
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (dg_id) DO UPDATE SET
          name = EXCLUDED.name,
          tier = EXCLUDED.tier,
          country = EXCLUDED.country,
          datagolf_rank = EXCLUDED.datagolf_rank,
          owgr_rank = EXCLUDED.owgr_rank,
          dg_skill_estimate = EXCLUDED.dg_skill_estimate,
          primary_tour = EXCLUDED.primary_tour,
          is_amateur = EXCLUDED.is_amateur`,
        [
          formattedName,
          tier,
          player.dg_id,
          player.country,
          player.datagolf_rank,
          player.owgr_rank,
          player.dg_skill_estimate,
          player.primary_tour,
          player.am === 1
        ]
      );
      count++;
    }
    
    return NextResponse.json({ 
      success: true, 
      count,
      message: `Synced ${count} PGA/EURO players with full DataGolf data`
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ 
      error: 'Failed to sync players',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}