import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { getCurrentField, getEventOdds } from '@/app/lib/datagolf';

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

// Calculate expected value based on odds and tournament purse
function calculateEV(winOdds: number, top5Odds: number | undefined, purse: number, multiplier: number): number {
  const effectivePurse = purse * multiplier;
  
  const winProb = oddsToProb(winOdds);
  const top5Prob = top5Odds ? oddsToProb(top5Odds) : winProb * 4; // estimate if missing
  
  // PGA Tour standard payouts
  const winPayout = effectivePurse * 0.18;
  const top5AvgPayout = effectivePurse * 0.08;
  const top10AvgPayout = effectivePurse * 0.04;
  const top20AvgPayout = effectivePurse * 0.02;
  
  // Simple EV calculation
  const ev = (winProb * winPayout) + 
             ((top5Prob - winProb) * top5AvgPayout) + 
             ((top5Prob * 2 - top5Prob) * top10AvgPayout) +
             ((0.7 - top5Prob * 2) * top20AvgPayout);
  
  return ev;
}

// Determine recommendation tier based on multiple factors
function getRecommendationTier(
  tier: string, 
  ev: number, 
  isElite: boolean, 
  nextMajorWeeks: number,
  courseFit?: number
): { tier: string; reasoning: string; strategicNote?: string } {
  
  // Elite players - save for majors unless perfect course fit
  if (isElite && nextMajorWeeks <= 8) {
    if (courseFit && courseFit > 0.5) {
      return {
        tier: 'CONSIDER',
        reasoning: 'Elite player with excellent course fit',
        strategicNote: `Major coming in ${nextMajorWeeks} weeks - weigh carefully`
      };
    }
    return {
      tier: 'SAVE FOR MAJOR',
      reasoning: 'Too valuable - save for 1.5x multiplier events',
      strategicNote: `Next major in ${nextMajorWeeks} weeks`
    };
  }
  
  // High EV tier 2/3 players
  if (ev > 150000 && (tier === 'Tier 2' || tier === 'Tier 1')) {
    return {
      tier: 'TOP PICK',
      reasoning: 'High expected value with solid course fit',
    };
  }
  
  if (ev > 100000) {
    return {
      tier: 'STRONG VALUE',
      reasoning: 'Good value play for this week',
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
    reasoning: 'Low expected value for this event',
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
    
    // Get next major to calculate strategic value
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
    
    // Fetch current field and odds from DataGolf
    const [fieldData, oddsData] = await Promise.all([
      getCurrentField(),
      getEventOdds()
    ]);
    
    // Get all players from database with usage info
    const dbPlayers = await query(
      'SELECT * FROM players ORDER BY datagolf_rank ASC'
    );
    
    // Match field with odds and database info
    const recommendations: PlayerRecommendation[] = [];
    
    // Find the current event in field data
    const currentEventField = fieldData.find((event: any) => 
      event.event_name?.toLowerCase().includes(tournament.event_name.split(' ')[0].toLowerCase())
    );
    
    // Find current event odds
    const currentEventOdds = oddsData.baseline?.[0]; // Most recent event odds
    
    if (!currentEventField || !currentEventOdds) {
      return NextResponse.json({ 
        error: 'Could not find field or odds for current tournament',
        tournament: tournament.event_name
      }, { status: 404 });
    }
    
    // Build recommendations for each player in the field
    for (const fieldPlayer of currentEventField.field || []) {
      const dbPlayer = dbPlayers.find((p: any) => p.dg_id === fieldPlayer.dg_id);
      if (!dbPlayer) continue;
      
      const playerOdds = currentEventOdds.odds?.find((o: any) => o.dg_id === fieldPlayer.dg_id);
      if (!playerOdds) continue; // Skip if no odds available
      
      const isUsed = dbPlayer.used_in_tournament_id !== null;
      const isElite = dbPlayer.tier === 'Elite';
      
      const ev = calculateEV(
        playerOdds.baseline_win || playerOdds.win || 10000,
        playerOdds.baseline_top_5 || playerOdds.top_5,
        tournament.purse,
        tournament.multiplier
      );
      
      const recTier = getRecommendationTier(
        dbPlayer.tier,
        ev,
        isElite,
        weeksToMajor,
        fieldPlayer.baseline_history_fit
      );
      
      recommendations.push({
        name: dbPlayer.name,
        dg_id: dbPlayer.dg_id,
        tier: dbPlayer.tier,
        owgr_rank: dbPlayer.owgr_rank || 999,
        datagolf_rank: dbPlayer.datagolf_rank || 999,
        win_odds: playerOdds.baseline_win || playerOdds.win || 10000,
        top_5_odds: playerOdds.baseline_top_5 || playerOdds.top_5,
        top_10_odds: playerOdds.baseline_top_10 || playerOdds.top_10,
        course_fit: fieldPlayer.baseline_history_fit,
        is_used: isUsed,
        used_week: dbPlayer.used_in_week,
        recommendation_score: ev,
        recommendation_tier: recTier.tier,
        reasoning: recTier.reasoning,
        strategic_note: recTier.strategicNote
      });
    }
    
    // Sort by recommendation score (EV) and filter to top 20 available players
    const sortedRecs = recommendations
      .sort((a, b) => b.recommendation_score - a.recommendation_score)
      .slice(0, 50); // Get top 50 to have options after filtering
    
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