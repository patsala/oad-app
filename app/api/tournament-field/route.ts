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
    
    // Get odds for the field
    const oddsResponse = await fetch(
      `https://feeds.datagolf.com/betting-tools/outrights?tour=pga&market=win&odds_format=american&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
    );
    
    const oddsData = await oddsResponse.json();
    
    // Combine field with odds
    const field = (fieldData.field || []).map((player: any) => {
      const playerOdds = oddsData.odds?.find((o: any) => o.dg_id === player.dg_id);
      
      return {
        name: player.player_name,
        dg_id: player.dg_id,
        owgr: player.owgr_rank,
        country: player.country,
        win_odds: playerOdds?.datagolf?.baseline ? 
          parseInt(playerOdds.datagolf.baseline.replace('+', '')) : null
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