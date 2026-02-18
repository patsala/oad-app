import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { players, tournament, context } = await request.json();
    
    if (!players || players.length === 0) {
      return NextResponse.json({ narratives: {}, tiers: {} });
    }
    
    // Build rich context for each player
    const enrichedPlayerDescriptions = players.map((p: any, i: number) => {
      const enrichment = p.enrichment || {};
      
      // Identify elite skills
      const eliteSkills = [];
      if (enrichment.sg_putt > 0.4) eliteSkills.push('Elite Putter');
      if (enrichment.sg_app > 0.8) eliteSkills.push('Elite Ball-Striker');
      if (enrichment.sg_ott > 0.6) eliteSkills.push('Elite Off-the-Tee');
      if (enrichment.sg_arg > 0.3) eliteSkills.push('Elite Scrambler');
      
      // Identify strengths and weaknesses
      const skills = [
        { name: 'Putting', value: enrichment.sg_putt || 0 },
        { name: 'Approach', value: enrichment.sg_app || 0 },
        { name: 'Off-the-Tee', value: enrichment.sg_ott || 0 },
        { name: 'Short Game', value: enrichment.sg_arg || 0 }
      ].sort((a, b) => b.value - a.value);
      
      const topSkill = skills[0];
      const weakSkill = skills[skills.length - 1];
      
      // Course fit analysis
      const courseHistBoost = enrichment.course_history_adj 
        ? ((enrichment.course_history_adj * 100).toFixed(1) + '% course history boost')
        : 'no course history data';
      
      const courseFitAdj = enrichment.course_fit_adj 
        ? ((enrichment.course_fit_adj * 100).toFixed(1) + '% fit adjustment')
        : 'neutral course fit';
      
      return `
${i+1}. ${p.name} (${p.tier}, World #${p.owgr_rank})
   Win Odds: +${p.win_odds} | Win Prob: ${(p.win_probability * 100).toFixed(1)}%
   Top 5: ${(p.top_5_probability * 100).toFixed(1)}% | Top 10: ${(p.top_10_probability * 100).toFixed(1)}%
   Expected Value: $${(p.recommendation_score / 1000).toFixed(0)}k
   
   SKILL PROFILE:
   - Overall SG: ${enrichment.sg_total ? enrichment.sg_total.toFixed(2) : 'N/A'} strokes/round
   - Strongest: ${topSkill.name} (${topSkill.value > 0 ? '+' : ''}${topSkill.value.toFixed(2)} SG)
   - Weakest: ${weakSkill.name} (${weakSkill.value > 0 ? '+' : ''}${weakSkill.value.toFixed(2)} SG)
   ${eliteSkills.length > 0 ? '- Elite Skills: ' + eliteSkills.join(', ') : ''}
   
   COURSE FIT:
   - ${courseHistBoost}
   - ${courseFitAdj}
   - Baseline prediction: ${enrichment.baseline_pred ? enrichment.baseline_pred.toFixed(2) : 'N/A'} SG
   - Course-adjusted: ${enrichment.final_pred ? enrichment.final_pred.toFixed(2) : 'N/A'} SG
`;
    }).join('\n');
    
    const prompt = `You are an elite PGA Tour analyst with access to advanced strokes-gained data. Write strategic 2-3 sentence analyses for each player.

TOURNAMENT: ${tournament}
${context ? `Week ${context.week_number}/28 | Next Major: ${context.next_major ? context.next_major.name + ' (' + context.next_major.weeks_away + 'w)' : 'None soon'}` : ''}

PLAYERS WITH FULL DATA:
${enrichedPlayerDescriptions}

ANALYSIS FRAMEWORK:
1. **Skill Match**: Does this player's elite skills (putting, approach, driving) match what THIS course demands?
2. **Course History**: How does their course history adjustment (+/- strokes) impact their value?
3. **Strategic Value**: Given their tier, odds, and probabilities, is this the right week to use them?
4. **Form Indicators**: What do their baseline vs adjusted predictions tell us about current form?

CRITICAL INSTRUCTIONS:
- Use the SPECIFIC strokes-gained data provided (e.g., "+1.18 SG Approach")
- Reference course history boosts (e.g., "+10.8% course history advantage")
- Compare skill strengths to course demands (accuracy vs distance)
- Assess VALUE: do the odds match the probability? (e.g., 19% win prob at +421 is great value)
- Be SPECIFIC about numbers, not generic

For each player provide:
1. Concise 2-3 sentence strategic analysis using the data
2. Recommendation tier: TOP PICK, STRONG VALUE, SAVE FOR LATER, PLAYABLE, or LONGSHOT

Response format (valid JSON, no markdown):
{
  "narratives": {
    "${players[0].dg_id}": "Your specific, data-driven analysis...",
    ...
  },
  "tiers": {
    "${players[0].dg_id}": "TOP PICK",
    ...
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
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      console.error('Claude API error:', response.status, await response.text());
      return NextResponse.json({ narratives: {}, tiers: {} });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '{"narratives":{},"tiers":{}}';
    
    const cleanText = rawText.replace(/```json\n?|```\n?/g, '').trim();
    const result = JSON.parse(cleanText);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Narrative generation error:', error);
    return NextResponse.json({ narratives: {}, tiers: {} });
  }
}