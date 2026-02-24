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
  enrichment?: any;
}

function parseOdds(oddsString: string | undefined): number | undefined {
  if (!oddsString) return undefined;
  return parseInt(oddsString.replace('+', ''));
}

function calculateTier(owgrRank: number | null): string {
  if (!owgrRank) return 'Tier 3';
  if (owgrRank <= 10) return 'Elite';
  if (owgrRank <= 30) return 'Tier 1';
  if (owgrRank <= 75) return 'Tier 2';
  return 'Tier 3';
}

function calculateEnhancedEV(
  winProb: number, 
  top5Prob: number, 
  top10Prob: number, 
  top20Prob: number,
  makeCutProb: number,
  purse: number, 
  multiplier: number,
  courseHistoryAdj: number = 0,
  courseFitAdj: number = 0
): number {
  const effectivePurse = purse * multiplier;
  
  // Apply course adjustments to probabilities
  const adjustmentFactor = 1 + (courseHistoryAdj * 0.5) + (courseFitAdj * 0.3);
  const adjustedWinProb = Math.min(1, Math.max(0, winProb * adjustmentFactor));
  const adjustedTop5Prob = Math.min(1, Math.max(0, top5Prob * adjustmentFactor));
  const adjustedTop10Prob = Math.min(1, Math.max(0, top10Prob * adjustmentFactor));
  const adjustedTop20Prob = Math.min(1, Math.max(0, top20Prob * adjustmentFactor));
  
  // PGA Tour standard payout percentages
  const payouts = {
    win: effectivePurse * 0.18,
    second: effectivePurse * 0.109,
    third: effectivePurse * 0.069,
    top5_avg: effectivePurse * 0.048,
    top10_avg: effectivePurse * 0.032,
    top20_avg: effectivePurse * 0.018,
    top70_avg: effectivePurse * 0.008
  };
  
  // Calculate incremental probabilities
  const secondProb = (adjustedTop5Prob - adjustedWinProb) * 0.25;
  const top5OnlyProb = adjustedTop5Prob - adjustedWinProb - secondProb;
  const top10OnlyProb = adjustedTop10Prob - adjustedTop5Prob;
  const top20OnlyProb = adjustedTop20Prob - adjustedTop10Prob;
  const madeCutProb = makeCutProb - adjustedTop20Prob;
  
  const ev = 
    (adjustedWinProb * payouts.win) +
    (secondProb * payouts.second) +
    (top5OnlyProb * payouts.top5_avg) +
    (top10OnlyProb * payouts.top10_avg) +
    (top20OnlyProb * payouts.top20_avg) +
    (madeCutProb * payouts.top70_avg);
  
  return ev;
}

