import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

interface PlayerRecommendation {
  name: string;
  dg_id: number;
  tier: string;
  owgr_rank: number;
  datagolf_rank: number;
  win_odds: number;
  top_5_odds?: number;
  top_10_odds?: number;
  course_fit?: number;
  recent_form?: string;
  is_used: boolean;
  used_week?: number;
  recommendation_score: number;
  recommendation_tier: string;
  reasoning: string;
  strategic_note?: string;
}

// Convert American odds to probability
function oddsToProb(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}

// Parse DataGolf odds format ("+421" -> 421)
function parseOdds(oddsString: string): number {
  return parseInt(oddsString.replace('+', ''));
}

// Calculate expected value
function calculateEV(winOdds: number, purse: number, multiplier: number): number {
  const effectivePurse = purse * multiplier;
  const winProb = oddsToProb(winOdds);
  
  // Simplified EV: just win probability * win payout
  const winPayout = effectivePurse * 0.18;
  const top5AvgPayout = effectivePurse * 0.08;
  const top10AvgPayout = effectivePurse * 0.04;
  
  // Estimate finish probabilities
  const top5Prob = winProb * 5;
  const top10Prob = winProb * 10;
  
  const ev = (winProb * winPayout) + 
             ((top5Prob - winProb) * top5AvgPayout) + 
             ((top10Prob - top5Prob) * top10AvgPayout);
  
  return ev;
}

// Recommendation tier logic
function getRecommendationTier(
  tier: string, 
  ev: number, 
  isElite: boolean, 
  nextMajorWeeks: number
): { tier: string; reasoning: string; strategicNote?: string } {
  
  if (isElite && nextMajorWeeks <= 8) {
    return {
      tier: 'SAVE FOR MAJOR',
      reasoning: 'Elite player - save for 1.5x multiplier events',
      strategicNote: `Major in ${nextMajorWeeks} weeks`
    };
  }
  
  if (ev > 150000 && (tier === 'Tier 1' || tier === 'Tier 2')) {
    return {
      tier: 'TOP PICK',
      reasoning: 'High expected value with good course fit',
    };
  }
  
  if (ev > 100000) {
    return {
      tier: 'STRONG VALUE',
      reasoning: 'Solid value play for this week',
    };
  }
  
  if (ev > 50000) {
    return {
      tier: 'PLAYABLE',
      reasoning: 'Decent option if saving elites',
    };
  }
  
  return {
    tier: 'AVOID',
    reasoning: 'Low expected value',
  };
}

export async function GET() {
  try {
    // Get current tournament
    const currentTournament = await query(
      `SELECT * FROM tournaments 
       WHERE is_completed = false 
       ORDER BY start_date ASC 
       LIMIT 1`
    );
    
    if (!currentTournament || currentTournament.length === 0) {
      return NextResponse.json({ error: 'No upcoming tournament' }, { status: 404 });
    }
    
    const tournament = currentTournament[0];
    
    // Get next major
    const nextMajor = await query(
      `SELECT * FROM tournaments 
       WHERE event_type = 'Major' AND start_date > $1
       ORDER BY start_date ASC 
       LIMIT 1`,
      [tournament.start_date]
    );
    
    const weeksToMajor = nextMajor?.[0] 
      ? Math.ceil((new Date(nextMajor[0].start_date).getTime() - new Date(tournament.start_date).getTime()) / (7 * 24 * 60 * 60 * 1000))
      : 999;
    
    // Fetch field and odds from DataGolf
    const [fieldResponse, oddsResponse] = await Promise.all([
      fetch(`https://feeds.datagolf.com/field-updates?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`),
      fetch(`https://feeds.datagolf.com/betting-tools/outrights?tour=pga&market=win&odds_format=american&file_format=json&key=${process.env.DATAGOLF_API_KEY}`)
    ]);
    
    const fieldData = await fieldResponse.json();
    const oddsData = await oddsResponse.json();
    
    // Get all players from database
    const dbPlayers = await query(
      'SELECT * FROM players ORDER BY datagolf_rank ASC'
    );
    
    // Field data is a single object for current event
    const currentField = fieldData.field || [];
    const currentOdds = oddsData.odds || [];
    
    // Build recommendations
    const recommendations: PlayerRecommendation[] = [];
    
    for (const fieldPlayer of currentField) {
      const dbPlayer = dbPlayers.find((p: any) => p.dg_id === fieldPlayer.dg_id);
      if (!dbPlayer) continue;
      
      const playerOdds = currentOdds.find((o: any) => o.dg_id === fieldPlayer.dg_id);
      if (!playerOdds || !playerOdds.datagolf?.baseline) continue;
      
      const isUsed = dbPlayer.used_in_tournament_id !== null;
      const isElite = dbPlayer.tier === 'Elite';
      
      const winOdds = parseOdds(playerOdds.datagolf.baseline);
      
      const ev = calculateEV(winOdds, tournament.purse, tournament.multiplier);
      
      const recTier = getRecommendationTier(
        dbPlayer.tier,
        ev,
        isElite,
        weeksToMajor
      );
      
      recommendations.push({
        name: dbPlayer.name,
        dg_id: dbPlayer.dg_id,
        tier: dbPlayer.tier,
        owgr_rank: dbPlayer.owgr_rank || 999,
        datagolf_rank: dbPlayer.datagolf_rank || 999,
        win_odds: winOdds,
        course_fit: playerOdds.datagolf?.baseline_history_fit ? 
          (1 - parseOdds(playerOdds.datagolf.baseline_history_fit) / parseOdds(playerOdds.datagolf.baseline)) : undefined,
        is_used: isUsed,
        used_week: dbPlayer.used_in_week,
        recommendation_score: ev,
        recommendation_tier: recTier.tier,
        reasoning: recTier.reasoning,
        strategic_note: recTier.strategicNote
      });
    }
    
    // Sort by EV and filter
    const sortedRecs = recommendations
      .sort((a, b) => b.recommendation_score - a.recommendation_score)
      .slice(0, 50);
    
    const availableRecs = sortedRecs.filter(r => !r.is_used).slice(0, 20);
    const usedButRelevant = sortedRecs.filter(r => r.is_used).slice(0, 5);
    
    return NextResponse.json({
      tournament: {
        name: tournament.event_name,
        week: tournament.week_number,
        purse: tournament.purse,
        multiplier: tournament.multiplier,
        segment: tournament.segment
      },
      next_major: nextMajor?.[0] ? {
        name: nextMajor[0].event_name,
        weeks_away: weeksToMajor
      } : null,
      top_picks: availableRecs,
      elite_players_used: usedButRelevant,
      total_in_field: recommendations.length
    });
    
  } catch (error) {
    console.error('Recommendations error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate recommendations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}