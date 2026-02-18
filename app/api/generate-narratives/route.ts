import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { players, tournament, context } = await request.json();
    
    if (!players || players.length === 0) {
      return NextResponse.json({ narratives: {}, tiers: {} });
    }
    
    const prompt = `You are an elite golf analyst with deep knowledge of course history, weather impacts, and player form. For each player, write a 3-5 sentence strategic analysis.

Tournament: ${tournament}
${context ? `Week ${context.week_number}/28 | Next Major: ${context.next_major ? context.next_major.name + ' (' + context.next_major.weeks_away + 'w)' : 'None soon'}` : ''}

Focus your analysis on:
- Recent tournament performance and current form trajectory
- Historical performance at THIS specific course/venue
- How weather conditions (wind, rain, temperature) might favor/hurt this player based on their game style
- Course fit based on player strengths (accuracy vs distance, scrambling, putting on similar greens)
- Strategic value: Should they be used this week or saved for later based on upcoming schedule?

Players to analyze:
${players.map((p: any, i: number) => `
${i+1}. ${p.name} (${p.tier}, World #${p.owgr_rank})
Win Probability: ${(p.win_probability * 100).toFixed(1)}% | Top 5: ${(p.top_5_probability * 100).toFixed(1)}% | Top 10: ${(p.top_10_probability * 100).toFixed(1)}%
Odds: +${p.win_odds} | Course Fit vs Baseline: ${p.course_fit ? ((p.course_fit - 1) * 100).toFixed(0) + '%' : 'Unknown'}
Expected Value: $${(p.recommendation_score / 1000).toFixed(0)}k
`).join('\n')}

For each player, provide:
1. A 2-3 sentence holistic analysis (course history, weather fit, form, strategic timing)
2. A recommendation: TOP PICK, STRONG VALUE, SAVE FOR LATER, PLAYABLE, or LONGSHOT

Be specific about WHY this week makes sense (or doesn't) for using this player.

Respond with valid JSON (no markdown):
{
  "narratives": {
    "${players[0].dg_id}": "Your analysis here...",
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
    
    // Parse JSON, removing markdown fences if present
    const cleanText = rawText.replace(/```json\n?|```\n?/g, '').trim();
    const result = JSON.parse(cleanText);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Narrative generation error:', error);
    return NextResponse.json({ narratives: {}, tiers: {} });
  }
}