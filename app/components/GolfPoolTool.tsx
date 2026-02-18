'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, Trophy, DollarSign, Target, Cloud, Wind, Droplets, ChevronDown, ChevronUp, Star, Clock, Calendar, Users, CheckCircle, XCircle, Search, Lock, AlertCircle } from 'lucide-react';

// Type definitions
interface Player {
  name: string;
  tier: string;
  winOdds: string;
  top5Odds: string;
  top10Odds: string;
  dkSalary: string;
  fdSalary: string;
  courseHistory: string;
  recentForm: string;
  strengths: string[];
  concerns: string[];
  pebbleNotes: string;
  recommendation: string;
  reasoning: string;
}

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
  events_completed: number;
  best_finish: number | null;
}

const GolfPoolTool = () => {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonPlayers, setComparisonPlayers] = useState<Player[]>([]);
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
  
  // Segment standings
  const [segmentStandings, setSegmentStandings] = useState<SegmentStanding[]>([]);
  const [allPicks, setAllPicks] = useState<Pick[]>([]);

  // Curated shortlist for research (your original 3 players with generic notes)
  const shortlistPlayers: Player[] = [
    {
      name: "Scottie Scheffler",
      tier: "Elite",
      winOdds: "+300",
      top5Odds: "+110",
      top10Odds: "-200",
      dkSalary: "$14,000",
      fdSalary: "$15,600",
      courseHistory: "Consistently elite",
      recentForm: "Won Hero World Challenge, Strong putting recently",
      strengths: ["Elite ball-striker", "Short game improving", "Never misses cuts"],
      concerns: ["High DFS salary"],
      pebbleNotes: "Elite player across all courses",
      recommendation: "SAVE FOR MAJOR",
      reasoning: "Too valuable for early events. Save for Masters ($30M effective)"
    },
    {
      name: "Xander Schauffele",
      tier: "Elite",
      winOdds: "+1400",
      top5Odds: "+350",
      top10Odds: "+140",
      dkSalary: "$11,400",
      fdSalary: "$12,800",
      courseHistory: "Strong major performer",
      recentForm: "Consistent, Strong major performer",
      strengths: ["Excellent iron player", "Calm under pressure", "Good putter"],
      concerns: ["Not the longest hitter"],
      pebbleNotes: "Elite player - accuracy over distance",
      recommendation: "SAVE FOR MAJOR",
      reasoning: "Elite player needed for majors with 1.5x multiplier"
    },
    {
      name: "Russell Henley",
      tier: "Tier 2",
      winOdds: "+3500",
      top5Odds: "+700",
      top10Odds: "+275",
      dkSalary: "$9,600",
      fdSalary: "$10,600",
      courseHistory: "Consistent performer",
      recentForm: "On fire - Top-20 in last 10 straight events",
      strengths: ["Most accurate driver on tour", "Elite iron player", "Small course specialist"],
      concerns: ["Hasn't won recently", "Not a bomber"],
      pebbleNotes: "Great value play - consistent top finishes",
      recommendation: "STRONG VALUE",
      reasoning: "Great course fit, hot form, excellent value"
    },
  ];

  // Load data on mount
  useEffect(() => {
    loadCurrentTournament();
    loadPlayers();
    loadPicks();
    loadSegmentStandings();
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
        
        // Check if we have a pick for this tournament
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
        
        // Reload players to show updated usage
        loadPlayers();
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
    if (rec.includes("TOP PICK") || rec.includes("STRONG")) return "text-green-400";
    if (rec.includes("SAVE")) return "text-purple-400";
    if (rec.includes("AVOID")) return "text-red-400";
    return "text-yellow-400";
  };

  const toggleComparison = (player: Player) => {
    if (comparisonPlayers.find(p => p.name === player.name)) {
      setComparisonPlayers(comparisonPlayers.filter(p => p.name !== player.name));
    } else if (comparisonPlayers.length < 3) {
      setComparisonPlayers([...comparisonPlayers, player]);
    }
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
        <div className="max-w-7xl mx-auto mb-6 glass rounded-xl p-4 flex gap-4">
          {segmentStandings.map((standing) => (
            <div key={standing.segment} className="flex-1 text-center">
              <div className="text-xs text-slate-400">{standing.segment}</div>
              <div className="text-2xl font-bold text-emerald-400">
                ${(standing.total_earnings || 0).toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">
                {standing.events_completed}/7 events
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto mb-6 animate-slide-in" style={{animationDelay: '0.05s'}}>
        <div className="glass rounded-xl p-2 flex gap-2">
          {[
            { id: 'weekly', label: 'This Week', icon: Clock },
            { id: 'roster', label: 'Roster Management', icon: Users },
            { id: 'schedule', label: 'Full Schedule', icon: Calendar },
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

      {/* WEEKLY TAB - This Week's Pick */}
      {activeTab === 'weekly' && currentTournament && (
        <>
          {/* Current Pick Status / Submission Form */}
          <div className="max-w-7xl mx-auto mb-8 glass rounded-2xl p-6 glow animate-slide-in" style={{animationDelay: '0.1s'}}>
            {currentPick ? (
              // Show current pick
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
                    ${currentPick.earnings.toLocaleString()}
                  </div>
                </div>
              </div>
            ) : (
              // Show pick form
              <div>
                <h3 className="text-2xl mb-4 text-emerald-400">
                  MAKE YOUR PICK - WEEK {currentTournament.week_number}
                </h3>
                
                {loadingPlayers ? (
                  <div className="text-center py-8 text-slate-400">Loading players...</div>
                ) : (
                  <div className="space-y-4">
                    {/* Search input */}
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

                    <div className="flex gap-4 items-end">
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
                          {allPlayers.filter(p => p.used_in_tournament_id !== null).length} players already used •{' '}
                          {allPlayers.filter(p => p.used_in_tournament_id === null).length} available
                        </div>
                      </div>

                      <div className="flex flex-col justify-end">
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
          </div>

          {/* Players Grid (Shortlist - keep for now as research tool) */}
          <div className="max-w-7xl mx-auto mb-4">
            <h3 className="text-2xl mb-2 text-slate-400">Top Tier Players (Reference)</h3>
            <p className="text-sm text-slate-500 mb-4">Course-specific analysis coming soon - these are general recommendations</p>
          </div>

          <div className="max-w-7xl mx-auto grid gap-6">
            {shortlistPlayers.map((player, idx) => {
              const dbPlayer = allPlayers.find(p => p.name === player.name);
              const isUsed = dbPlayer?.used_in_tournament_id !== null;
              
              return (
                <div
                  key={idx}
                  className={`glass rounded-2xl p-6 transition-all bg-gradient-to-br ${getTierColor(player.tier)} border ${
                    isUsed ? 'opacity-50' : 'cursor-pointer hover:scale-[1.01]'
                  }`}
                  style={{animationDelay: `${0.2 + idx * 0.05}s`}}
                  onClick={() => !isUsed && setSelectedPlayer(selectedPlayer?.name === player.name ? null : player)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-bold">{player.name}</h3>
                        <span className="px-3 py-1 bg-slate-800/60 rounded-full text-xs font-semibold">
                          {player.tier}
                        </span>
                        {isUsed && (
                          <span className="px-3 py-1 bg-red-500/30 rounded-full text-xs font-semibold flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Used Week {dbPlayer?.used_in_week}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-yellow-400" />
                          <span className="text-slate-400">Win:</span>
                          <span className="font-bold text-emerald-400">{player.winOdds}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-xl font-bold mb-1 ${getRecommendationColor(player.recommendation)}`}>
                        {player.recommendation}
                      </div>
                      <div className="text-xs text-slate-400 max-w-xs">
                        {player.reasoning}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
                            ${pick.earnings.toLocaleString()}
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

      {/* OTHER TABS - Placeholders */}
      {(activeTab === 'roster' || activeTab === 'schedule') && (
        <div className="max-w-7xl mx-auto">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-3xl mb-2 text-emerald-400 capitalize">{activeTab}</h2>
            <p className="text-slate-400 mb-6">This feature is coming soon!</p>
            
            <div className="bg-slate-800/50 rounded-xl p-8 text-center">
              <p className="text-slate-400">Additional features will be built out soon.</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="max-w-7xl mx-auto mt-8 text-center text-slate-500 text-sm">
        <p>Data powered by DataGolf • {allPlayers.length} players in database</p>
        {currentTournament && (
          <p className="mt-1">
            Current: Week {currentTournament.week_number} - {currentTournament.event_name}
          </p>
        )}
      </div>
    </div>
  );
};

export default GolfPoolTool;