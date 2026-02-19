import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { players, tournament, context } = await request.json();

    if (!players || players.length === 0) {
      return NextResponse.json({ narratives: {}, tiers: {} });
    }

    // Fetch upcoming schedule from DB for strategic context
    const upcomingTournaments = await query(
      `SELECT event_name, week_number, purse, multiplier, event_type, segment, course_name
       FROM tournaments
       WHERE is_completed = false
       ORDER BY week_number ASC
       LIMIT 12`
    );

    // Fetch all upcoming majors and signature events
    const bigEvents = await query(
      `SELECT event_name, week_number, purse, multiplier, event_type, course_name
       FROM tournaments
       WHERE is_completed = false
         AND (event_type = 'Major' OR event_type = 'Signature')
       ORDER BY week_number ASC`
    );

    // Fetch used players with their tiers for strategic context
    const usedPlayers = await query(
      `SELECT p.name, p.tier, p.used_in_week
       FROM players p
       WHERE p.used_in_tournament_id IS NOT NULL
       ORDER BY p.used_in_week ASC`
    );

    // Count remaining available players by tier
    const tierCounts = await query(
      `SELECT tier, COUNT(*) as total,
              COUNT(CASE WHEN used_in_tournament_id IS NULL THEN 1 END) as available
       FROM players
       GROUP BY tier
       ORDER BY tier`
    );

    // Segment standings for strategic context
    const standings = await query(
      'SELECT * FROM segment_standings ORDER BY segment ASC'
    );

    const currentWeek = context?.week_number || 1;
    const weeksRemaining = 28 - currentWeek;
    const currentSegment = context?.segment || upcomingTournaments[0]?.segment || 'Q1';

    // Build schedule lookahead
    const scheduleLookahead = bigEvents.map((t: any) =>
      `  - Week ${t.week_number}: ${t.event_name} (${t.event_type}, $${(t.purse / 1000000).toFixed(1)}M${t.multiplier > 1 ? `, ${t.multiplier}x multiplier` : ''})${t.course_name ? ` at ${t.course_name}` : ''}`
    ).join('\n');

    // Build used players summary
    const usedSummary = usedPlayers.length > 0
      ? usedPlayers.map((p: any) => `  - ${p.name} (${p.tier}) — used Week ${p.used_in_week}`).join('\n')
      : '  None yet';

    // Build tier availability
    const tierAvailability = tierCounts.map((t: any) =>
      `  - ${t.tier}: ${t.available}/${t.total} remaining`
    ).join('\n');

    // Build rich context for each player
    const enrichedPlayerDescriptions = players.map((p: any, i: number) => {
      const raw = p.enrichment || {};
      const enrichment = {
        sg_putt: Number(raw.sg_putt) || 0,
        sg_app: Number(raw.sg_app) || 0,
        sg_ott: Number(raw.sg_ott) || 0,
        sg_arg: Number(raw.sg_arg) || 0,
        sg_total: Number(raw.sg_total) || 0,
        course_history_adj: Number(raw.course_history_adj) || 0,
        course_fit_adj: Number(raw.course_fit_adj) || 0,
        baseline_pred: Number(raw.baseline_pred) || 0,
        final_pred: Number(raw.final_pred) || 0,
      };

      const skills = [
        { name: 'Putting', value: enrichment.sg_putt },
        { name: 'Approach', value: enrichment.sg_app },
        { name: 'Off-the-Tee', value: enrichment.sg_ott },
        { name: 'Short Game', value: enrichment.sg_arg }
      ].sort((a, b) => b.value - a.value);

      const topSkill = skills[0];
      const weakSkill = skills[skills.length - 1];

      // Form indicator: compare baseline (pure skill) vs final (course-adjusted)
      const formDelta = enrichment.final_pred && enrichment.baseline_pred
        ? enrichment.final_pred - enrichment.baseline_pred
        : 0;
      const formSignal = formDelta > 0.3 ? 'STRONG COURSE BOOST'
        : formDelta > 0 ? 'slight course boost'
        : formDelta < -0.3 ? 'POOR COURSE FIT'
        : formDelta < 0 ? 'slight course headwind'
        : 'neutral';

      // Value assessment
      const impliedProb = p.win_odds ? 1 / (p.win_odds / 100 + 1) : null;
      const actualProb = Number(p.win_probability);
      const valueEdge = impliedProb && actualProb
        ? ((actualProb / impliedProb - 1) * 100).toFixed(0)
        : null;

      return `
${i+1}. ${p.name} (${p.tier}, World #${p.owgr_rank}, DG Rank #${p.datagolf_rank || 'N/A'})
   ODDS & PROBABILITIES:
   - DK Odds: +${p.win_odds} | Model Win Prob: ${(actualProb * 100).toFixed(1)}%${valueEdge ? ` | Value Edge: ${Number(valueEdge) > 0 ? '+' : ''}${valueEdge}% vs odds` : ''}
   - Top 5: ${(Number(p.top_5_probability) * 100).toFixed(1)}% | Top 10: ${(Number(p.top_10_probability) * 100).toFixed(1)}% | Top 20: ${(Number(p.top_20_probability) * 100).toFixed(1)}%
   - Make Cut: ${(Number(p.make_cut_probability) * 100).toFixed(0)}%
   - Expected Value: $${(Number(p.ev || p.recommendation_score) / 1000).toFixed(0)}k

   SKILL PROFILE (Strokes Gained per round):
   - Total: ${enrichment.sg_total ? (enrichment.sg_total > 0 ? '+' : '') + enrichment.sg_total.toFixed(2) : 'N/A'}
   - Off-the-Tee: ${enrichment.sg_ott ? (enrichment.sg_ott > 0 ? '+' : '') + enrichment.sg_ott.toFixed(2) : 'N/A'} | Approach: ${enrichment.sg_app ? (enrichment.sg_app > 0 ? '+' : '') + enrichment.sg_app.toFixed(2) : 'N/A'}
   - Around Green: ${enrichment.sg_arg ? (enrichment.sg_arg > 0 ? '+' : '') + enrichment.sg_arg.toFixed(2) : 'N/A'} | Putting: ${enrichment.sg_putt ? (enrichment.sg_putt > 0 ? '+' : '') + enrichment.sg_putt.toFixed(2) : 'N/A'}
   - Strongest: ${topSkill.name} (${topSkill.value > 0 ? '+' : ''}${topSkill.value.toFixed(2)}) | Weakest: ${weakSkill.name} (${weakSkill.value > 0 ? '+' : ''}${weakSkill.value.toFixed(2)})

   COURSE FIT & FORM:
   - Course History Adj: ${enrichment.course_history_adj ? (enrichment.course_history_adj > 0 ? '+' : '') + (enrichment.course_history_adj * 100).toFixed(1) + '%' : 'No history'}
   - Course Fit Adj: ${enrichment.course_fit_adj ? (enrichment.course_fit_adj > 0 ? '+' : '') + (enrichment.course_fit_adj * 100).toFixed(1) + '%' : 'Neutral'}
   - Baseline Prediction: ${enrichment.baseline_pred ? (enrichment.baseline_pred > 0 ? '+' : '') + enrichment.baseline_pred.toFixed(2) : 'N/A'} SG
   - Course-Adjusted Prediction: ${enrichment.final_pred ? (enrichment.final_pred > 0 ? '+' : '') + enrichment.final_pred.toFixed(2) : 'N/A'} SG
   - Form Signal: ${formSignal}
`;
    }).join('\n');

    const prompt = `You are a sharp, opinionated one-and-done golf pool strategist. Your audience is a savvy pool player who needs to decide whether to USE or SAVE each golfer THIS WEEK. Once a player is used, they cannot be picked again for the rest of the 28-week season.

POOL FORMAT: One-and-done. Pick one golfer per week. Each golfer can only be used ONCE all season. Earnings are tracked by segment (Q1-Q4, 7 events each) with segment winners getting paid, plus overall season earnings matter.

THIS WEEK: ${tournament} (Week ${currentWeek}/28, ${currentSegment})
Weeks Remaining: ${weeksRemaining}

UPCOMING MAJORS & SIGNATURE EVENTS:
${scheduleLookahead || '  None remaining'}

ALREADY USED PLAYERS:
${usedSummary}

TIER AVAILABILITY:
${tierAvailability}

${standings.length > 0 ? `CURRENT STANDINGS:\n${standings.map((s: any) => `  - ${s.segment}: $${(Number(s.total_earnings) / 1000).toFixed(0)}k earned, ${s.events_completed}/7 events completed`).join('\n')}` : ''}

PLAYER DATA:
${enrichedPlayerDescriptions}

ANALYSIS INSTRUCTIONS:
Write a 4-6 sentence strategic analysis for each player that addresses ALL of the following:

1. **RECENT FORM & SKILL FIT**: Is this player in good form right now? Look at their baseline prediction (pure skill ranking) vs course-adjusted prediction. A big positive delta means the course suits them. Reference their specific strokes-gained strengths and how they match this course. Use actual numbers.

2. **VALUE ASSESSMENT**: Compare their model win probability to their DraftKings odds. Is the market undervaluing them? A player with 8% model win probability at +2000 odds is a steal. A player with 15% probability at +500 is fairly priced. Be specific about the edge (or lack thereof).

3. **USE NOW vs SAVE FOR LATER — THIS IS THE MOST IMPORTANT PART**: This is where you earn your keep. Consider:
   - Does this player have a MAJOR or SIGNATURE event coming up where they historically dominate? If so, saving them might be smarter.
   - Is their course fit THIS WEEK unusually strong (big positive course history/fit adjustment)? If this is one of their best courses, that argues for using them NOW.
   - How many weeks remain? Early in the season you can afford to be patient. Late in the season, you need to pull the trigger.
   - What tier is this player? Elite/Tier 1 players should generally be saved for majors or signature events with multipliers unless the course fit is exceptional this week.
   - If this is a regular/low-purse event, is this player "too good" to waste here? Would a lower-tier player get the job done?

4. **THE VERDICT**: End with a clear, confident recommendation. Don't hedge. Either this is the week to use them, or it isn't. If saving, suggest WHEN to use them instead (name the specific event).

TONE: Write like a confident analyst who's putting their own money on the line. Be direct and specific. No generic filler like "solid player" or "could contend." Every sentence should contain actionable insight backed by data.

Response format (valid JSON, no markdown):
{
  "narratives": {
    "${players[0].dg_id}": "Your strategic analysis here...",
    ${players.length > 1 ? '...' : ''}
  },
  "tiers": {
    "${players[0].dg_id}": "USE NOW | STRONG VALUE | SAVE FOR LATER | PLAYABLE | LONGSHOT",
    ${players.length > 1 ? '...' : ''}
  }
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 6000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Claude API error: ${response.status}`, details: errorText },
        { status: 502 }
      );
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';

    if (!rawText) {
      return NextResponse.json(
        { error: 'Empty response from Claude API' },
        { status: 502 }
      );
    }

    const cleanText = rawText.replace(/```json\n?|```\n?/g, '').trim();
    const result = JSON.parse(cleanText);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Narrative generation error:', error);
    return NextResponse.json(
      { error: 'Narrative generation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
