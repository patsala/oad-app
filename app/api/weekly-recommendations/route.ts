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
  top_20_odds?: number;
  dk_salary?: number;
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
function parseOdds(oddsString: string | undefined): number | undefined {
  if (!oddsString) return undefined;
  return parseInt(oddsString.replace('+', ''));
}

// Calculate expected value
function calculateEV(winOdds: number, top5Odds: number | undefined, top10Odds: number | undefined, purse: number, multiplier: number): number {
  const effectivePurse = purse * multiplier;
  const winProb = oddsToProb(winOdds);
  
  const winPayout = effectivePurse * 0.18;
  const top5Prob = top5Odds ? oddsToProb(top5Odds) : winProb * 5;
  const top5AvgPayout = effectivePurse * 0.08;
  const top10Prob = top10Odds ? oddsToProb(top10Odds) : winProb * 10;
  const top10AvgPayout = effectivePurse * 0.04;
  const top20Prob = winProb * 15;
  const top20AvgPayout = effectivePurse * 0.02;
  
  const ev = (winProb * winPayout) + 
             ((top5Prob - winProb) * top5AvgPayout) + 
             ((top10Prob - top5Prob) * top10AvgPayout) +
             ((top20Prob - top10Prob) * top20AvgPayout);
  
  return ev;
}

// Recommendation tier logic
function getRecommendationTier(
  tier: string, 
  ev: number, 
  isElite: boolean,
  winOdds: number,
  nextMajorWeeks: number
): { tier: string; reasoning: string; strategicNote?: string } {
  
  if (isElite && nextMajorWeeks <= 8) {
    if (winOdds < 1000 && ev > 200000) {
      return {
        tier: 'CONSIDER',
        reasoning: 'Elite player with strong odds this week',
        strategicNote: `Major in ${nextMajorWeeks} weeks - weigh carefully`
      };
    }
    return {
      tier: 'SAVE FOR MAJOR',
      reasoning: 'Elite player - save for 1.5x multiplier events',
      strategicNote: `Major in ${nextMajorWeeks} weeks`
    };
  }
  
  if (tier === 'Tier 1' && ev > 150000) {
    return { tier: 'TOP PICK', reasoning: 'High expected value, strong form' };
  }
  
  if ((tier === 'Tier 2' || tier === 'Tier 3') && ev > 120000) {
    return { tier: 'TOP PICK', reasoning: 'Exceptional value at this tier' };
  }
  
  if ((tier === 'Tier 1' || tier === 'Tier 2') && ev > 80000) {
    return { tier: 'STRONG VALUE', reasoning: 'Good value with solid upside' };
  }
  
  if (ev > 50000) {
    return { tier: 'PLAYABLE', reasoning: 'Decent option with acceptable value' };
  }
  
  if (ev > 25000) {
    return { tier: 'LONGSHOT', reasoning: 'High risk, moderate upside' };
  }
  
  return { tier: 'AVOID', reasoning: 'Low expected value' };
}

export async function GET() {
  try {
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
    
    // Fetch field, odds, and DFS salaries from DataGolf
    const [fieldResponse, oddsResponse, dfsResponse] = await Promise.all([
      fetch(`https://feeds.datagolf.com/field-updates?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`),
      fetch(`https://feeds.datagolf.com/betting-tools/outrights?tour=pga&market=win&odds_format=american&file_format=json&key=${process.env.DATAGOLF_API_KEY}`),
      fetch(`https://feeds.datagolf.com/preds/fantasy-projection-defaults?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`)
    ]);
    
    const fieldData = await fieldResponse.json();
    const oddsData = await oddsResponse.json();
    const dfsData = await dfsResponse.json();
    
    const dbPlayers = await query(
      'SELECT * FROM players ORDER BY datagolf_rank ASC'
    );
    
    const currentField = fieldData.field || [];
    const currentOdds = oddsData.odds || [];
    const dfsProjections = dfsData.projections || [];
    
    const recommendations: PlayerRecommendation[] = [];
    
    for (const fieldPlayer of currentField) {
      const dbPlayer = dbPlayers.find((p: any) => p.dg_id === fieldPlayer.dg_id);
      if (!dbPlayer) continue;
      
      const playerOdds = currentOdds.find((o: any) => o.dg_id === fieldPlayer.dg_id);
      if (!playerOdds || !playerOdds.datagolf?.baseline) continue;
      
      const playerDfs = dfsProjections.find((d: any) => d.dg_id === fieldPlayer.dg_id);
      
      const isUsed = dbPlayer.used_in_tournament_id !== null;
      const isElite = dbPlayer.tier === 'Elite';
      
      const winOdds = parseOdds(playerOdds.datagolf.baseline);
      const top5Odds = parseOdds(playerOdds.datagolf?.baseline_top_5);
      const top10Odds = parseOdds(playerOdds.datagolf?.baseline_top_10);
      const top20Odds = parseOdds(playerOdds.datagolf?.baseline_top_20);
      
      if (!winOdds) continue;
      
      const ev = calculateEV(winOdds, top5Odds, top10Odds, tournament.purse, tournament.multiplier);
      
      const recTier = getRecommendationTier(
        dbPlayer.tier,
        ev,
        isElite,
        winOdds,
        weeksToMajor
      );
      
      recommendations.push({
        name: dbPlayer.name,
        dg_id: dbPlayer.dg_id,
        tier: dbPlayer.tier,
        owgr_rank: dbPlayer.owgr_rank || 999,
        datagolf_rank: dbPlayer.datagolf_rank || 999,
        win_odds: winOdds,
        top_5_odds: top5Odds,
        top_10_odds: top10Odds,
        top_20_odds: top20Odds,
        dk_salary: playerDfs?.salary,
        course_fit: playerOdds.datagolf?.baseline_history_fit ? 
          (parseOdds(playerOdds.datagolf.baseline_history_fit)! / winOdds) : undefined,
        is_used: isUsed,
        used_week: dbPlayer.used_in_week,
        recommendation_score: ev,
        recommendation_tier: recTier.tier,
        reasoning: recTier.reasoning,
        strategic_note: recTier.strategicNote
      });
    }
    
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