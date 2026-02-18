import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      players,
      tournament, 
      segment_standings, 
      used_players, 
      upcoming_majors,
      week_number 
    } = body;
    
    // Validation
    if (!players || !tournament || !tournament.name) {
      console.error('Missing required fields:', { players: !!players, tournament, week_number });
      return NextResponse.json({ recommendations: {} });
    }
    
    const prompt = `You are a strategic golf pool analyst. Analyze these ${players.length} players for a One & Done pool.

POOL RULES:
- 28 tournaments, pick ONE player per tournament, can't reuse players
- Majors have 1.5x multiplier
- 7 tournaments per segment (Q1-Q4), segment winner gets $1,100 bonus
- 148 entries, $22,200 pot

CURRENT CONTEXT:
Week: ${week_number}/28
Tournament: ${tournament.name} (${tournament.event_type || 'Regular'}, ${tournament.multiplier || 1.0}x, ${tournament.segment || 'Q1'})
Segment Standings: ${JSON.stringify(segment_standings || [])}

ALREADY USED: ${(used_players || []).map((p: any) => `${p.name} (${p.tier})`).join(', ') || 'None'}

UPCOMING MAJORS: ${(upcoming_majors || []).map((m: any) => `${m.name} (${m.weeks_away}w)`).join(', ') || 'None'}

PLAYERS TO ANALYZE:
${players.map((p: any, i: number) => `${i+1}. ${p.name} (${p.tier}, #${p.owgr_rank} OWGR, +${p.win_odds} odds, ${(p.win_probability*100).toFixed(1)}% win, $${(p.ev/1000).toFixed(0)}k EV)`).join('\n')}

TIERS:
- ELITE PLAY: Must-pick (rare)
- TOP PICK: Best value this week
- STRONG VALUE: Excellent option
- PLAYABLE: Solid choice
- SAVE FOR LATER: Use in future
- AVOID: Poor fit

Respond ONLY with valid JSON (no markdown):
{
  "recommendations": {
    "18417": {"tier": "TOP PICK", "reasoning": "One sentence."}
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
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      console.error('Claude API error:', response.status, await response.text());
      return NextResponse.json({ recommendations: {} });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '{}';
    const result = JSON.parse(rawText.replace(/```json\n?|```\n?/g, '').trim());
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Recommendation error:', error);
    return NextResponse.json({ recommendations: {} });
  }
}