function calculateSkillMatchScore(enrichment: any, courseType: string = 'accuracy'): number {
  if (!enrichment) return 0;
  
  // Course type determines which skills matter most
  const weights = courseType === 'accuracy' 
    ? { sg_app: 0.4, sg_ott: 0.2, sg_arg: 0.2, sg_putt: 0.2 }  // Accuracy course (like Riviera)
    : { sg_ott: 0.3, sg_app: 0.3, sg_arg: 0.2, sg_putt: 0.2 }; // Bomber course
  
  const score = 
    (enrichment.sg_app || 0) * weights.sg_app +
    (enrichment.sg_ott || 0) * weights.sg_ott +
    (enrichment.sg_arg || 0) * weights.sg_arg +
    (enrichment.sg_putt || 0) * weights.sg_putt;
  
  return score;
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
    
    // Fetch all enrichment data in ONE query
    const allEnrichment = await query(
      'SELECT * FROM player_enrichment_cache'
    );

    const enrichmentMap = new Map();
    allEnrichment.forEach((e: any) => {
      enrichmentMap.set(e.dg_id, e);
    });

    // Fetch form data (optional — don't fail if table doesn't exist yet)
    const formMap = new Map<number, any>();
    try {
      const formRows = await query(
        `SELECT dg_id, form_score, form_category, last_5_results,
                top_10_last_5, missed_cuts_last_5, withdrawals_last_5
         FROM player_form`
      );
      formRows.forEach((f: any) => formMap.set(f.dg_id, f));
    } catch {
      // player_form table not yet created
    }
    
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
    
    // Determine course type (simple heuristic - can be enhanced)
    const courseType = 'accuracy'; // Default for most courses
    
    // Build preliminary recommendations with EV and enrichment
    for (const fieldPlayer of currentField) {
      const dbPlayer = dbPlayers.find((p: any) => p.dg_id === fieldPlayer.dg_id);
      // Fall back to field player data for non-DB players (amateurs, LIV, etc.)
      const playerName = dbPlayer?.name || fieldPlayer.player_name;
      const playerOwgr = dbPlayer?.owgr_rank || fieldPlayer.owgr_rank;
      const playerDgRank = dbPlayer?.datagolf_rank || 999;
      const playerTier = dbPlayer?.tier || calculateTier(playerOwgr);
      const isUsed = dbPlayer?.used_in_tournament_id != null;
      const usedWeek = dbPlayer?.used_in_week;

      const playerOdds = currentOdds.find((o: any) => o.dg_id === fieldPlayer.dg_id);

      const playerProb = probabilities.find((p: any) => p.dg_id === fieldPlayer.dg_id);
      const playerProbCourseFit = probabilitiesCourseFit.find((p: any) => p.dg_id === fieldPlayer.dg_id);
      const playerDfs = dfsProjections.find((d: any) => d.dg_id === fieldPlayer.dg_id);

      if (!playerProb) continue;

      // Prefer bet365 → William Hill → FanDuel → DraftKings → BetMGM → Caesars → Bovada → DG baseline → DG baseline_history_fit
      const winOdds = parseOdds(playerOdds?.bet365)
        || parseOdds(playerOdds?.williamhill)
        || parseOdds(playerOdds?.fanduel)
        || parseOdds(playerOdds?.draftkings)
        || parseOdds(playerOdds?.betmgm)
        || parseOdds(playerOdds?.caesars)
        || parseOdds(playerOdds?.bovada)
        || parseOdds(playerOdds?.betonline)
        || parseOdds(playerOdds?.datagolf?.baseline)
        || parseOdds(playerOdds?.datagolf?.baseline_history_fit)
        || null;
      
      const winProb = playerProb.win || 0;
      const top5Prob = playerProb.top_5 || 0;
      const top10Prob = playerProb.top_10 || 0;
      const top20Prob = playerProb.top_20 || 0;
      const makeCutProb = playerProb.make_cut || 0;
      
      const courseFitWinProb = playerProbCourseFit?.win || undefined;
      
      // Get enrichment data
      const enrichData = enrichmentMap.get(fieldPlayer.dg_id);
      
      const courseHistoryAdj = enrichData?.course_history_adjustment || 0;
      const courseFitAdj = enrichData?.course_fit_adjustment || 0;
      
      // Calculate enhanced EV with course adjustments
      const ev = calculateEnhancedEV(
        winProb, 
        top5Prob, 
        top10Prob, 
        top20Prob,
        makeCutProb,
        tournament.purse, 
        tournament.multiplier,
        courseHistoryAdj,
        courseFitAdj
      );
      
      // Calculate skill match score
      const skillMatchScore = enrichData ? calculateSkillMatchScore(enrichData, courseType) : 0;
      
      // Calculate final ranking score (EV + skill match bonus)
      const rankingScore = ev; // Pure EV ranking - skill match is informational only
      
      preliminaryRecs.push({
        name: playerName,
        dg_id: fieldPlayer.dg_id,
        tier: playerTier,
        owgr_rank: playerOwgr || 999,
        datagolf_rank: playerDgRank,
        win_odds: winOdds,
        win_probability: winProb,
        top_5_probability: top5Prob,
        top_10_probability: top10Prob,
        top_20_probability: top20Prob,
        make_cut_probability: makeCutProb,
        dk_salary: playerDfs?.salary,
        course_fit: courseFitWinProb,
        is_used: isUsed,
        used_week: usedWeek,
        ev: ev,
        ranking_score: rankingScore,
        skill_match_score: skillMatchScore,
        enrichment: enrichData ? {
          course_history_adj: enrichData.course_history_adjustment,
          course_fit_adj: enrichData.course_fit_adjustment,
          sg_ott: enrichData.sg_ott,
          sg_app: enrichData.sg_app,
          sg_arg: enrichData.sg_arg,
          sg_putt: enrichData.sg_putt,
          sg_total: enrichData.sg_total,
          driving_acc: enrichData.driving_acc,
          driving_dist: enrichData.driving_dist,
          baseline_pred: enrichData.baseline_pred,
          final_pred: enrichData.final_pred
        } : null,
        form: (() => {
          const f = formMap.get(fieldPlayer.dg_id);
          if (!f) return null;
          return {
            score: Number(f.form_score),
            category: f.form_category,
            top_10_last_5: Number(f.top_10_last_5),
            missed_cuts_last_5: Number(f.missed_cuts_last_5),
            withdrawals_last_5: Number(f.withdrawals_last_5),
            last_5_results: f.last_5_results || [],
          };
        })()
      });
    }
    
    // Sort by enhanced ranking score (not just EV)
    const sortedRecs = preliminaryRecs
      .sort((a, b) => b.ranking_score - a.ranking_score)
      .slice(0, 50);
    
    const availableRecs = sortedRecs.filter(r => !r.is_used).slice(0, 30);
    
    // Skip AI recommendation tiers - just use simple EV-based tiers
    const recommendations: PlayerRecommendation[] = [];
    
    availableRecs.forEach((player, index) => {
      let tier = 'VALUE PLAY';
      let reasoning = 'Ranked by expected value with course fit adjustments';
      
      if (index < 3) {
        tier = 'TOP PICK';
        reasoning = 'Highest value with elite course fit';
      } else if (index < 8) {
        tier = 'STRONG VALUE';
        reasoning = 'Excellent value with strong upside';
      } else if (index < 15) {
        tier = 'PLAYABLE';
        reasoning = 'Solid option worth considering';
      }
      
      recommendations.push({
        ...player,
        ev: player.ev,
        recommendation_score: player.ranking_score,
        recommendation_tier: tier,
        reasoning: reasoning
      });
    });
    
    // Take top 20 for display
    const finalRecs = recommendations.slice(0, 20);
    
    return NextResponse.json({
      tournament: {
        name: tournament.event_name,
        week: tournament.week_number,
        purse: tournament.purse,
        multiplier: tournament.multiplier,
        segment: tournament.segment
      },
      next_major: upcomingMajors?.[0] || null,
      top_picks: finalRecs,
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