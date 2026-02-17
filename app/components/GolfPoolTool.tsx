import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Trophy, DollarSign, Target, Cloud, Wind, Droplets, ChevronDown, ChevronUp, Star, Clock, Calendar, Users } from 'lucide-react';

const GolfPoolTool = () => {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonPlayers, setComparisonPlayers] = useState([]);
  const [activeTab, setActiveTab] = useState('weekly'); // 'weekly', 'scenario', 'roster', 'schedule', 'calculator', 'stats'
  const [scenarioA, setScenarioA] = useState(null);
  const [scenarioB, setScenarioB] = useState(null);

  // Pebble Beach tournament data
  const tournamentInfo = {
    name: "AT&T Pebble Beach Pro-Am",
    purse: "$20M",
    effectivePurse: "$20M",
    multiplier: "1.0x (Signature Event)",
    segment: "Q1",
    deadline: "Tonight, 9 hours",
    weather: {
      conditions: "Rain & Wind",
      temp: "58-62°F",
      wind: "15-18 mph, gusts to 31 mph",
      precipitation: "90% chance",
      impact: "Challenging conditions - favors scramblers"
    }
  };

  // Upcoming tournaments for scenario modeling
  const upcomingTournaments = [
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

  // Player data for your shortlist
  const players = [
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
    },
  ];

  const getTierColor = (tier) => {
    if (tier.includes("Elite")) return "from-yellow-500/20 to-yellow-600/20 border-yellow-500/50";
    if (tier === "Tier 2") return "from-blue-500/20 to-blue-600/20 border-blue-500/50";
    return "from-gray-500/20 to-gray-600/20 border-gray-500/50";
  };

  const getRecommendationColor = (rec) => {
    if (rec.includes("TOP PICK") || rec.includes("STRONG")) return "text-green-400";
    if (rec.includes("SAVE")) return "text-purple-400";
    if (rec.includes("AVOID")) return "text-red-400";
    return "text-yellow-400";
  };

  const toggleComparison = (player) => {
    if (comparisonPlayers.find(p => p.name === player.name)) {
      setComparisonPlayers(comparisonPlayers.filter(p => p.name !== player.name));
    } else if (comparisonPlayers.length < 3) {
      setComparisonPlayers([...comparisonPlayers, player]);
    }
  };

  // Scenario modeling functions
  const parseOdds = (oddsString) => {
    const odds = parseInt(oddsString.replace('+', ''));
    return odds > 0 ? (100 / (odds + 100)) : (Math.abs(odds) / (Math.abs(odds) + 100));
  };

  const calculateExpectedValue = (player, tournament) => {
    const winProb = parseOdds(player.winOdds);
    const top5Prob = parseOdds(player.top5Odds);
    const top10Prob = parseOdds(player.top10Odds);
    
    const effectivePurse = tournament.purse * tournament.multiplier;
    
    // Estimated payout percentages
    const winPayout = effectivePurse * 0.18; // ~18% to winner
    const top5AvgPayout = effectivePurse * 0.08; // ~8% avg for top 5
    const top10AvgPayout = effectivePurse * 0.04; // ~4% avg for top 10
    const top20AvgPayout = effectivePurse * 0.02; // ~2% avg for top 20
    
    const expectedValue = 
      (winProb * winPayout) + 
      ((top5Prob - winProb) * top5AvgPayout) + 
      ((top10Prob - top5Prob) * top10AvgPayout) +
      ((0.7 - top10Prob) * top20AvgPayout); // assume 70% make top 20 in no-cut events
    
    return expectedValue;
  };

  const buildScenario = (playerName, tournamentName) => {
    const player = players.find(p => p.name === playerName);
    const tournament = upcomingTournaments.find(t => t.name === tournamentName);
    
    if (!player || !tournament) return null;
    
    const ev = calculateExpectedValue(player, tournament);
    
    return {
      player,
      tournament,
      expectedValue: ev,
      effectivePurse: tournament.purse * tournament.multiplier
    };
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
          {/* Tournament Info Card */}
          <div className="max-w-7xl mx-auto mb-8 glass rounded-2xl p-6 glow animate-slide-in" style={{animationDelay: '0.1s'}}>
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

          {/* Players Grid */}
          <div className="max-w-7xl mx-auto grid gap-6">
            {players.map((player, idx) => (
              <div
                key={idx}
                className={`glass rounded-2xl p-6 cursor-pointer transition-all hover:scale-[1.01] animate-slide-in bg-gradient-to-br ${getTierColor(player.tier)} border`}
                style={{animationDelay: `${0.1 + idx * 0.05}s`}}
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
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="glass rounded-2xl p-6 glow">
            <h2 className="text-3xl mb-2 text-emerald-400">SCENARIO MODELING</h2>
            <p className="text-slate-400 mb-6">Compare different player allocation strategies across tournaments</p>

            {/* Scenario Builder */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Scenario A */}
              <div className="bg-gradient-to-br from-blue-950/50 to-slate-900/50 rounded-xl p-6 border border-blue-500/30">
                <h3 className="text-xl font-bold mb-4 text-blue-400">SCENARIO A</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Player</label>
                    <select 
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                      onChange={(e) => {
                        const scenario = buildScenario(e.target.value, document.getElementById('scenarioA-tournament').value);
                        setScenarioA(scenario);
                      }}
                      id="scenarioA-player"
                    >
                      <option value="">Select player...</option>
                      {players.map(p => (
                        <option key={p.name} value={p.name}>{p.name} ({p.tier})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Tournament</label>
                    <select 
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                      onChange={(e) => {
                        const scenario = buildScenario(document.getElementById('scenarioA-player').value, e.target.value);
                        setScenarioA(scenario);
                      }}
                      id="scenarioA-tournament"
                    >
                      <option value="">Select tournament...</option>
                      {upcomingTournaments.map(t => (
                        <option key={t.name} value={t.name}>
                          {t.name} ({t.type}) - ${t.purse}M {t.multiplier > 1 ? `x${t.multiplier}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {scenarioA && (
                    <div className="mt-6 p-4 bg-slate-800/60 rounded-lg border border-blue-500/30">
                      <div className="text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Effective Purse:</span>
                          <span className="font-bold text-blue-400">${scenarioA.effectivePurse.toFixed(1)}M</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Win Odds:</span>
                          <span className="font-semibold">{scenarioA.player.winOdds}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Expected Value:</span>
                          <span className="font-bold text-emerald-400">${(scenarioA.expectedValue / 1000000).toFixed(2)}M</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Scenario B */}
              <div className="bg-gradient-to-br from-purple-950/50 to-slate-900/50 rounded-xl p-6 border border-purple-500/30">
                <h3 className="text-xl font-bold mb-4 text-purple-400">SCENARIO B</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Player</label>
                    <select 
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                      onChange={(e) => {
                        const scenario = buildScenario(e.target.value, document.getElementById('scenarioB-tournament').value);
                        setScenarioB(scenario);
                      }}
                      id="scenarioB-player"
                    >
                      <option value="">Select player...</option>
                      {players.map(p => (
                        <option key={p.name} value={p.name}>{p.name} ({p.tier})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Tournament</label>
                    <select 
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                      onChange={(e) => {
                        const scenario = buildScenario(document.getElementById('scenarioB-player').value, e.target.value);
                        setScenarioB(scenario);
                      }}
                      id="scenarioB-tournament"
                    >
                      <option value="">Select tournament...</option>
                      {upcomingTournaments.map(t => (
                        <option key={t.name} value={t.name}>
                          {t.name} ({t.type}) - ${t.purse}M {t.multiplier > 1 ? `x${t.multiplier}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {scenarioB && (
                    <div className="mt-6 p-4 bg-slate-800/60 rounded-lg border border-purple-500/30">
                      <div className="text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Effective Purse:</span>
                          <span className="font-bold text-purple-400">${scenarioB.effectivePurse.toFixed(1)}M</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Win Odds:</span>
                          <span className="font-semibold">{scenarioB.player.winOdds}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Expected Value:</span>
                          <span className="font-bold text-emerald-400">${(scenarioB.expectedValue / 1000000).toFixed(2)}M</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Comparison Result */}
            {scenarioA && scenarioB && (
              <div className="glass rounded-xl p-6 border-2 border-emerald-500/50">
                <h3 className="text-2xl font-bold mb-4 text-emerald-400">COMPARISON RESULTS</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-slate-400 text-sm mb-2">Expected Value Difference</div>
                    <div className={`text-3xl font-bold ${
                      scenarioA.expectedValue > scenarioB.expectedValue ? 'text-blue-400' : 'text-purple-400'
                    }`}>
                      ${Math.abs((scenarioA.expectedValue - scenarioB.expectedValue) / 1000000).toFixed(2)}M
                    </div>
                    <div className="text-sm text-slate-400 mt-1">
                      {scenarioA.expectedValue > scenarioB.expectedValue ? 'Scenario A higher' : 'Scenario B higher'}
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-slate-400 text-sm mb-2">Opportunity Cost</div>
                    <div className="text-2xl font-bold text-yellow-400">
                      {((Math.abs(scenarioA.expectedValue - scenarioB.expectedValue) / Math.max(scenarioA.expectedValue, scenarioB.expectedValue)) * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-slate-400 mt-1">
                      Potential upside difference
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-slate-400 text-sm mb-2">Recommendation</div>
                    <div className={`text-xl font-bold ${
                      scenarioA.expectedValue > scenarioB.expectedValue ? 'text-blue-400' : 'text-purple-400'
                    }`}>
                      {scenarioA.expectedValue > scenarioB.expectedValue ? 'Choose Scenario A' : 'Choose Scenario B'}
                    </div>
                    <div className="text-sm text-slate-400 mt-1">
                      Based on expected value
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-yellow-950/30 border border-yellow-500/30 rounded-lg">
                  <div className="font-semibold text-yellow-400 mb-2">💡 Strategic Notes</div>
                  <div className="text-sm space-y-2">
                    {scenarioA.tournament.multiplier > 1 && (
                      <div>• {scenarioA.player.name} at {scenarioA.tournament.name} benefits from {scenarioA.tournament.multiplier}x multiplier (Major)</div>
                    )}
                    {scenarioB.tournament.multiplier > 1 && (
                      <div>• {scenarioB.player.name} at {scenarioB.tournament.name} benefits from {scenarioB.tournament.multiplier}x multiplier (Major)</div>
                    )}
                    {scenarioA.player.tier === "Elite" && scenarioA.tournament.multiplier === 1.0 && (
                      <div>• ⚠️ Using elite player {scenarioA.player.name} at non-major - consider saving</div>
                    )}
                    {scenarioB.player.tier === "Elite" && scenarioB.tournament.multiplier === 1.0 && (
                      <div>• ⚠️ Using elite player {scenarioB.player.name} at non-major - consider saving</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Scenarios */}
            <div className="mt-8">
              <h3 className="text-xl font-bold mb-4 text-slate-300">QUICK COMPARISONS</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    document.getElementById('scenarioA-player').value = 'Scottie Scheffler';
                    document.getElementById('scenarioA-tournament').value = 'AT&T Pebble Beach';
                    document.getElementById('scenarioB-player').value = 'Scottie Scheffler';
                    document.getElementById('scenarioB-tournament').value = 'The Masters';
                    setScenarioA(buildScenario('Scottie Scheffler', 'AT&T Pebble Beach'));
                    setScenarioB(buildScenario('Scottie Scheffler', 'The Masters'));
                  }}
                  className="glass p-4 rounded-xl hover:bg-slate-800/50 transition-all text-left border border-slate-700 hover:border-emerald-500/50"
                >
                  <div className="font-semibold mb-1">Scheffler: Pebble vs Masters</div>
                  <div className="text-sm text-slate-400">Should you use him now or save for major?</div>
                </button>

                <button
                  onClick={() => {
                    document.getElementById('scenarioA-player').value = 'Russell Henley';
                    document.getElementById('scenarioA-tournament').value = 'AT&T Pebble Beach';
                    document.getElementById('scenarioB-player').value = 'Collin Morikawa';
                    document.getElementById('scenarioB-tournament').value = 'AT&T Pebble Beach';
                    setScenarioA(buildScenario('Russell Henley', 'AT&T Pebble Beach'));
                    setScenarioB(buildScenario('Collin Morikawa', 'AT&T Pebble Beach'));
                  }}
                  className="glass p-4 rounded-xl hover:bg-slate-800/50 transition-all text-left border border-slate-700 hover:border-emerald-500/50"
                >
                  <div className="font-semibold mb-1">Henley vs Morikawa at Pebble</div>
                  <div className="text-sm text-slate-400">Which Tier 2 for this week?</div>
                </button>

                <button
                  onClick={() => {
                    document.getElementById('scenarioA-player').value = 'Xander Schauffele';
                    document.getElementById('scenarioA-tournament').value = 'Players Championship';
                    document.getElementById('scenarioB-player').value = 'Xander Schauffele';
                    document.getElementById('scenarioB-tournament').value = 'PGA Championship';
                    setScenarioA(buildScenario('Xander Schauffele', 'Players Championship'));
                    setScenarioB(buildScenario('Xander Schauffele', 'PGA Championship'));
                  }}
                  className="glass p-4 rounded-xl hover:bg-slate-800/50 transition-all text-left border border-slate-700 hover:border-emerald-500/50"
                >
                  <div className="font-semibold mb-1">Xander: Players vs PGA</div>
                  <div className="text-sm text-slate-400">$25M purse vs $27.75M effective purse</div>
                </button>

                <button
                  onClick={() => {
                    document.getElementById('scenarioA-player').value = 'Patrick Cantlay';
                    document.getElementById('scenarioA-tournament').value = 'AT&T Pebble Beach';
                    document.getElementById('scenarioB-player').value = 'Patrick Cantlay';
                    document.getElementById('scenarioB-tournament').value = 'Memorial Tournament';
                    setScenarioA(buildScenario('Patrick Cantlay', 'AT&T Pebble Beach'));
                    setScenarioB(buildScenario('Patrick Cantlay', 'Memorial Tournament'));
                  }}
                  className="glass p-4 rounded-xl hover:bg-slate-800/50 transition-all text-left border border-slate-700 hover:border-emerald-500/50"
                >
                  <div className="font-semibold mb-1">Cantlay: Now vs Later</div>
                  <div className="text-sm text-slate-400">Both $20M signature events</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="max-w-7xl mx-auto mt-8 text-center text-slate-500 text-sm">
        <p>Data compiled from DraftKings, FanDuel, and expert consensus • Weather from NWS</p>
        <p className="mt-1">Updated for Wednesday, February 11, 2026</p>
      </div>
    </div>
  );
};

export default GolfPoolTool;
