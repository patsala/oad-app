import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { 
      player, 
      tournament, 
      segment_standings, 
      used_players, 
      upcoming_majors,
      week_number 
    } = await request.json();
    
    const prompt = `You are a strategic golf pool analyst. Analyze this player for a One & Done pool and provide a recommendation tier.

POOL RULES:
- 28 tournaments, pick ONE player per tournament, can't reuse players
- Majors have 1.5x multiplier (Masters, PGA, US Open, British Open)
- 7 tournaments per segment (Q1-Q4), segment winner gets $1,100 bonus
- 148 entries, $22,200 total pot

CURRENT CONTEXT:
Week: ${week_number}/28
Current Tournament: ${tournament.name} (${tournament.event_type}, ${tournament.multiplier}x multiplier, ${tournament.segment})
Segment: ${tournament.segment}
Segment Standings: ${JSON.stringify(segment_standings)}

PLAYER DATA:
Name: ${player.name}
Tier: ${player.tier} (OWGR #${player.owgr_rank})
Win Odds: +${player.win_odds}
Win Probability: ${(player.win_probability * 100).toFixed(1)}%
Top 5 Probability: ${(player.top_5_probability * 100).toFixed(1)}%
Top 10 Probability: ${(player.top_10_probability * 100).toFixed(1)}%
Expected Value: $${(player.ev / 1000).toFixed(1)}k
DK Salary: $${player.dk_salary ? (player.dk_salary / 1000).toFixed(1) + 'K' : 'N/A'}
Course Fit: ${player.course_fit ? ((player.course_fit - 1) * 100).toFixed(0) + '% vs baseline' : 'Unknown'}

ALREADY USED (can't pick again):
${used_players.map((p: any) => `- ${p.name} (${p.tier}) - Week ${p.week}`).join('\n')}

UPCOMING SCHEDULE:
${upcoming_majors.map((m: any) => `- ${m.name} (Week ${m.week}, ${m.weeks_away} weeks away)`).join('\n')}

STRATEGIC CONSIDERATIONS:
1. Save Elite players (Scheffler, McIlroy, etc.) for majors with 1.5x multiplier
2. Consider segment positioning - can we win this segment?
3. Prioritize high EV plays when saving elites
4. Balance immediate value vs future flexibility
5. Don't waste tier 1/2 players on regular events if better options exist

RECOMMENDATION TIERS:
- ELITE PLAY: Must-pick elite player this week (rare - only for perfect storm)
- TOP PICK: Best available value this week, high confidence
- STRONG VALUE: Excellent play with good upside
- PLAYABLE: Solid option worth considering
- SAVE FOR LATER: Good player but better used later in season
- AVOID: Poor value or strategic misfit

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{
  "tier": "TOP PICK",
  "reasoning": "One sentence explaining why."
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        messages: [
          { role: "user", content: prompt }
        ],
      })
    });

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '{"tier":"PLAYABLE","reasoning":"Analysis unavailable"}';
    
    // Parse JSON response
    const recommendation = JSON.parse(rawText.trim());
    
    return NextResponse.json(recommendation);
    
  } catch (error) {
    console.error('Recommendation generation error:', error);
    return NextResponse.json({ 
      tier: 'PLAYABLE',
      reasoning: 'Analysis unavailable'
    });
  }
}