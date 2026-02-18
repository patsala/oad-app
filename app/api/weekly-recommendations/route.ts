import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

interface PlayerRecommendation {
  name: string;
  dg_id: number;
  tier: string;
  owgr_rank: number;
  datagolf_rank: number;
  win_odds: number;
  win_probability: number;
  top_5_probability: number;
  top_10_probability: number;
  top_20_probability: number;
  make_cut_probability: number;
  dk_salary?: number;
  course_fit?: number;
  is_used: boolean;
  used_week?: number;
  recommendation_score: number;
  recommendation_tier: string;
  reasoning: string;
  strategic_note?: string;
  narrative?: string;
}

function parseOdds(oddsString: string | undefined): number | undefined {
  if (!oddsString) return undefined;
  return parseInt(oddsString.replace('+', ''));
}

function oddsToProb(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}

function calculateEV(winProb: number, top5Prob: number, top10Prob: number, purse: number, multiplier: number): number {
  const effectivePurse = purse * multiplier;
  
  const winPayout = effectivePurse * 0.18;
  const top5AvgPayout = effectivePurse * 0.08;
  const top10AvgPayout = effectivePurse * 0.04;
  const top20AvgPayout = effectivePurse * 0.02;
  
  const top20Prob = winProb * 15;
  
  const ev = (winProb * winPayout) + 
             ((top5Prob - winProb) * top5AvgPayout) + 
             ((top10Prob - top5Prob) * top10AvgPayout) +
             ((top20Prob - top10Prob) * top20AvgPayout);
  
  return ev;
}

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
    
    // Fetch field, odds, probabilities, and DFS salaries
    const [fieldResponse, oddsResponse, probabilitiesResponse, dfsResponse] = await Promise.all([
      fetch(`https://feeds.datagolf.com/field-updates?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`),
      fetch(`https://feeds.datagolf.com/betting-tools/outrights?tour=pga&market=win&odds_format=american&file_format=json&key=${process.env.DATAGOLF_API_KEY}`),
      fetch(`https://feeds.datagolf.com/preds/pre-tournament?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`),
      fetch(`https://feeds.datagolf.com/preds/fantasy-projection-defaults?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`)
    ]);
    
    const fieldData = await fieldResponse.json();
    const oddsData = await oddsResponse.json();
    const probabilitiesData = await probabilitiesResponse.json();
    const dfsData = await dfsResponse.json();
    
    const dbPlayers = await query(
      'SELECT * FROM players ORDER BY datagolf_rank ASC'
    );
    
    const currentField = fieldData.field || [];
    const currentOdds = oddsData.odds || [];
    const probabilities = probabilitiesData.baseline || [];
    const probabilitiesCourseFit = probabilitiesData.baseline_history_fit || [];
    const dfsProjections = dfsData.projections || [];
    
    const recommendations: PlayerRecommendation[] = [];
    
    for (const fieldPlayer of currentField) {
      const dbPlayer = dbPlayers.find((p: any) => p.dg_id === fieldPlayer.dg_id);
      if (!dbPlayer) continue;
      
      const playerOdds = currentOdds.find((o: any) => o.dg_id === fieldPlayer.dg_id);
      if (!playerOdds || !playerOdds.datagolf?.baseline) continue;
      
      const playerProb = probabilities.find((p: any) => p.dg_id === fieldPlayer.dg_id);
      const playerProbCourseFit = probabilitiesCourseFit.find((p: any) => p.dg_id === fieldPlayer.dg_id);
      const playerDfs = dfsProjections.find((d: any) => d.dg_id === fieldPlayer.dg_id);
      
      if (!playerProb) continue;
      
      const isUsed = dbPlayer.used_in_tournament_id !== null;
      const isElite = dbPlayer.tier === 'Elite';
      
      const winOdds = parseOdds(playerOdds.datagolf.baseline);
      if (!winOdds) continue;
      
      const winProb = playerProb.win || 0;
      const top5Prob = playerProb.top_5 || 0;
      const top10Prob = playerProb.top_10 || 0;
      const top20Prob = playerProb.top_20 || 0;
      const makeCutProb = playerProb.make_cut || 0;
      
      const ev = calculateEV(winProb, top5Prob, top10Prob, tournament.purse, tournament.multiplier);
      
      const recTier = getRecommendationTier(
        dbPlayer.tier,
        ev,
        isElite,
        winOdds,
        weeksToMajor
      );
      
      // Calculate course fit (compare baseline vs baseline_history_fit win probability)
      const courseFit = playerProbCourseFit?.win ? 
        (playerProbCourseFit.win / winProb) : undefined;
      
      recommendations.push({
        name: dbPlayer.name,
        dg_id: dbPlayer.dg_id,
        tier: dbPlayer.tier,
        owgr_rank: dbPlayer.owgr_rank || 999,
        datagolf_rank: dbPlayer.datagolf_rank || 999,
        win_odds: winOdds,
        win_probability: winProb,
        top_5_probability: top5Prob,
        top_10_probability: top10Prob,
        top_20_probability: top20Prob,
        make_cut_probability: makeCutProb,
        dk_salary: playerDfs?.salary,
        course_fit: courseFit,
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