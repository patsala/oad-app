import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    // Get current tournament field from DataGolf
    const fieldResponse = await fetch(
      `https://feeds.datagolf.com/field-updates?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
    );
    
    const fieldData = await fieldResponse.json();
    
    // Get odds, probabilities, and DFS data for the field
    const [oddsResponse, probabilitiesResponse, dfsResponse] = await Promise.all([
      fetch(`https://feeds.datagolf.com/betting-tools/outrights?tour=pga&market=win&odds_format=american&file_format=json&key=${process.env.DATAGOLF_API_KEY}`),
      fetch(`https://feeds.datagolf.com/preds/pre-tournament?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`),
      fetch(`https://feeds.datagolf.com/preds/fantasy-projection-defaults?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`)
    ]);

    const oddsData = await oddsResponse.json();
    const probabilitiesData = await probabilitiesResponse.json();
    const dfsData = await dfsResponse.json();

    const probabilities = probabilitiesData.baseline || [];
    const dfsProjections = dfsData.projections || [];

    // Combine field with odds, probabilities, and DFS
    const field = (fieldData.field || []).map((player: any) => {
      const playerOdds = oddsData.odds?.find((o: any) => o.dg_id === player.dg_id);
      const playerProb = probabilities.find((p: any) => p.dg_id === player.dg_id);
      const playerDfs = dfsProjections.find((d: any) => d.dg_id === player.dg_id);

      return {
        name: player.player_name,
        dg_id: player.dg_id,
        owgr: player.owgr_rank,
        country: player.country,
        // Prefer DraftKings odds, fall back to DataGolf model odds
        win_odds: playerOdds?.draftkings
          ? parseInt(String(playerOdds.draftkings).replace('+', ''))
          : playerOdds?.datagolf?.baseline
            ? parseInt(playerOdds.datagolf.baseline.replace('+', ''))
            : null,
        win_probability: playerProb?.win || null,
        make_cut_probability: playerProb?.make_cut || null,
        dk_salary: playerDfs?.salary || null
      };
    }).sort((a: any, b: any) => (a.owgr || 999) - (b.owgr || 999));
    
    return NextResponse.json({
      event_name: fieldData.event_name,
      course: fieldData.course_name,
      field
    });
    
  } catch (error) {
    console.error('Field fetch error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch field',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}