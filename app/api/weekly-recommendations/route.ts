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

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
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

// ─── EV Adjustments ─────────────────────────────────────────────────────────

/**
 * Form score (0-100, mean ~50) → additive win-probability adjustment.
 * Hot player (80): ~+1.5%  |  Cold player (20): ~-1.5%  |  Cap ±2%.
 */
function calculateFormAdjustment(formScore: number | null | undefined): number {
  if (!formScore) return 0;
  const zScore = (formScore - 50) / 20;
  return clamp(zScore * 0.02, -0.02, 0.02);
}

/**
 * Adjust win probability based on tournament weather vs. player skill profile.
 * Returns an additive adjustment to win probability, capped at ±2%.
 */
function calculateWeatherAdjustment(
  enrichment: any,
  weather: { maxWind: number; maxPrecip: number; avgTemp: number } | null
): number {
  if (!weather || !enrichment) return 0;

  let adj = 0;

  // Wind: strong wind favors ball-strikers (OTT + APP) over scramblers
  if (weather.maxWind > 15) {
    const ballStriking = ((enrichment.sg_ott || 0) + (enrichment.sg_app || 0)) / 2;
    const scrambling   = ((enrichment.sg_arg || 0) + (enrichment.sg_putt || 0)) / 2;
    const skillRatio   = ballStriking / Math.max(Math.abs(scrambling), 0.1);
    const windFactor   = (weather.maxWind - 10) / 100;
    adj += (skillRatio - 1) * windFactor * 0.015;
  }

  // Rain / soft fairways: favour long hitters
  if (weather.maxPrecip > 60) {
    const drivingBonus = ((enrichment.driving_dist || 295) - 295) / 2000;
    adj += drivingBonus;
    // Short-but-accurate players get a small penalty on soft courses
    if ((enrichment.driving_dist || 295) < 285 && (enrichment.driving_acc || 0) > 65) {
      adj -= 0.003;
    }
  }

  // Cold temps (<50°F): small penalty for accuracy-reliant players
  if (weather.avgTemp < 50) {
    const ballStrikingSkill = ((enrichment.sg_ott || 0) + (enrichment.sg_app || 0)) / 2;
    if (ballStrikingSkill < 0) adj -= 0.003;
  }

  return clamp(adj, -0.02, 0.02);
}

/**
 * Compare DataGolf model win probability against implied probability from
 * betting odds.  Returns the edge (model − market); 0 if edge < 1.5% (noise).
 */
function detectMarketEdge(modelWinProb: number, winOdds: number | null): number {
  if (!winOdds || modelWinProb <= 0) return 0;

  const impliedProb = winOdds > 0
    ? 100 / (winOdds + 100)
    : Math.abs(winOdds) / (Math.abs(winOdds) + 100);

  const edge = modelWinProb - impliedProb;
  return Math.abs(edge) >= 0.015 ? edge : 0;
}

// ─── Core EV Calculation (v2) ────────────────────────────────────────────────

/**
 * Computes expected earnings for a pick.
 *
 * Key design decisions vs. the old function:
 *  1. Uses `baseline_history_fit` probabilities (already course-adjusted by DataGolf)
 *     instead of `baseline` + our own course multiplier (which double-counted).
 *  2. Form adjustment is additive and cascades proportionally across finish tiers.
 *  3. Weather adjustment multiplies win% and cascades proportionally.
 *  4. All incremental probability buckets are guarded with Math.max(0, …).
 *  5. Betting-market inefficiency nudges EV up/down when DataGolf and the
 *     books materially disagree (edge ≥ 1.5%).
 */
