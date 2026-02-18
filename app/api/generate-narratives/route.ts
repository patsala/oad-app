import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { players, tournament, context } = await request.json();
    
    if (!players || players.length === 0) {
      return NextResponse.json({ narratives: {}, tiers: {} });
    }
    
    // Generate narratives AND recommendation tiers in ONE call
    const prompt = `You are a strategic golf pool analyst. For each player below, provide:
1. A 2-3 sentence analysis focusing on value, course fit, and strategy
2. A recommendation tier: TOP PICK, STRONG VALUE, SAVE FOR LATER, PLAYABLE, or LONGSHOT

Tournament: ${tournament}
${context ? `
Week: ${context.week_number}/28
Next Major: ${context.next_major ? context.next_major.name + ' in ' + context.next_major.weeks_away + ' weeks' : 'None soon'}
Already Used: ${context.used_players?.length || 0} players
` : ''}

Players:
${players.map((p: any, i: number) => `
${i+1}. ${p.name} (${p.tier}, OWGR #${p.owgr_rank})
- Win: +${p.win_odds} (${(p.win_probability * 100).toFixed(1)}% prob)
- Top 5: ${(p.top_5_probability * 100).toFixed(1)}%, Top 10: ${(p.top_10_probability * 100).toFixed(1)}%
- DK Salary: $${p.dk_salary ? (p.dk_salary / 1000).toFixed(1) : 'N/A'}K
- Course Fit: ${p.course_fit ? ((p.course_fit - 1) * 100).toFixed(0) + '%' : 'Unknown'}
- Expected Value: $${(p.recommendation_score / 1000).toFixed(1)}k
`).join('\n')}

Respond ONLY with valid JSON (no markdown):
{
  "narratives": {
    "${players[0].dg_id}": "Your 2-3 sentence analysis...",
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