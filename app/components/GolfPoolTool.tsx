'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, DollarSign, Target, Clock, Calendar, Users, CheckCircle, XCircle, Search, Lock, TrendingUp, AlertCircle, Award, Zap, Shield } from 'lucide-react';

// Type definitions
interface DBPlayer {
  id: number;
  name: string;
  tier: string;
  used_in_tournament_id: string | null;
  used_in_week: number | null;
}

interface Tournament {
  id: string;
  event_name: string;
  course_name: string;
  city: string;
  country: string;
  start_date: string;
  end_date: string;
  purse: number;
  multiplier: number;
  segment: string;
  event_type: string;
  week_number: number;
  is_completed: boolean;
}

interface Pick {
  id: number;
  tournament_id: string;
  player_name: string;
  earnings: number;
  finish_position: number | null;
  pick_date: string;
  event_name?: string;
  week_number?: number;
  segment?: string;
}

interface SegmentStanding {
  segment: string;
  total_earnings: number;
  season_total_earnings: number;
  events_completed: number;
  best_finish: number | null;
}

interface PlayerRecommendation {
  name: string;
  dg_id: number;
  tier: string;
  owgr_rank: number;
  datagolf_rank: number;
  win_odds: number;
  win_probability: number;
  top_5_probability: number;
  top_10_probability: number;
  top_20_probability: number;
  make_cut_probability: number;
  dk_salary?: number;
  course_fit?: number;
  is_used: boolean;
  used_week?: number;
  recommendation_score: number;
  recommendation_tier: string;
  reasoning: string;
  strategic_note?: string;
  narrative?: string;
}

const formatDollar = (amount: number) => {
  return '$' + Math.round(amount).toLocaleString();
};

