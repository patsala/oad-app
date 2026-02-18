interface DataGolfPlayer {
  player_name: string;
  dg_id: number;
  datagolf_rank: number;
  owgr: number;
  country: string;
  amateur: boolean;
}

interface DataGolfField {
  event_name: string;
  players: Array<{
    player_name: string;
    dg_id: number;
    owgr?: number;
    baseline_history_fit?: number;
    event_odds?: {
      win?: number;
      top_5?: number;
      top_10?: number;
      top_20?: number;
    };
  }>;
}

const DATAGOLF_BASE_URL = 'https://feeds.datagolf.com';

export async function getFieldForTournament(tournamentId: string) {
  const response = await fetch(
    `${DATAGOLF_BASE_URL}/field-updates?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch field data from DataGolf');
  }
  
  return await response.json();
}

export async function getPlayerRankings() {
  const response = await fetch(
    `${DATAGOLF_BASE_URL}/preds/get-dg-rankings?file_format=json&key=${process.env.DATAGOLF_API_KEY}`
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch rankings from DataGolf');
  }
  
  return await response.json();
}

export async function getEventOdds(eventId?: string) {
  const url = eventId 
    ? `${DATAGOLF_BASE_URL}/betting-tools/outrights?tour=pga&market=win&odds_format=american&file_format=json&key=${process.env.DATAGOLF_API_KEY}&event_id=${eventId}`
    : `${DATAGOLF_BASE_URL}/betting-tools/outrights?tour=pga&market=win&odds_format=american&file_format=json&key=${process.env.DATAGOLF_API_KEY}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error('Failed to fetch odds from DataGolf');
  }
  
  return await response.json();
}

// Auto-calculate tier based on OWGR
export function calculateTier(owgr: number): string {
  if (owgr <= 10) return 'Elite';
  if (owgr <= 30) return 'Tier 1';
  if (owgr <= 75) return 'Tier 2';
  return 'Tier 3';
}