function calculateEnhancedEV(
  baselineHistoryFitProb: any,
  baselineProb: any,
  purse: number,
  multiplier: number,
  formScore: number | null | undefined,
  enrichment: any,
  winOdds: number | null,
  weather: { maxWind: number; maxPrecip: number; avgTemp: number } | null
): number {
  // STEP 1: Prefer baseline_history_fit (course-adjusted), fall back to baseline
  const probs = baselineHistoryFitProb || baselineProb;
  if (!probs) return 0;

  let winProb    = probs.win      || 0;
  let top5Prob   = probs.top_5    || 0;
  let top10Prob  = probs.top_10   || 0;
  let top20Prob  = probs.top_20   || 0;
  let makeCutProb = probs.make_cut || 0;

  // STEP 2: Form adjustment — additive, proportionally cascades through tiers
  const formAdj = calculateFormAdjustment(formScore);
  winProb    = clamp(winProb    + formAdj);
  top5Prob   = clamp(top5Prob   + formAdj * 0.7, winProb);
  top10Prob  = clamp(top10Prob  + formAdj * 0.5, top5Prob);
  top20Prob  = clamp(top20Prob  + formAdj * 0.3, top10Prob);

  // STEP 3: Weather adjustment — multiplicative on win%, proportional cascade
  const weatherAdj = calculateWeatherAdjustment(enrichment, weather);
  winProb    = clamp(winProb    * (1 + weatherAdj));
  top5Prob   = clamp(top5Prob   * (1 + weatherAdj * 0.7), winProb);
  top10Prob  = clamp(top10Prob  * (1 + weatherAdj * 0.5), top5Prob);
  top20Prob  = clamp(top20Prob  * (1 + weatherAdj * 0.3), top10Prob);

  // STEP 4: Incremental (mutually-exclusive) probabilities — guarded against negatives
  const top2Prob       = top5Prob * 0.4; // best approximation without top-2 from DataGolf
  const winOnlyProb    = winProb;
  const secondProb     = Math.max(0, top2Prob - winProb);
  const top5OnlyProb   = Math.max(0, top5Prob   - top2Prob);
  const top10OnlyProb  = Math.max(0, top10Prob  - top5Prob);
  const top20OnlyProb  = Math.max(0, top20Prob  - top10Prob);
  const madeCutOnlyProb = Math.max(0, makeCutProb - top20Prob);

  // STEP 5: Payout percentages (PGA Tour standard)
  const effectivePurse = purse * multiplier;
  const payouts = {
    win:         effectivePurse * 0.18,
    second:      effectivePurse * 0.109,
    top5_avg:    effectivePurse * 0.048,
    top10_avg:   effectivePurse * 0.032,
    top20_avg:   effectivePurse * 0.018,
    madeCut_avg: effectivePurse * 0.008,
  };

  // STEP 6: Base EV
  let ev =
    winOnlyProb     * payouts.win        +
    secondProb      * payouts.second     +
    top5OnlyProb    * payouts.top5_avg   +
    top10OnlyProb   * payouts.top10_avg  +
    top20OnlyProb   * payouts.top20_avg  +
    madeCutOnlyProb * payouts.madeCut_avg;

  // STEP 7: Market inefficiency — DataGolf sees materially better odds than books
  const marketEdge = detectMarketEdge(winProb, winOdds);
  if (marketEdge !== 0) {
    ev = ev * (1 + marketEdge);
  }

  return ev;
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Auto-complete any tournaments whose end_date has passed — mirrors current-tournament logic
    const today = new Date().toISOString().split('T')[0];
    await query(
      `UPDATE tournaments SET is_completed = true WHERE end_date < $1 AND is_completed = false`,
      [today]
    );

    // Ensure used_in_tournament_id is accurate — repairs any rows wiped by a previous
    // DELETE-based sync. Idempotent: only touches players whose flag is currently NULL.
    await query(`
      UPDATE players p
      SET used_in_tournament_id = pk.tournament_id,
          used_in_week          = t.week_number
      FROM picks pk
      JOIN tournaments t ON pk.tournament_id = t.id
      WHERE p.name = pk.player_name
        AND p.used_in_tournament_id IS NULL
    `);

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

    // ── Weather data (best-effort, non-blocking) ──────────────────────────
    let weatherData: { maxWind: number; maxPrecip: number; avgTemp: number } | null = null;
    try {
      if (tournament.latitude && tournament.longitude) {
        const startDate = tournament.start_date.split('T')[0];
        const endDate   = addDays(startDate, 3);
        const wRes = await fetch(
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${tournament.latitude}&longitude=${tournament.longitude}` +
          `&daily=temperature_2m_max,precipitation_probability_max,windspeed_10m_max` +
          `&start_date=${startDate}&end_date=${endDate}` +
          `&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=auto`,
          { cache: 'no-store' }
        );
        if (wRes.ok) {
          const wData = await wRes.json();
          const daily = wData.daily;
          weatherData = {
            maxWind:   Math.max(...(daily.windspeed_10m_max            ?? [0])),
            maxPrecip: Math.max(...(daily.precipitation_probability_max ?? [0])),
            avgTemp:   (daily.temperature_2m_max ?? [70]).reduce((a: number, b: number) => a + b, 0)
                       / (daily.temperature_2m_max?.length || 1),
          };
        }
      }
    } catch {
      // Weather unavailable — EV proceeds without weather adjustment
    }

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
    const allEnrichment = await query('SELECT * FROM player_enrichment_cache');
    const enrichmentMap = new Map();
    allEnrichment.forEach((e: any) => enrichmentMap.set(e.dg_id, e));

    // Fetch form data (optional)
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

    // Fetch course history summary for current tournament (optional)
    const courseHistoryMap = new Map<number, any>();
    try {
      const chRows = await query(
        `SELECT dg_id, times_played, times_made_cut, cut_percentage, average_finish, best_finish
         FROM course_performance_summary
         WHERE event_id = $1`,
        [tournament.id]
      );
      chRows.forEach((r: any) => courseHistoryMap.set(Number(r.dg_id), r));
    } catch {
      // course_performance_summary table not yet created
    }

    // Fetch field, odds, probabilities, and DFS salaries
    const noStore = { cache: 'no-store' } as const;
    const [fieldResponse, oddsResponse, probabilitiesResponse, dfsResponse] = await Promise.all([
      fetch(`https://feeds.datagolf.com/field-updates?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`, noStore),
      fetch(`https://feeds.datagolf.com/betting-tools/outrights?tour=pga&market=win&odds_format=american&file_format=json&key=${process.env.DATAGOLF_API_KEY}`, noStore),
      fetch(`https://feeds.datagolf.com/preds/pre-tournament?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`, noStore),
      fetch(`https://feeds.datagolf.com/preds/fantasy-projection-defaults?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`, noStore),
    ]);

    const fieldData          = await fieldResponse.json();
    const oddsData           = await oddsResponse.json();
    const probabilitiesData  = await probabilitiesResponse.json();
    const dfsData            = await dfsResponse.json();

    const dbPlayers         = await query('SELECT * FROM players ORDER BY datagolf_rank ASC');
    const currentField      = fieldData.field || [];
    const currentOdds       = oddsData.odds || [];
    const probabilities     = probabilitiesData.baseline || [];              // fallback
    const probabilitiesCourseFit = probabilitiesData.baseline_history_fit || []; // primary
    const dfsProjections    = dfsData.projections || [];

    const preliminaryRecs: any[] = [];

    for (const fieldPlayer of currentField) {
      const dbPlayer    = dbPlayers.find((p: any) => p.dg_id === fieldPlayer.dg_id);
      const playerName  = dbPlayer?.name || fieldPlayer.player_name;
      const playerOwgr  = dbPlayer?.owgr_rank || fieldPlayer.owgr_rank;
      const playerDgRank = dbPlayer?.datagolf_rank || 999;
      const playerTier  = dbPlayer?.tier || calculateTier(playerOwgr);
      const isUsed      = dbPlayer?.used_in_tournament_id != null;
      const usedWeek    = dbPlayer?.used_in_week;

      const playerOdds         = currentOdds.find((o: any) => o.dg_id === fieldPlayer.dg_id);
      const playerProb         = probabilities.find((p: any) => p.dg_id === fieldPlayer.dg_id);
      const playerProbCourseFit = probabilitiesCourseFit.find((p: any) => p.dg_id === fieldPlayer.dg_id);
      const playerDfs          = dfsProjections.find((d: any) => d.dg_id === fieldPlayer.dg_id);

      // At minimum we need some probability data
      if (!playerProb && !playerProbCourseFit) continue;

      // Prefer bet365 → William Hill → FanDuel → DraftKings → BetMGM → Caesars → Bovada → DG models
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

      const enrichData = enrichmentMap.get(fieldPlayer.dg_id);
      const formData   = formMap.get(fieldPlayer.dg_id);

      // EV calculation — uses baseline_history_fit as primary (already course-adjusted)
      const ev = calculateEnhancedEV(
        playerProbCourseFit,          // primary: course-fit-adjusted probs from DataGolf
        playerProb,                   // fallback: baseline probs
        tournament.purse,
        tournament.multiplier,
        formData?.form_score ?? null, // recent form (not in DataGolf model)
        enrichData,                   // SG stats for weather + market edge
        winOdds ?? null,              // betting odds for market inefficiency detection
        weatherData                   // tournament weather for conditions adjustment
      );

      // Expose the probabilities that were actually used in EV
      const activeProb = playerProbCourseFit || playerProb;

      preliminaryRecs.push({
        name:                  playerName,
        dg_id:                 fieldPlayer.dg_id,
        tier:                  playerTier,
        owgr_rank:             playerOwgr || 999,
        datagolf_rank:         playerDgRank,
        win_odds:              winOdds,
        win_probability:       activeProb?.win      || 0,
        top_5_probability:     activeProb?.top_5    || 0,
        top_10_probability:    activeProb?.top_10   || 0,
        top_20_probability:    activeProb?.top_20   || 0,
        make_cut_probability:  activeProb?.make_cut || 0,
        dk_salary:             playerDfs?.salary,
        course_fit:            playerProbCourseFit?.win || undefined,
        is_used:               isUsed,
        used_week:             usedWeek,
        ev,
        ranking_score:         ev,
        enrichment: enrichData ? {
          course_history_adj: enrichData.course_history_adjustment,
          course_fit_adj:     enrichData.course_fit_adjustment,
          sg_ott:             enrichData.sg_ott,
          sg_app:             enrichData.sg_app,
          sg_arg:             enrichData.sg_arg,
          sg_putt:            enrichData.sg_putt,
          sg_total:           enrichData.sg_total,
          driving_acc:        enrichData.driving_acc,
          driving_dist:       enrichData.driving_dist,
          baseline_pred:      enrichData.baseline_pred,
          final_pred:         enrichData.final_pred,
        } : null,
        form: (() => {
          const f = formMap.get(fieldPlayer.dg_id);
          if (!f) return null;
          return {
            score:              Number(f.form_score),
            category:           f.form_category,
            top_10_last_5:      Number(f.top_10_last_5),
            missed_cuts_last_5: Number(f.missed_cuts_last_5),
            withdrawals_last_5: Number(f.withdrawals_last_5),
            last_5_results:     f.last_5_results || [],
          };
        })(),
        course_history: (() => {
          const ch = courseHistoryMap.get(fieldPlayer.dg_id);
          if (!ch || !ch.times_played) return null;
          return {
            times_played:    Number(ch.times_played),
            times_made_cut:  Number(ch.times_made_cut),
            cut_percentage:  Number(ch.cut_percentage),
            average_finish:  ch.average_finish  ? Number(ch.average_finish)  : null,
            best_finish:     ch.best_finish     ? Number(ch.best_finish)     : null,
          };
        })(),
      });
    }

    // Sort all by EV and assign each player their true field rank
    const sortedRecs = preliminaryRecs
      .sort((a, b) => b.ranking_score - a.ranking_score)
      .slice(0, 60);
    sortedRecs.forEach((r, i) => { r.field_rank = i + 1; });

    // Top 20 in natural EV order — used players remain in place (greyed out in UI)
    const top20 = sortedRecs.slice(0, 20);

    // Pull unused fill-ins from beyond position 20 to compensate for used picks in top 20
    const usedInTop20Count = top20.filter(r => r.is_used).length;
    const fillIns = sortedRecs.slice(20).filter(r => !r.is_used).slice(0, usedInTop20Count);
    fillIns.forEach(r => { r.is_fill_in = true; });

    // Tier labels based on rank among ALL available players
    let availRank = 0;
    const availRankMap = new Map<number, number>();
    sortedRecs.forEach(r => { if (!r.is_used) availRankMap.set(r.dg_id, availRank++); });

    function getRecTier(rank: number): { tier: string; reasoning: string } {
      if (rank < 3)  return { tier: 'TOP PICK',     reasoning: 'Highest value with elite course fit' };
      if (rank < 8)  return { tier: 'STRONG VALUE', reasoning: 'Excellent value with strong upside' };
      if (rank < 15) return { tier: 'PLAYABLE',     reasoning: 'Solid option worth considering' };
      return             { tier: 'VALUE PLAY',   reasoning: 'Ranked by expected value with course fit adjustments' };
    }

    const recommendations: PlayerRecommendation[] = [...top20, ...fillIns].map(player => {
      if (player.is_used) {
        return {
          ...player,
          recommendation_score: player.ranking_score,
          recommendation_tier:  'USED',
          reasoning:            `Already used — Week ${player.used_week}`,
        };
      }
      const rank = availRankMap.get(player.dg_id) ?? 99;
      const { tier, reasoning } = getRecTier(rank);
      return {
        ...player,
        recommendation_score: player.ranking_score,
        recommendation_tier:  tier,
        reasoning,
      };
    });

    // Course specialists: composite score (Bayesian cut rate + log appearances + inverse avg finish)
    let courseSpecialists: any[] = [];
    try {
      courseSpecialists = await query(
        `SELECT dg_id, player_name, times_played, times_made_cut, cut_percentage,
                average_finish, best_finish,
                (times_made_cut::float / (times_played + 1.5)) * 50
                  + LN(times_played + 1) * 15
                  + COALESCE((1.0 / NULLIF(average_finish::float, 0)) * 35, 0)
                AS course_score
         FROM course_performance_summary
         WHERE event_id = $1 AND times_played >= 1
         ORDER BY course_score DESC
         LIMIT 15`,
        [tournament.id]
      );
    } catch {
      // course_performance_summary table not yet created
    }

    return NextResponse.json({
      tournament: {
        name:       tournament.event_name,
        course:     tournament.course_name,
        week:       tournament.week_number,
        purse:      tournament.purse,
        multiplier: tournament.multiplier,
        segment:    tournament.segment,
        event_id:   tournament.id,
      },
      next_major:       upcomingMajors?.[0] || null,
      top_picks:        recommendations,
      total_in_field:   preliminaryRecs.length,
      course_specialists: courseSpecialists.map((s: any) => ({
        dg_id:          Number(s.dg_id),
        player_name:    s.player_name,
        times_played:   Number(s.times_played),
        times_made_cut: Number(s.times_made_cut),
        cut_percentage: Number(s.cut_percentage),
        average_finish: s.average_finish ? Number(s.average_finish) : null,
        best_finish:    s.best_finish    ? Number(s.best_finish)    : null,
      })),
    });

  } catch (error) {
    console.error('Recommendations error:', error);
    return NextResponse.json({
      error: 'Failed to generate recommendations',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
