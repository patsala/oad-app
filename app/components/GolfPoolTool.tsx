'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, Trophy, DollarSign, Target, Cloud, Wind, Droplets, ChevronDown, ChevronUp, Star, Clock, Calendar, Users, CheckCircle, XCircle, Search } from 'lucide-react';

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
}

interface Tournament {
  name: string;
  purse: number;
  multiplier: number;
  segment: string;
  type: string;
  date: string;
  note?: string;
}

interface Scenario {
  player: Player;
  tournament: Tournament;
  expectedValue: number;
  effectivePurse: number;
}

interface Pick {
  id: number;
  tournament_id: number;
  player_name: string;
  earnings: number;
  finish_position: number | null;
  pick_date: string;
}

const GolfPoolTool = () => {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonPlayers, setComparisonPlayers] = useState<Player[]>([]);
  const [activeTab, setActiveTab] = useState('weekly');
  const [scenarioA, setScenarioA] = useState<Scenario | null>(null);
  const [scenarioB, setScenarioB] = useState<Scenario | null>(null);
  
  // Pick management state
  const [currentPick, setCurrentPick] = useState<Pick | null>(null);
  const [allPlayers, setAllPlayers] = useState<DBPlayer[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<DBPlayer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPickPlayer, setSelectedPickPlayer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  // Pebble Beach tournament data
  const tournamentInfo = {
    name: "AT&T Pebble Beach Pro-Am",
    purse: "$20M",
    effectivePurse: "$20M",
    multiplier: "1.0x (Signature Event)",
    segment: "Q1",
    deadline: "Tonight, 9 hours",
    tournamentId: 1, // Database ID
    weather: {
      conditions: "Rain & Wind",
      temp: "58-62°F",
      wind: "15-18 mph, gusts to 31 mph",
      precipitation: "90% chance",
      impact: "Challenging conditions - favors scramblers"
    }
  };

  // Upcoming tournaments for scenario modeling
  const upcomingTournaments: Tournament[] = [
    { name: "AT&T Pebble Beach", purse: 20, multiplier: 1.0, segment: "Q1", type: "Signature", date: "Feb 13-16" },
    { name: "Genesis Invitational", purse: 20, multiplier: 1.0, segment: "Q1", type: "Signature", date: "Feb 20-23" },
    { name: "Cognizant Classic", purse: 8.6, multiplier: 1.0, segment: "Q1", type: "Regular", date: "Feb 27-Mar 2" },
    { name: "Arnold Palmer Invitational", purse: 20, multiplier: 1.0, segment: "Q1", type: "Signature", date: "Mar 6-9" },
    { name: "Players Championship", purse: 25, multiplier: 1.0, segment: "Q1", type: "Signature", date: "Mar 13-16" },
    { name: "Valspar Championship", purse: 8.6, multiplier: 1.0, segment: "Q1", type: "Regular", date: "Mar 20-23" },
    { name: "Houston Open", purse: 9, multiplier: 1.0, segment: "Q1", type: "Regular", date: "Mar 27-30" },
    { name: "Valero Texas Open", purse: 9.2, multiplier: 1.0, segment: "Q1", type: "Regular", date: "Apr 3-6" },
    { name: "The Masters", purse: 20, multiplier: 1.5, segment: "Q2", type: "Major", date: "Apr 10-13" },
    { name: "RBC Heritage", purse: 20, multiplier: 1.0, segment: "Q2", type: "Signature", date: "Apr 17-20" },
    { name: "PGA Championship", purse: 18.5, multiplier: 1.5, segment: "Q2", type: "Major", date: "May 15-18" },
    { name: "Memorial Tournament", purse: 20, multiplier: 1.0, segment: "Q2", type: "Signature", date: "Jun 5-8" },
    { name: "U.S. Open", purse: 21.5, multiplier: 1.5, segment: "Q3", type: "Major", date: "Jun 19-22" },
    { name: "British Open", purse: 17, multiplier: 1.5, segment: "Q3", type: "Major", date: "Jul 17-20" },
    { name: "Tour Championship", purse: 28.5, multiplier: 1.0, segment: "Q4", type: "Major-Style", date: "Aug 28-31", note: "Adjusted to avg of 4 majors" }
  ];

  // Curated shortlist for research (your original 13 players)
  const shortlistPlayers: Player[] = [
    {
      name: "Scottie Scheffler",
      tier: "Elite",
      winOdds: "+300",
      top5Odds: "+110",
      top10Odds: "-200",
      dkSalary: "$14,000",
      fdSalary: "$15,600",
      courseHistory: "T6 (2024), T9 (2023)",
      recentForm: "Won Hero World Challenge, Strong putting recently",
      strengths: ["Elite ball-striker", "Short game improving", "Never misses cuts"],
      concerns: ["Driver less important at Pebble", "High DFS salary"],
      pebbleNotes: "Hasn't won here yet, but top-10 finishes show he can contend",
      recommendation: "SAVE FOR MAJOR",
      reasoning: "Too valuable for Q1 signature event. Save for Masters ($30M effective)"
    },
    {
      name: "Xander Schauffele",
      tier: "Elite",
      winOdds: "+1400",
      top5Odds: "+350",
      top10Odds: "+140",
      dkSalary: "$11,400",
      fdSalary: "$12,800",
      courseHistory: "T14 (2024), T6 (2023)",
      recentForm: "Consistent, Strong major performer",
      strengths: ["Excellent iron player", "Calm under pressure", "Good Poa putter"],
      concerns: ["Not the longest hitter", "Moderate recent results"],
      pebbleNotes: "Course suits his game - accuracy over distance",
      recommendation: "SAVE FOR MAJOR",
      reasoning: "Elite player needed for majors with 1.5x multiplier"
    },
    {
      name: "Hideki Matsuyama",
      tier: "Elite",
      winOdds: "+1800",
      top5Odds: "+400",
      top10Odds: "+165",
      dkSalary: "$10,900",
      fdSalary: "$12,200",
      courseHistory: "MC (2024), T47 (2023)",
      recentForm: "Just lost playoff at Phoenix, playing well",
      strengths: ["Elite iron player", "Strong wedge game", "Top SG: Approach"],
      concerns: ["Mixed Pebble history", "Putting can be inconsistent"],
      pebbleNotes: "Coming off heartbreaking loss, might be motivated",
      recommendation: "TIER 2 CONSIDERATION",
      reasoning: "Elite talent but poor Pebble history. Could use here or save for major"
    },
    {
      name: "Collin Morikawa",
      tier: "Elite/Tier 2",
      winOdds: "+2000",
      top5Odds: "+450",
      top10Odds: "+180",
      dkSalary: "$10,600",
      fdSalary: "$11,800",
      courseHistory: "T14 (2024), Strong Pebble history",
      recentForm: "T2 at Sentry, hitting form, 91.67% GIR",
      strengths: ["Best iron player on tour", "Elite ball-striker", "Small greens specialist"],
      concerns: ["Putting consistency", "Short game lapses"],
      pebbleNotes: "Ball-striker's paradise - perfect fit for his game",
      recommendation: "STRONG TIER 2 PLAY",
      reasoning: "Elite iron play perfect for Pebble. Good value at this price"
    },
    {
      name: "Patrick Cantlay",
      tier: "Tier 2",
      winOdds: "+2500",
      top5Odds: "+500",
      top10Odds: "+200",
      dkSalary: "$10,000",
      fdSalary: "$11,200",
      courseHistory: "T5 (2024), Solid Pebble record",
      recentForm: "Consistent, rarely misses cuts",
      strengths: ["Elite putter", "Smart course management", "High floor"],
      concerns: ["Not the best ball-striker", "Can be streaky"],
      pebbleNotes: "Proven performer here, T5 last year",
      recommendation: "SOLID TIER 2",
      reasoning: "High floor, good course history. Safe Q1 play"
    },
    {
      name: "Russell Henley",
      tier: "Tier 2",
      winOdds: "+3500",
      top5Odds: "+700",
      top10Odds: "+275",
      dkSalary: "$9,600",
      fdSalary: "$10,600",
      courseHistory: "T5 (2024), 10+ straight top-20s",
      recentForm: "On fire - Top-20 in last 10 straight events",
      strengths: ["Most accurate driver on tour", "Elite iron player", "Small course specialist"],
      concerns: ["Hasn't won recently", "Not a bomber"],
      pebbleNotes: "PEBBLE SPECIALIST - T5 last year, excels on short accurate courses",
      recommendation: "TOP PICK FOR PEBBLE",
      reasoning: "Perfect course fit, hot form, great value. Top-20 streak is elite"
    },
    {
      name: "Justin Rose",
      tier: "Tier 2",
      winOdds: "+4500",
      top5Odds: "+900",
      top10Odds: "+350",
      dkSalary: "$9,200",
      fdSalary: "$10,200",
      courseHistory: "Won (2023), T3 (2025), T11 (2024)",
      recentForm: "Dominant at Farmers, Great recent form",
      strengths: ["PEBBLE MASTER - Won here 2023", "Elite iron player", "Experience"],
      concerns: ["Age/injury history", "Putting can be inconsistent"],
      pebbleNotes: "Elite Pebble record - hasn't finished outside top-20 in last 10 starts",
      recommendation: "STRONG VALUE PLAY",
      reasoning: "Course history is incredible. Plus odds for top-20 finish"
    },
    {
      name: "Maverick McNealy",
      tier: "Tier 2",
      winOdds: "+6000",
      top5Odds: "+1200",
      top10Odds: "+500",
      dkSalary: "$8,600",
      fdSalary: "$9,400",
      courseHistory: "Near-misses 2020, 2021",
      recentForm: "Solid start to season, dependable",
      strengths: ["Accurate driver", "Local knowledge", "High floor player"],
      concerns: ["Hasn't won on tour", "Limited upside"],
      pebbleNotes: "Local favorite, wants to win here badly. Good early season form",
      recommendation: "HIGH FLOOR OPTION",
      reasoning: "Won't win, but likely top-25. Good if saving elites"
    },
    {
      name: "Matthew Fitzpatrick",
      tier: "Tier 2",
      winOdds: "+4500",
      top5Odds: "+900",
      top10Odds: "+350",
      dkSalary: "$9,400",
      fdSalary: "$10,400",
      courseHistory: "T9 at Phoenix last week",
      recentForm: "T9 Phoenix, T3 in SG: Tee-Green",
      strengths: ["Elite ball-striker", "Accurate", "Good form"],
      concerns: ["Back-to-back bogeys cost him R1 lead", "Putting streaky"],
      pebbleNotes: "Playing well, ball-striking suits Pebble",
      recommendation: "TIER 2 OPTION",
      reasoning: "Good form, but others have better Pebble history"
    },
    {
      name: "Si Woo Kim",
      tier: "Tier 2",
      winOdds: "+5000",
      top5Odds: "+1000",
      top10Odds: "+400",
      dkSalary: "$9,900",
      fdSalary: "$10,800",
      courseHistory: "Good recent record",
      recentForm: "Best golf of career - 11 straight top-25, 5 top-5s",
      strengths: ["On fire right now", "Career-best form", "T2 last 2 weeks"],
      concerns: ["Can be volatile", "Putting inconsistent"],
      pebbleNotes: "Hot streak is real - personal best #26 OWGR",
      recommendation: "HOT HAND PLAY",
      reasoning: "Riding momentum. If you believe in streaks, he's the guy"
    },
    {
      name: "Akshay Bhatia",
      tier: "Tier 2/3",
      winOdds: "+8000",
      top5Odds: "+1600",
      top10Odds: "+650",
      dkSalary: "$8,200",
      fdSalary: "$9,000",
      courseHistory: "Limited Pebble data",
      recentForm: "Young, talented, inconsistent",
      strengths: ["High upside", "Good ball-striker", "Fearless"],
      concerns: ["Inexperienced", "Can miss cuts", "Volatile"],
      pebbleNotes: "Risky play - boom or bust",
      recommendation: "AVOID",
      reasoning: "Too risky for a $20M event. Need consistency"
    },
    {
      name: "Jason Day",
      tier: "Tier 3",
      winOdds: "+6500",
      top5Odds: "+1300",
      top10Odds: "+550",
      dkSalary: "$8,800",
      fdSalary: "$9,600",
      courseHistory: "Some Pebble experience",
      recentForm: "Declining form, injury concerns",
      strengths: ["Former #1", "Experience", "Good when healthy"],
      concerns: ["Health issues", "Form declining", "Age"],
      pebbleNotes: "Past his prime, risky pick",
      recommendation: "AVOID",
      reasoning: "Too many better options. Health/form concerns"
    },
    {
      name: "Chris Gotterup",
      tier: "Elite/Tier 1",
      winOdds: "+2700",
      top5Odds: "+650",
      top10Odds: "+250",
      dkSalary: "$9,000",
      fdSalary: "$9,600",
      courseHistory: "Pebble Beach debut",
      recentForm: "🔥 2 WINS in first 3 events of 2026! Won Sony Open, Won Phoenix Open (playoff)",
      strengths: ["World #5 ranking", "Elite ball-striker (6th off tee)", "Winning mentality under pressure", "Clutch in playoffs"],
      concerns: ["Pebble Beach debut - no course history", "Poa putting (73rd)", "Could be letdown after big win"],
      pebbleNotes: "RED HOT - Just won Phoenix in playoff. 4 PGA wins total, tied with Scheffler/McIlroy for most since 2024. Elite ball-striking but Pebble debut is concern",
      recommendation: "ELITE HOT HAND",
      reasoning: "2 wins in 3 starts! World #5. High risk/high reward - no Pebble history but unstoppable form"
    }
  ];

  // Load players and current pick on mount
  useEffect(() => {
    loadPlayers();
    loadCurrentPick();
  }, []);

  // Filter players based on search
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredPlayers(allPlayers.slice(0, 50)); // Show top 50 by default
    } else {
      const filtered = allPlayers.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPlayers(filtered.slice(0, 50)); // Limit to 50 results
    }
  }, [searchTerm, allPlayers]);

  const loadPlayers = async () => {
    try {
      const response = await fetch('/api/players');
      const data = await response.json();
      setAllPlayers(data.players);
      setFilteredPlayers(data.players.slice(0, 50)); // Show first 50
      setLoadingPlayers(false);
    } catch (error) {
      console.error('Failed to load players:', error);
      setLoadingPlayers(false);
    }
  };

  const loadCurrentPick = async () => {
    try {
      const response = await fetch('/api/picks');
      const data = await response.json();
      
      // Find pick for tournament ID 1 (Pebble Beach)
      const pebblePick = data.picks.find((p: Pick) => p.tournament_id === tournamentInfo.tournamentId);
      if (pebblePick) {
        setCurrentPick(pebblePick);
      }
    } catch (error) {
      console.error('Failed to load picks:', error);
    }
  };

  const handleSubmitPick = async () => {
    if (!selectedPickPlayer) {
      setSubmitMessage({ type: 'error', text: 'Please select a player' });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      const response = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: tournamentInfo.tournamentId,
          player_name: selectedPickPlayer,
          earnings: 0,
          finish_position: null
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentPick(data.pick);
        setSubmitMessage({ type: 'success', text: `✓ Locked in ${selectedPickPlayer} for Pebble Beach!` });
        setSelectedPickPlayer('');
        setSearchTerm('');
      } else {
        setSubmitMessage({ type: 'error', text: 'Failed to save pick. Please try again.' });
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

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto mb-6 animate-slide-in" style={{animationDelay: '0.05s'}}>
        <div className="glass rounded-xl p-2 flex gap-2">
          {[
            { id: 'weekly', label: 'This Week', icon: Clock },
            { id: 'scenario', label: 'Scenario Modeling', icon: TrendingUp },
            { id: 'roster', label: 'Roster Management', icon: Users },
            { id: 'schedule', label: 'Full Schedule', icon: Calendar },
            { id: 'calculator', label: 'EV Calculator', icon: DollarSign },
            { id: 'stats', label: 'Course History', icon: Target }
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
      {activeTab === 'weekly' && (
        <>
          {/* Current Pick Status / Submission Form */}
          <div className="max-w-7xl mx-auto mb-8 glass rounded-2xl p-6 glow animate-slide-in" style={{animationDelay: '0.1s'}}>
            {currentPick ? (
              // Show current pick
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-400 mb-1">YOUR PEBBLE BEACH PICK</div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                    <div>
                      <div className="text-3xl font-bold text-emerald-400">{currentPick.player_name}</div>
                      <div className="text-sm text-slate-400">Locked in • Waiting for tournament results</div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-400">Current Earnings</div>
                  <div className="text-2xl font-bold text-emerald-400">${currentPick.earnings.toLocaleString()}</div>
                </div>
              </div>
            ) : (
              // Show pick form
              <div>
                <h3 className="text-2xl mb-4 text-emerald-400">MAKE YOUR PICK FOR PEBBLE BEACH</h3>
                
                {loadingPlayers ? (
                  <div className="text-center py-8 text-slate-400">Loading players...</div>
                ) : (
                  <div className="space-y-4">
                    {/* Search input */}
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search for a player... (e.g., Tommy Fleetwood)"
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
                            <option key={player.id} value={player.name}>
                              {player.name} ({player.tier})
                            </option>
                          ))}
                        </select>
                        <div className="text-xs text-slate-500 mt-1">
                          {allPlayers.length} total players available • Search to find more
                        </div>
                      </div>

                      <button
                        onClick={handleSubmitPick}
                        disabled={!selectedPickPlayer || isSubmitting}
                        className={`px-8 py-3 rounded-lg font-bold transition-all ${
                          !selectedPickPlayer || isSubmitting
                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white glow'
                        }`}
                      >
                        {isSubmitting ? 'Submitting...' : 'Lock In Pick'}
                      </button>
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
                <h2 className="text-3xl mb-1 text-emerald-400">{tournamentInfo.name}</h2>
                <p className="text-slate-400">Segment 1 (Q1) • Signature Event</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-red-400 mb-1">
                  <Clock className="w-5 h-5" />
                  <span className="font-bold">{tournamentInfo.deadline}</span>
                </div>
                <div className="text-2xl font-bold text-emerald-400">{tournamentInfo.purse}</div>
                <div className="text-sm text-slate-400">{tournamentInfo.multiplier}</div>
              </div>
            </div>

            {/* Weather */}
            <div className="bg-gradient-to-r from-blue-950/50 to-slate-900/50 rounded-xl p-4 border border-blue-500/20">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-blue-400" />
                  <span>{tournamentInfo.weather.conditions}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wind className="w-5 h-5 text-cyan-400" />
                  <span>{tournamentInfo.weather.wind}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-blue-300" />
                  <span>{tournamentInfo.weather.precipitation}</span>
                </div>
                <div className="ml-auto text-yellow-400 font-semibold">
                  ⚠️ {tournamentInfo.weather.impact}
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Toggle */}
          {comparisonPlayers.length > 0 && (
            <div className="max-w-7xl mx-auto mb-6 glass rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-400" />
                <span className="font-semibold">Comparing {comparisonPlayers.length} player{comparisonPlayers.length > 1 ? 's' : ''}</span>
              </div>
              <button
                onClick={() => setShowComparison(!showComparison)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg transition-all"
              >
                {showComparison ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <span>{showComparison ? 'Hide' : 'Show'} Comparison</span>
              </button>
            </div>
          )}

          {/* Comparison View */}
          {showComparison && comparisonPlayers.length > 0 && (
            <div className="max-w-7xl mx-auto mb-8 glass rounded-2xl p-6">
              <h3 className="text-2xl mb-4 text-emerald-400">HEAD-TO-HEAD COMPARISON</h3>
              <div className="grid grid-cols-3 gap-4">
                {comparisonPlayers.map((player, idx) => (
                  <div key={idx} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="font-bold text-lg mb-2">{player.name}</div>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-slate-400">Win Odds:</span> <span className="text-emerald-400 font-semibold">{player.winOdds}</span></div>
                      <div><span className="text-slate-400">DK Salary:</span> {player.dkSalary}</div>
                      <div><span className="text-slate-400">Course:</span> {player.courseHistory}</div>
                      <div className={`font-semibold ${getRecommendationColor(player.recommendation)}`}>{player.recommendation}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Curated Shortlist Section */}
          <div className="max-w-7xl mx-auto mb-6">
            <h3 className="text-2xl mb-4 text-emerald-400">CURATED SHORTLIST FOR PEBBLE BEACH</h3>
            <p className="text-slate-400 text-sm mb-4">In-depth analysis of top contenders and strategic picks</p>
          </div>

          {/* Players Grid (Shortlist) */}
          <div className="max-w-7xl mx-auto grid gap-6">
            {shortlistPlayers.map((player, idx) => (
              <div
                key={idx}
                className={`glass rounded-2xl p-6 cursor-pointer transition-all hover:scale-[1.01] animate-slide-in bg-gradient-to-br ${getTierColor(player.tier)} border`}
                style={{animationDelay: `${0.2 + idx * 0.05}s`}}
                onClick={() => setSelectedPlayer(selectedPlayer?.name === player.name ? null : player)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold">{player.name}</h3>
                      <span className="px-3 py-1 bg-slate-800/60 rounded-full text-xs font-semibold">
                        {player.tier}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleComparison(player);
                        }}
                        className={`px-3 py-1 rounded-full text-xs transition-all ${
                          comparisonPlayers.find(p => p.name === player.name)
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-700 hover:bg-slate-600'
                        }`}
                      >
                        {comparisonPlayers.find(p => p.name === player.name) ? '✓ Compare' : '+ Compare'}
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm mb-3">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-yellow-400" />
                        <span className="text-slate-400">Win:</span>
                        <span className="font-bold text-emerald-400">{player.winOdds}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-blue-400" />
                        <span className="text-slate-400">Top 5:</span>
                        <span className="font-semibold">{player.top5Odds}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-cyan-400" />
                        <span className="text-slate-400">Top 10:</span>
                        <span className="font-semibold">{player.top10Odds}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <span className="text-slate-400">DK:</span>
                        <span className="font-semibold">{player.dkSalary}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-blue-400" />
                        <span className="text-slate-400">FD:</span>
                        <span className="font-semibold">{player.fdSalary}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-purple-400" />
                        <span className="text-slate-400">Pebble:</span>
                        <span className="font-semibold">{player.courseHistory}</span>
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

                {selectedPlayer?.name === player.name && (
                  <div className="mt-4 pt-4 border-t border-slate-700 space-y-3 animate-slide-in">
                    <div>
                      <div className="text-xs text-slate-400 mb-1">RECENT FORM</div>
                      <div className="text-sm">{player.recentForm}</div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-slate-400 mb-1">STRENGTHS</div>
                      <div className="flex flex-wrap gap-2">
                        {player.strengths.map((s, i) => (
                          <span key={i} className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded text-xs">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-400 mb-1">CONCERNS</div>
                      <div className="flex flex-wrap gap-2">
                        {player.concerns.map((c, i) => (
                          <span key={i} className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-800/60 rounded-lg p-3">
                      <div className="text-xs text-emerald-400 font-semibold mb-1">PEBBLE BEACH NOTES</div>
                      <div className="text-sm">{player.pebbleNotes}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Strategic Summary */}
          <div className="max-w-7xl mx-auto mt-8 glass rounded-2xl p-6">
            <h3 className="text-2xl mb-4 text-emerald-400">STRATEGIC RECOMMENDATIONS</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-green-950/30 border border-green-500/30 rounded-xl p-4">
                <div className="font-bold text-green-400 mb-2 flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  TOP PICKS FOR PEBBLE
                </div>
                <ul className="space-y-1 text-sm">
                  <li>• <strong>Russell Henley</strong> - Perfect course fit, 10 straight top-20s, T5 last year</li>
                  <li>• <strong>Justin Rose</strong> - Won here 2023, elite course history</li>
                  <li>• <strong>Collin Morikawa</strong> - Elite iron play, ball-striker's paradise</li>
                  <li>• <strong>Patrick Cantlay</strong> - High floor, T5 last year, consistent</li>
                </ul>
              </div>
              
              <div className="bg-purple-950/30 border border-purple-500/30 rounded-xl p-4">
                <div className="font-bold text-purple-400 mb-2 flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  SAVE FOR MAJORS
                </div>
                <ul className="space-y-1 text-sm">
                  <li>• <strong>Scottie Scheffler</strong> - Too valuable, save for Masters ($30M effective)</li>
                  <li>• <strong>Xander Schauffele</strong> - Elite player for 1.5x multiplier events</li>
                  <li>• Consider saving Matsuyama too despite hot form</li>
                </ul>
              </div>
            </div>

            <div className="mt-4 bg-yellow-950/30 border border-yellow-500/30 rounded-xl p-4">
              <div className="font-bold text-yellow-400 mb-2">⚡ KEY INSIGHT</div>
              <p className="text-sm">
                With rain and 30mph wind gusts, this favors scramblers and accurate players over bombers. 
                Henley's accuracy and Rose's experience in tough conditions make them even more attractive. 
                Poa annua greens in wet conditions will be tricky - favor proven Pebble performers.
              </p>
            </div>
          </div>
        </>
      )}

      {/* SCENARIO MODELING TAB */}
      {activeTab === 'scenario' && (
        <div className="max-w-7xl mx-auto">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-3xl mb-2 text-emerald-400">SCENARIO MODELING</h2>
            <p className="text-slate-400 mb-6">Compare player allocation strategies - Work in progress. More features coming soon!</p>
            
            <div className="bg-slate-800/50 rounded-xl p-8 text-center">
              <p className="text-slate-400">Scenario modeling functionality will be available in the next update.</p>
            </div>
          </div>
        </div>
      )}

      {/* OTHER TABS - Placeholders */}
      {activeTab !== 'weekly' && activeTab !== 'scenario' && (
        <div className="max-w-7xl mx-auto">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-3xl mb-2 text-emerald-400 capitalize">{activeTab}</h2>
            <p className="text-slate-400 mb-6">This feature is coming soon!</p>
            
            <div className="bg-slate-800/50 rounded-xl p-8 text-center">
              <p className="text-slate-400">Features 2-6 will be built out after deployment.</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="max-w-7xl mx-auto mt-8 text-center text-slate-500 text-sm">
        <p>Data powered by DataGolf • {allPlayers.length} players in database</p>
        <p className="mt-1">Updated for Wednesday, February 11, 2026</p>
      </div>
    </div>
  );
};

export default GolfPoolTool;