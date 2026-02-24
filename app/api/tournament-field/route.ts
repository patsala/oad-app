import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    // Get current tournament field from DataGolf — no-store ensures fresh data every request
    const noStore = { cache: 'no-store' } as const;
    const fieldResponse = await fetch(
      `https://feeds.datagolf.com/field-updates?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`,
      noStore
    );
    
    const fieldData = await fieldResponse.json();

    // Field not yet posted for upcoming tournament
    if (!fieldData.field || fieldData.field.length === 0) {
      return NextResponse.json({
        event_name: fieldData.event_name || 'Upcoming Tournament',
        course: fieldData.course_name || null,
        field: [],
        note: 'Field not yet announced — check back closer to tournament start'
      });
    }

    // Get odds, probabilities, and DFS data for the field
    const [oddsResponse, probabilitiesResponse, dfsResponse] = await Promise.all([
      fetch(`https://feeds.datagolf.com/betting-tools/outrights?tour=pga&market=win&odds_format=american&file_format=json&key=${process.env.DATAGOLF_API_KEY}`, noStore),
      fetch(`https://feeds.datagolf.com/preds/pre-tournament?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`, noStore),
      fetch(`https://feeds.datagolf.com/preds/fantasy-projection-defaults?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`, noStore)
    ]);

    const [oddsData, probabilitiesData, dfsData] = await Promise.all([
      oddsResponse.ok ? oddsResponse.json() : { odds: [] },
      probabilitiesResponse.ok ? probabilitiesResponse.json() : { baseline: [] },
      dfsResponse.ok ? dfsResponse.json() : { projections: [] }
    ]);

    const probabilities: any[] = probabilitiesData.baseline || [];
    const dfsProjections: any[] = dfsData.projections || [];

    // Combine field with odds, probabilities, and DFS
    const field = (fieldData.field || []).map((player: any) => {
      const playerOdds = oddsData.odds?.find((o: any) => o.dg_id === player.dg_id);
      const playerProb = probabilities.find((p: any) => p.dg_id === player.dg_id);
      const playerDfs = dfsProjections.find((d: any) => d.dg_id === player.dg_id);

      // Prefer bet365 → William Hill → FanDuel → DraftKings → BetMGM → Caesars → Bovada → DG baseline → DG baseline_history_fit
      const parseOdds = (v: any) => v ? parseInt(String(v).replace('+', '')) || null : null;
      const win_odds = parseOdds(playerOdds?.bet365)
        ?? parseOdds(playerOdds?.williamhill)
        ?? parseOdds(playerOdds?.fanduel)
        ?? parseOdds(playerOdds?.draftkings)
        ?? parseOdds(playerOdds?.betmgm)
        ?? parseOdds(playerOdds?.caesars)
        ?? parseOdds(playerOdds?.bovada)
        ?? parseOdds(playerOdds?.betonline)
        ?? parseOdds(playerOdds?.datagolf?.baseline)
        ?? parseOdds(playerOdds?.datagolf?.baseline_history_fit)
        ?? null;

      return {
        name: player.player_name,
        dg_id: player.dg_id,
        owgr: player.owgr_rank,
        country: player.country,
        win_odds,
        win_probability: playerProb?.win ?? null,
        make_cut_probability: playerProb?.make_cut ?? null,
        dk_salary: playerDfs?.salary ?? null
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