const GolfPoolTool = () => {
  const [activeTab, setActiveTab] = useState('weekly');
  
  // Tournament and pick state
  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(null);
  const [currentPick, setCurrentPick] = useState<Pick | null>(null);
  const [allPlayers, setAllPlayers] = useState<DBPlayer[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<DBPlayer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPickPlayer, setSelectedPickPlayer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [loadingTournament, setLoadingTournament] = useState(true);
  
  // Recommendations state
  const [recommendations, setRecommendations] = useState<PlayerRecommendation[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  const [nextMajor, setNextMajor] = useState<{ name: string; weeks_away: number } | null>(null);
  const [loadingNarrativeFor, setLoadingNarrativeFor] = useState<number | null>(null);
  
  // Segment standings
  const [segmentStandings, setSegmentStandings] = useState<SegmentStanding[]>([]);
  const [allPicks, setAllPicks] = useState<Pick[]>([]);

  // Load data on mount
  useEffect(() => {
    loadCurrentTournament();
    loadPlayers();
    loadPicks();
    loadSegmentStandings();
    loadRecommendations();
  }, []);

  // Filter players based on search
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredPlayers(allPlayers.slice(0, 50));
    } else {
      const filtered = allPlayers.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPlayers(filtered.slice(0, 50));
    }
  }, [searchTerm, allPlayers]);

  const loadCurrentTournament = async () => {
    try {
      const response = await fetch('/api/current-tournament');
      const data = await response.json();
      
      if (data.tournament) {
        setCurrentTournament(data.tournament);
        
        const picksResponse = await fetch('/api/picks');
        const picksData = await picksResponse.json();
        const tournamentPick = picksData.picks.find((p: Pick) => p.tournament_id === data.tournament.id);
        
        if (tournamentPick) {
          setCurrentPick(tournamentPick);
        }
      }
      setLoadingTournament(false);
    } catch (error) {
      console.error('Failed to load tournament:', error);
      setLoadingTournament(false);
    }
  };

  const loadPlayers = async () => {
    try {
      const response = await fetch('/api/players');
      const data = await response.json();
      setAllPlayers(data.players);
      setFilteredPlayers(data.players.slice(0, 50));
      setLoadingPlayers(false);
    } catch (error) {
      console.error('Failed to load players:', error);
      setLoadingPlayers(false);
    }
  };

  const loadPicks = async () => {
    try {
      const response = await fetch('/api/picks');
      const data = await response.json();
      setAllPicks(data.picks);
    } catch (error) {
      console.error('Failed to load picks:', error);
    }
  };

  const loadSegmentStandings = async () => {
    try {
      const response = await fetch('/api/segment-standings');
      if (response.ok) {
        const data = await response.json();
        setSegmentStandings(data.standings);
      }
    } catch (error) {
      console.error('Failed to load standings:', error);
    }
  };

  const loadRecommendations = async () => {
    try {
      setLoadingRecommendations(true);
      const response = await fetch('/api/weekly-recommendations');
      
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.top_picks || []);
        setNextMajor(data.next_major);
      } else {
        console.error('Failed to load recommendations');
      }
      setLoadingRecommendations(false);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
      setLoadingRecommendations(false);
    }
  };

  const generateNarrative = async (player: PlayerRecommendation) => {
  setLoadingNarrativeFor(player.dg_id);
  
  try {
    const response = await fetch('/api/generate-narratives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        players: [player],
        tournament: currentTournament?.event_name || 'this tournament',
        context: {
          week_number: currentTournament?.week_number,
          next_major: nextMajor,
          used_players: allPicks
        }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const narrative = data.narratives[player.dg_id];
      const tier = data.tiers[player.dg_id];
      
      // Update the player's narrative AND tier in state
      setRecommendations(prev => prev.map(p => 
        p.dg_id === player.dg_id ? { 
          ...p, 
          narrative, 
          recommendation_tier: tier || p.recommendation_tier 
        } : p
      ));
    }
  } catch (error) {
    console.error('Failed to generate narrative:', error);
  } finally {
    setLoadingNarrativeFor(null);
  }
};

  const handleSubmitPick = async () => {
    if (!selectedPickPlayer) {
      setSubmitMessage({ type: 'error', text: 'Please select a player' });
      return;
    }

    if (!currentTournament) {
      setSubmitMessage({ type: 'error', text: 'No tournament available' });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      const response = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: currentTournament.id,
          player_name: selectedPickPlayer
        })
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentPick(data.pick);
        setSubmitMessage({ 
          type: 'success', 
          text: data.message || `✓ Locked in ${selectedPickPlayer}!` 
        });
        setSelectedPickPlayer('');
        setSearchTerm('');
        
        loadPlayers();
        loadRecommendations();
      } else {
        setSubmitMessage({ 
          type: 'error', 
          text: data.error || 'Failed to save pick' 
        });
      }
    } catch (error) {
      setSubmitMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTierColor = (tier: string) => {
    if (tier.includes("Elite")) return "from-yellow-500/20 to-yellow-600/20 border-yellow-500/50";
    if (tier === "Tier 1") return "from-blue-400/20 to-blue-500/20 border-blue-400/50";
    if (tier === "Tier 2") return "from-blue-500/20 to-blue-600/20 border-blue-500/50";
    return "from-gray-500/20 to-gray-600/20 border-gray-500/50";
  };

  const getRecommendationColor = (rec: string) => {
    if (rec.includes("TOP PICK")) return "text-green-400";
    if (rec.includes("STRONG")) return "text-emerald-400";
    if (rec.includes("SAVE")) return "text-purple-400";
    if (rec.includes("VALUE")) return "text-cyan-400";
    if (rec.includes("PLAYABLE")) return "text-yellow-400";
    if (rec.includes("CONSIDER")) return "text-cyan-400";
    if (rec.includes("LONGSHOT")) return "text-orange-400";
    return "text-slate-400";
  };

  const getRecommendationIcon = (rec: string) => {
    if (rec.includes("TOP PICK")) return Award;
    if (rec.includes("STRONG")) return Zap;
    if (rec.includes("SAVE")) return Shield;
    return Target;
  };

  const formatOdds = (odds: number) => {
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  if (loadingTournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-slate-100 flex items-center justify-center">
        <div className="text-2xl">Loading tournament data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-slate-100 p-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap');
        
        * {
          font-family: 'Inter', sans-serif;
        }
        
        h1, h2, h3 {
          font-family: 'Bebas Neue', sans-serif;
          letter-spacing: 0.05em;
        }
        
        .glass {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(148, 163, 184, 0.1);
        }
        
        .glow {
          box-shadow: 0 0 30px rgba(16, 185, 129, 0.15);
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slide-in {
          animation: slideIn 0.4s ease-out forwards;
        }
      `}</style>

      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 animate-slide-in">
        <h1 className="text-6xl mb-2 bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          GOLF POOL COMMAND CENTER
        </h1>
        <p className="text-slate-400 text-lg">One & Done Earnings Pool • 148 Entries • $22,200 Pot</p>
      </div>

      {/* Segment Standings Bar */}
{segmentStandings.length > 0 && (
  <div className="max-w-7xl mx-auto mb-6 space-y-4">
    {/* Season Total */}
    <div className="glass rounded-xl p-4 text-center">
      <div className="text-sm text-slate-400">Season Total</div>
      <div className="text-4xl font-bold text-emerald-400">
        {formatDollar(segmentStandings[0]?.season_total_earnings || 0)}
      </div>
      <div className="text-xs text-slate-500 mt-1">
        {segmentStandings.reduce((sum, s) => sum + s.events_completed, 0)}/28 events
      </div>
    </div>

    {/* Segment Breakdown */}
    <div className="glass rounded-xl p-4 flex gap-4">
      {segmentStandings.map((standing) => (
        <div key={standing.segment} className="flex-1 text-center">
          <div className="text-xs text-slate-400">{standing.segment}</div>
          <div className="text-2xl font-bold text-emerald-400">
            {formatDollar(standing.total_earnings || 0)}
          </div>
          <div className="text-xs text-slate-500">
            {standing.events_completed}/7 events
          </div>
        </div>
      ))}
    </div>
  </div>
)}

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto mb-6 animate-slide-in" style={{animationDelay: '0.05s'}}>
        <div className="glass rounded-xl p-2 flex gap-2">
          {[
            { id: 'weekly', label: 'This Week', icon: Clock },
            { id: 'roster', label: 'Field', icon: Users },
            { id: 'schedule', label: 'Schedule', icon: Calendar },
            { id: 'stats', label: 'My Picks', icon: Trophy }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-emerald-500 text-white font-semibold'
                    : 'bg-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* WEEKLY TAB */}
      {activeTab === 'weekly' && currentTournament && (
        <>
          {/* Current Pick Status / Submission Form */}
          <div className="max-w-7xl mx-auto mb-8 glass rounded-2xl p-6 glow animate-slide-in" style={{animationDelay: '0.1s'}}>
            {currentPick ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-400 mb-1">
                    YOUR PICK - WEEK {currentTournament.week_number}
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                    <div>
                      <div className="text-3xl font-bold text-emerald-400">{currentPick.player_name}</div>
                      <div className="text-sm text-slate-400">
                        {currentTournament.event_name}
                        {currentPick.finish_position && ` • Finished T${currentPick.finish_position}`}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-400">Earnings</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {formatDollar(currentPick.earnings)}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-2xl mb-4 text-emerald-400">
                  MAKE YOUR PICK - WEEK {currentTournament.week_number}
                </h3>
                
                {loadingPlayers ? (
                  <div className="text-center py-8 text-slate-400">Loading players...</div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search for a player..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm text-slate-400 mb-2">
                          Select Player ({filteredPlayers.length} {searchTerm ? 'results' : 'shown'})
                        </label>
                        <select
                          value={selectedPickPlayer}
                          onChange={(e) => setSelectedPickPlayer(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                          disabled={isSubmitting}
                        >
                          <option value="">-- Choose a player --</option>
                          {filteredPlayers.map((player) => (
                            <option 
                              key={player.id} 
                              value={player.name}
                              disabled={player.used_in_tournament_id !== null}
                            >
                              {player.name} ({player.tier})
                              {player.used_in_tournament_id && ` - USED Week ${player.used_in_week}`}
                            </option>
                          ))}
                        </select>
                        <div className="text-xs text-slate-500 mt-1">
                          {allPlayers.filter(p => p.used_in_tournament_id !== null).length} used •{' '}
                          {allPlayers.filter(p => p.used_in_tournament_id === null).length} available
                        </div>
                      </div>

                      <div className="pt-7">
                        <button
                          onClick={handleSubmitPick}
                          disabled={!selectedPickPlayer || isSubmitting}
                          className={`px-8 py-3 rounded-lg font-bold transition-all whitespace-nowrap ${
                            !selectedPickPlayer || isSubmitting
                              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                              : 'bg-emerald-500 hover:bg-emerald-600 text-white glow'
                          }`}
                        >
                          {isSubmitting ? 'Submitting...' : 'Lock In Pick'}
                        </button>
                      </div>
                    </div>

                    {submitMessage && (
                      <div className={`p-4 rounded-lg flex items-center gap-2 ${
                        submitMessage.type === 'success' 
                          ? 'bg-green-950/50 border border-green-500/50 text-green-300' 
                          : 'bg-red-950/50 border border-red-500/50 text-red-300'
                      }`}>
                        {submitMessage.type === 'success' ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                        <span>{submitMessage.text}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tournament Info Card */}
          <div className="max-w-7xl mx-auto mb-8 glass rounded-2xl p-6 glow animate-slide-in" style={{animationDelay: '0.15s'}}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-3xl mb-1 text-emerald-400">{currentTournament.event_name}</h2>
                <p className="text-slate-400">
                  Week {currentTournament.week_number} • {currentTournament.segment} • {currentTournament.event_type}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {currentTournament.course_name} • {currentTournament.city}, {currentTournament.country}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-emerald-400">
                  ${(currentTournament.purse / 1000000).toFixed(1)}M
                </div>
                <div className="text-sm text-slate-400">
                  {currentTournament.multiplier}x multiplier
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {new Date(currentTournament.start_date).toLocaleDateString()} - {new Date(currentTournament.end_date).toLocaleDateString()}
                </div>
              </div>
            </div>

            {nextMajor && (
              <div className="bg-purple-950/30 border border-purple-500/30 rounded-xl p-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-400" />
                <div className="text-sm">
                  <span className="text-purple-400 font-semibold">Next Major:</span>{' '}
                  <span className="text-slate-300">{nextMajor.name}</span>{' '}
                  <span className="text-slate-500">({nextMajor.weeks_away} weeks away)</span>
                </div>
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className="max-w-7xl mx-auto mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-3xl text-emerald-400">TOP PICKS BY EXPECTED VALUE</h3>
                <p className="text-sm text-slate-500">
                  Live odds & probabilities • DataGolf analysis • Click to generate AI insights
                </p>
              </div>
              <button
                onClick={loadRecommendations}
                disabled={loadingRecommendations}
                className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg text-sm transition-all"
              >
                {loadingRecommendations ? 'Updating...' : 'Refresh Data'}
              </button>
            </div>
          </div>

          {loadingRecommendations ? (
            <div className="max-w-7xl mx-auto glass rounded-2xl p-12 text-center">
              <div className="text-slate-400">Loading recommendations...</div>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="max-w-7xl mx-auto glass rounded-2xl p-12 text-center">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-500" />
              <div className="text-slate-400">No recommendations available. Check back closer to tournament start.</div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto grid gap-4">
              {recommendations.map((rec, idx) => {
                const Icon = getRecommendationIcon(rec.recommendation_tier);
                
                return (
                  <div
                    key={rec.dg_id}
                    className={`glass rounded-xl p-5 transition-all hover:scale-[1.01] bg-gradient-to-br ${getTierColor(rec.tier)} border ${
                      rec.is_used ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="text-xl font-bold text-slate-400">#{idx + 1}</div>
                          <h4 className="text-xl font-bold">{rec.name}</h4>
                          <span className="px-2 py-1 bg-slate-800/60 rounded-full text-xs font-semibold">
                            {rec.tier}
                          </span>
                          {rec.is_used && (
                            <span className="px-2 py-1 bg-red-500/30 rounded-full text-xs font-semibold flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              Used W{rec.used_week}
                            </span>
                          )}
                        </div>

                        {/* Data Grid - 2 rows */}
                        <div className="space-y-2">
                          {/* Row 1: Odds & Probabilities */}
                          <div className="grid grid-cols-4 gap-3 text-sm">
                            <div>
                              <div className="text-xs text-slate-500">Win Odds</div>
                              <div className="font-bold text-emerald-400">{formatOdds(rec.win_odds)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Win %</div>
                              <div className="font-semibold">{(rec.win_probability * 100).toFixed(1)}%</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Top 5 %</div>
                              <div className="font-semibold">{(rec.top_5_probability * 100).toFixed(1)}%</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Top 10 %</div>
                              <div className="font-semibold">{(rec.top_10_probability * 100).toFixed(1)}%</div>
                            </div>
                          </div>

                          {/* Row 2: Other Stats */}
                          <div className="grid grid-cols-4 gap-3 text-sm">
                            <div>
                              <div className="text-xs text-slate-500">DK Salary</div>
                              <div className="font-semibold">{rec.dk_salary ? `$${(rec.dk_salary / 1000).toFixed(1)}K` : 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">OWGR</div>
                              <div className="font-semibold">#{rec.owgr_rank}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Course Win %</div>
                              <div className="font-semibold">
                                {rec.course_fit ? 
                                  `${(rec.course_fit * 100).toFixed(1)}%` 
                                  : 'N/A'}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Make Cut %</div>
                              <div className="font-semibold">{(rec.make_cut_probability * 100).toFixed(0)}%</div>
                            </div>
                          </div>
                        </div>

                        {/* AI Narrative Section */}
                        <div className="mt-4">
                          {rec.narrative ? (
                            <div className="p-3 bg-slate-900/40 rounded-lg border border-slate-700/50">
                              <div className="flex items-start gap-2">
                                <div className="text-emerald-400 mt-0.5">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <div className="text-xs text-slate-500 mb-1">AI Analysis</div>
                                  <div className="text-sm text-slate-300 leading-relaxed">
                                    {rec.narrative}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => generateNarrative(rec)}
                              disabled={loadingNarrativeFor === rec.dg_id}
                              className="w-full px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 rounded-lg text-sm font-semibold text-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {loadingNarrativeFor === rec.dg_id ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                                  Generating Analysis...
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                                  </svg>
                                  Generate AI Analysis
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Recommendation Badge - only show if narrative generated */}
<div className="text-right ml-4">
  {rec.narrative && (
    <div className={`flex items-center gap-2 text-lg font-bold mb-1 ${getRecommendationColor(rec.recommendation_tier)}`}>
      <Icon className="w-5 h-5" />
      <span className="whitespace-nowrap">{rec.recommendation_tier}</span>
    </div>
  )}
                        <div className="text-xs text-slate-500">
                          EV: ${(rec.recommendation_score / 1000).toFixed(1)}k
                        </div>
                      </div>
                    </div>

                    {/* Strategic Note */}
                    {rec.strategic_note && (
                      <div className="mt-3 text-xs text-yellow-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {rec.strategic_note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* MY PICKS TAB */}
      {activeTab === 'stats' && (
        <div className="max-w-7xl mx-auto">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-3xl mb-6 text-emerald-400">MY PICKS</h2>
            
            {allPicks.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No picks yet. Make your first pick!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {allPicks.map((pick) => (
                  <div key={pick.id} className="bg-slate-800/50 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-lg">{pick.player_name}</div>
                      <div className="text-sm text-slate-400">
                        Week {pick.week_number} • {pick.event_name}
                      </div>
                    </div>
                    <div className="text-right">
                      {pick.finish_position ? (
                        <>
                          <div className="text-sm text-slate-400">T{pick.finish_position}</div>
                          <div className="text-xl font-bold text-emerald-400">
                            {formatDollar(pick.earnings)}
                          </div>
                        </>
                      ) : (
                        <div className="text-slate-500">Pending</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOURNAMENT FIELD TAB */}
{activeTab === 'roster' && <TournamentFieldTab />}

{/* SCHEDULE TAB */}
{activeTab === 'schedule' && <ScheduleTab />}
        <div className="max-w-7xl mx-auto">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-3xl mb-2 text-emerald-400 capitalize">{activeTab}</h2>
            <p className="text-slate-400 mb-6">Coming soon!</p>
            
            <div className="bg-slate-800/50 rounded-xl p-8 text-center">
              <p className="text-slate-400">Additional features will be built out soon.</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="max-w-7xl mx-auto mt-8 text-center text-slate-500 text-sm">
        <p>Live data powered by DataGolf • AI analysis by Claude</p>
        {currentTournament && (
          <p className="mt-1">
            Week {currentTournament.week_number} - {currentTournament.event_name}
          </p>
        )}
      </div>
    </div>
  );
};

// Tournament Field Component
const TournamentFieldTab = () => {
  const [field, setField] = useState<any[]>([]);
  const [eventName, setEventName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadField();
  }, []);

  const loadField = async () => {
    try {
      const response = await fetch('/api/tournament-field');
      if (response.ok) {
        const data = await response.json();
        setField(data.field || []);
        setEventName(data.event_name || '');
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to load field:', error);
      setLoading(false);
    }
  };

  const formatOdds = (odds: number | null) => {
    if (!odds) return 'N/A';
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass rounded-2xl p-12 text-center">
        <div className="text-slate-400">Loading tournament field...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="glass rounded-2xl p-6">
        <h2 className="text-3xl mb-2 text-emerald-400">TOURNAMENT FIELD</h2>
        <p className="text-slate-400 mb-6">{eventName}</p>
        
        <div className="space-y-2">
          {field.map((player, idx) => (
            <div 
              key={player.dg_id}
              className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between hover:bg-slate-800/70 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="text-slate-500 font-mono w-8">{idx + 1}</div>
                <div>
                  <div className="font-bold">{player.name}</div>
                  <div className="text-sm text-slate-500">{player.country}</div>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <div className="text-xs text-slate-500">OWGR</div>
                  <div className="font-semibold">#{player.owgr || 'N/A'}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Win Odds</div>
                  <div className="font-semibold text-emerald-400">{formatOdds(player.win_odds)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Schedule Component
const ScheduleTab = () => {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    try {
      const response = await fetch('/api/full-schedule');
      if (response.ok) {
        const data = await response.json();
        setTournaments(data.tournaments || []);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to load schedule:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass rounded-2xl p-12 text-center">
        <div className="text-slate-400">Loading schedule...</div>
      </div>
    );
  }

  const getSegmentColor = (segment: string) => {
    const colors: any = {
      'Q1': 'bg-blue-500/20 border-blue-500/50',
      'Q2': 'bg-green-500/20 border-green-500/50',
      'Q3': 'bg-yellow-500/20 border-yellow-500/50',
      'Q4': 'bg-purple-500/20 border-purple-500/50'
    };
    return colors[segment] || 'bg-slate-500/20 border-slate-500/50';
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="glass rounded-2xl p-6">
        <h2 className="text-3xl mb-6 text-emerald-400">FULL SEASON SCHEDULE</h2>
        
        <div className="grid gap-4">
          {tournaments.map((tournament) => (
            <div 
              key={tournament.id}
              className={`rounded-lg p-4 border ${
                tournament.is_completed ? 'bg-slate-800/30' : 'bg-slate-800/50'
              } ${getSegmentColor(tournament.segment)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-mono text-slate-400">
                      Week {tournament.week_number}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getSegmentColor(tournament.segment)}`}>
                      {tournament.segment}
                    </span>
                    {tournament.event_type === 'Major' && (
                      <span className="px-2 py-0.5 bg-yellow-500/30 border border-yellow-500/50 rounded-full text-xs font-semibold text-yellow-300">
                        MAJOR
                      </span>
                    )}
                    {tournament.is_completed && (
                      <span className="px-2 py-0.5 bg-green-500/30 border border-green-500/50 rounded-full text-xs font-semibold text-green-300">
                        ✓ COMPLETE
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-xl font-bold mb-1">{tournament.event_name}</h3>
                  <p className="text-sm text-slate-400">
                    {tournament.course_name} • {tournament.city}, {tournament.country}
                  </p>
                  
                  {tournament.is_completed && tournament.winner && (
                    <p className="text-sm text-emerald-400 mt-2">
                      Winner: {tournament.winner}
                    </p>
                  )}
                </div>
                
                <div className="text-right">
                  <div className="text-sm text-slate-500">
                    {new Date(tournament.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-lg font-bold text-emerald-400">
                    ${(tournament.purse / 1000000).toFixed(1)}M
                  </div>
                  {tournament.multiplier > 1 && (
                    <div className="text-xs text-yellow-400">
                      {tournament.multiplier}x multiplier
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GolfPoolTool;