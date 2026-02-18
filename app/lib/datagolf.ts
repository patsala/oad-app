const DATAGOLF_BASE_URL = 'https://feeds.datagolf.com';

export interface DataGolfPlayer {
  player_name: string;
  dg_id: number;
  datagolf_rank: number;
  owgr: number;
  country: string;
  amateur: boolean;
}

export interface TournamentField {
  event_name: string;
  course: string;
  players: Array<{
    player_name: string;
    dg_id: number;
    owgr?: number;
    baseline_history_fit?: number;
    recent_form?: number;
  }>;
}

export interface EventOdds {
  event_name: string;
  market: string;
  odds: Array<{
    player_name: string;
    dg_id: number;
    win_odds: number;
    top_5_odds?: number;
    top_10_odds?: number;
    top_20_odds?: number;
  }>;
}

export async function getCurrentField() {
  const response = await fetch(
    `${DATAGOLF_BASE_URL}/field-updates?tour=pga&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch field data');
  }
  
  return await response.json();
}

export async function getEventOdds() {
  const response = await fetch(
    `${DATAGOLF_BASE_URL}/betting-tools/outrights?tour=pga&market=win&odds_format=american&file_format=json&key=${process.env.DATAGOLF_API_KEY}`
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch odds');
  }
  
  return await response.json();
}

export async function getPlayerRankings() {
  const response = await fetch(
    `${DATAGOLF_BASE_URL}/preds/get-dg-rankings?file_format=json&key=${process.env.DATAGOLF_API_KEY}`
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch rankings');
  }
  
  return await response.json();
}

export function calculateTier(owgrRank: number | null): string {
  if (!owgrRank) return 'Tier 3';
  if (owgrRank <= 10) return 'Elite';
  if (owgrRank <= 30) return 'Tier 1';
  if (owgrRank <= 75) return 'Tier 2';
  return 'Tier 3';
}