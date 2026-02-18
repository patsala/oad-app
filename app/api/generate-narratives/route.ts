import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { players, tournament } = await request.json();
    
    // Generate narratives for all players in one batch
    const narratives: { [key: number]: string } = {};
    
    for (const player of players) {
      const prompt = `You are a professional golf analyst. Write a concise 2-3 sentence analysis for ${player.name} playing in ${tournament}.

Data:
- Tier: ${player.tier}, OWGR: #${player.owgr_rank}
- Win odds: +${player.win_odds} (${(player.win_probability * 100).toFixed(1)}% probability)
- Top 5: ${(player.top_5_probability * 100).toFixed(1)}%, Top 10: ${(player.top_10_probability * 100).toFixed(1)}%
- DK Salary: $${player.dk_salary ? (player.dk_salary / 1000).toFixed(1) + 'K' : 'N/A'}
- Course fit: ${player.course_fit ? ((player.course_fit - 1) * 100).toFixed(0) + '% vs baseline' : 'Unknown'}

Focus on: value assessment, course fit implications, and strategic recommendation. Be specific and actionable. No preamble.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY || "",
    "anthropic-version": "2023-06-01"
  },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 150,
          messages: [
            { role: "user", content: prompt }
          ],
        })
      });

      const data = await response.json();
      const narrative = data.content?.[0]?.text || "Analysis unavailable.";
      
      narratives[player.dg_id] = narrative;
    }
    
    return NextResponse.json({ narratives });
    
  } catch (error) {
    console.error('Narrative generation error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate narratives',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}