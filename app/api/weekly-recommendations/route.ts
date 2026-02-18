import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
  ev?: number;
}

function parseOdds(oddsString: string | undefined): number | undefined {
  if (!oddsString) return undefined;
  return parseInt(oddsString.replace('+', ''));
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
    
    // Get segment standings
    const segmentStandings = await query(
      'SELECT * FROM segment_standings ORDER BY segment ASC'
    );
    
    // Get already used players
    const usedPlayers = await query(
      `SELECT p.name, p.tier, pk.tournament_id, t.week_number as week
       FROM players p
       JOIN picks pk ON p.name = pk.player_name
       JOIN tournaments t ON pk.tournament_id = t.id
       WHERE p.used_in_tournament_id IS NOT NULL
       ORDER BY t.week_number ASC`
    );
    
    // Get upcoming majors
    const upcomingMajors = await query(
      `SELECT event_name as name, week_number as week, 
              CEIL((DATE(start_date) - DATE($1)) / 7.0) as weeks_away
       FROM tournaments 
       WHERE event_type = 'Major' AND start_date > $1
       ORDER BY start_date ASC`,
      [tournament.start_date]
    );
    
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
    
    const preliminaryRecs: any[] = [];
    
    // Build preliminary recommendations with EV
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
      
      const winOdds = parseOdds(playerOdds.datagolf.baseline);
      if (!winOdds) continue;
      
      const winProb = playerProb.win || 0;
      const top5Prob = playerProb.top_5 || 0;
      const top10Prob = playerProb.top_10 || 0;
      const top20Prob = playerProb.top_20 || 0;
      const makeCutProb = playerProb.make_cut || 0;
      
      const ev = calculateEV(winProb, top5Prob, top10Prob, tournament.purse, tournament.multiplier);
      
      const courseFit = playerProbCourseFit?.win ? 
        (playerProbCourseFit.win / winProb) : undefined;
      
      preliminaryRecs.push({
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
        ev: ev
      });
    }
    
    // Sort by EV and take top 30 for AI analysis
    const topByEV = preliminaryRecs
      .sort((a, b) => b.ev - a.ev)
      .filter(r => !r.is_used)
      .slice(0, 30);
    
    // Generate AI-powered recommendation tiers for all top players in ONE batch call
    const recommendations: PlayerRecommendation[] = [];
    
    try {
      const recResponse = await fetch('https://oad-app.vercel.app/api/generate-recommendation-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          players: topByEV,
          tournament: {
            name: tournament.event_name,
            event_type: tournament.event_type,
            multiplier: tournament.multiplier,
            segment: tournament.segment
          },
          segment_standings: segmentStandings,
          used_players: usedPlayers,
          upcoming_majors: upcomingMajors,
          week_number: tournament.week_number
        })
      });
      
      if (recResponse.ok) {
        const recData = await recResponse.json();
        
        // Merge AI recommendations
        topByEV.forEach(player => {
          const aiRec = recData.recommendations?.[player.dg_id] || { tier: 'PLAYABLE', reasoning: 'Analysis pending' };
          recommendations.push({
            ...player,
            recommendation_score: player.ev,
            recommendation_tier: aiRec.tier,
            reasoning: aiRec.reasoning
          });
        });
      } else {
        // Fallback
        topByEV.forEach(player => {
          recommendations.push({
            ...player,
            recommendation_score: player.ev,
            recommendation_tier: 'PLAYABLE',
            reasoning: 'Strategic analysis pending'
          });
        });
      }
    } catch (error) {
      console.error('Failed to generate AI recommendations:', error);
      topByEV.forEach(player => {
        recommendations.push({
          ...player,
          recommendation_score: player.ev,
          recommendation_tier: 'PLAYABLE',
          reasoning: 'Strategic analysis pending'
        });
      });
    }
    
    // Return top 20 WITHOUT narratives (narratives generated on-demand by user)
    const top20 = recommendations.slice(0, 20);
    
    return NextResponse.json({
      tournament: {
        name: tournament.event_name,
        week: tournament.week_number,
        purse: tournament.purse,
        multiplier: tournament.multiplier,
        segment: tournament.segment
      },
      next_major: upcomingMajors?.[0] || null,
      top_picks: top20,
      total_in_field: preliminaryRecs.length
    });
    
  } catch (error) {
    console.error('Recommendations error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate recommendations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}