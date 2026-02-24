'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, DollarSign, Target, Clock, Calendar, Users, CheckCircle, XCircle, Search, Lock, TrendingUp, AlertCircle, Award, Zap, Shield, Map } from 'lucide-react';
import SeasonPlannerTab from './SeasonPlannerTab';

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
  winner?: string;
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
  is_completed?: boolean;
  purse?: number;
  multiplier?: number;
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
  ev?: number;
  form?: {
    score: number;
    category: string;
    top_10_last_5: number;
    missed_cuts_last_5: number;
    withdrawals_last_5: number;
    last_5_results: Array<{
      event_name: string;
      finish: string;
      made_cut: boolean;
      withdrew: boolean;
    }>;
  } | null;
  enrichment?: {
    course_history_adj: number;
    course_fit_adj: number;
    sg_ott: number;
    sg_app: number;
    sg_arg: number;
    sg_putt: number;
    sg_total: number;
    driving_acc: number;
    driving_dist: number;
    baseline_pred: number;
    final_pred: number;
  } | null;
  course_history?: {
    times_played: number;
    times_made_cut: number;
    cut_percentage: number;
    average_finish: number | null;
    best_finish: number | null;
  } | null;
}

interface CourseSpecialist {
  dg_id: number;
  player_name: string;
  times_played: number;
  times_made_cut: number;
  cut_percentage: number;
  average_finish: number | null;
  best_finish: number | null;
}

interface WeatherForecastDay {
  date: string;
  day: string;
  temp_high: number;
  temp_low: number | null;
  wind_speed: number;
  wind_direction: string;
  precipitation: number;
  conditions: string;
  icon: string;
}

interface WeatherData {
  tournament_name: string;
  course_name: string;
  start_date: string;
  forecast: WeatherForecastDay[];
  impact: {
    severity: 'low' | 'medium' | 'high';
    message: string;
    favors: string;
  } | null;
}

// Helper function for dollar formatting
const formatDollar = (amount: number) => {
  return '$' + Math.round(amount).toLocaleString();
};

// Tournament Field Component
type FieldSortKey = 'owgr' | 'win_odds' | 'win_probability' | 'make_cut_probability' | 'dk_salary';

const TournamentFieldTab = () => {
  const [field, setField] = useState<any[]>([]);
  const [eventName, setEventName] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<FieldSortKey>('owgr');
  const [sortAsc, setSortAsc] = useState(true);
  const [usedDgIds, setUsedDgIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadField();
    loadUsedPlayers();
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

  const loadUsedPlayers = async () => {
    try {
      const response = await fetch('/api/players');
      if (response.ok) {
        const data = await response.json();
        const ids = new Set<number>(
          (data.players || [])
            .filter((p: any) => p.used_in_tournament_id !== null)
            .map((p: any) => p.dg_id)
        );
        setUsedDgIds(ids);
      }
    } catch (error) {
      console.error('Failed to load players:', error);
    }
  };

  const handleSort = (key: FieldSortKey) => {
    if (sortBy === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(key);
      // Default sort direction: ascending for owgr/win_odds, descending for probabilities/salary
      setSortAsc(key === 'owgr' || key === 'win_odds');
    }
  };

  const sortedField = [...field].sort((a, b) => {
    const aVal = a[sortBy] ?? 999999;
    const bVal = b[sortBy] ?? 999999;
    return sortAsc ? aVal - bVal : bVal - aVal;
  });

  const formatOdds = (odds: number | null) => {
    if (!odds) return 'N/A';
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  const SortHeader = ({ label, sortKey, className = '' }: { label: string; sortKey: FieldSortKey; className?: string }) => (
    <button
      onClick={() => handleSort(sortKey)}
      className={`text-xs text-green-300/40 hover:text-green-100 transition-colors flex items-center gap-1 ${className}`}
    >
      {label}
      {sortBy === sortKey && (
        <span className="text-masters-yellow">{sortAsc ? '▲' : '▼'}</span>
      )}
    </button>
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass rounded-2xl p-12 text-center">
        <div className="text-green-200/60">Loading tournament field...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="glass rounded-2xl p-6">
        <h2 className="text-3xl mb-2 text-masters-yellow">TOURNAMENT FIELD</h2>
        <p className="text-green-200/60 mb-4">{eventName}</p>

        {/* Table Header */}
        <div className="bg-masters-dark/70 rounded-lg px-4 py-2 flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <div className="w-8"></div>
            <div className="text-xs text-green-300/40">Player</div>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-16 text-right hidden md:block"><SortHeader label="OWGR" sortKey="owgr" className="justify-end" /></div>
            <div className="w-20 text-right"><SortHeader label="Odds" sortKey="win_odds" className="justify-end" /></div>
            <div className="w-16 text-right hidden md:block"><SortHeader label="Win %" sortKey="win_probability" className="justify-end" /></div>
            <div className="w-16 text-right hidden md:block"><SortHeader label="Cut %" sortKey="make_cut_probability" className="justify-end" /></div>
            <div className="w-20 text-right hidden md:block"><SortHeader label="DK Salary" sortKey="dk_salary" className="justify-end" /></div>
          </div>
        </div>

        <div className="space-y-1">
          {sortedField.map((player, idx) => {
            const isUsed = usedDgIds.has(player.dg_id);
            return (
            <div
              key={player.dg_id}
              className={`rounded-lg px-4 py-3 flex items-center justify-between transition-all ${
                isUsed ? 'bg-masters-dark/30 opacity-50' : 'bg-masters-dark/50 hover:bg-masters-dark/70'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="text-green-300/40 font-mono w-8 text-sm">{idx + 1}</div>
                <div>
                  <div className={`font-bold text-sm ${isUsed ? 'line-through text-green-300/40' : ''}`}>{player.name}</div>
                  <div className="text-xs text-green-300/40">
                    {player.country}
                    {isUsed && <span className="ml-2 text-amber-500/70">USED</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="w-16 text-right hidden md:block">
                  <div className="font-semibold text-sm">#{player.owgr || 'N/A'}</div>
                </div>
                <div className="w-20 text-right">
                  <div className="font-semibold text-sm text-masters-yellow">{formatOdds(player.win_odds)}</div>
                </div>
                <div className="w-16 text-right hidden md:block">
                  <div className="font-semibold text-sm">
                    {player.win_probability != null ? `${(player.win_probability * 100).toFixed(1)}%` : 'N/A'}
                  </div>
                </div>
                <div className="w-16 text-right hidden md:block">
                  <div className="font-semibold text-sm">
                    {player.make_cut_probability != null ? `${(player.make_cut_probability * 100).toFixed(0)}%` : 'N/A'}
                  </div>
                </div>
                <div className="w-20 text-right hidden md:block">
                  <div className="font-semibold text-sm">
                    {player.dk_salary ? `$${(player.dk_salary / 1000).toFixed(1)}K` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Schedule Component
const ScheduleTab = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
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
        <div className="text-green-200/60">Loading schedule...</div>
      </div>
    );
  }

  const getSegmentColor = (segment: string) => {
    const colors: any = {
      'Q1': 'bg-masters-green/20 border-masters-green/40',
      'Q2': 'bg-green-700/20 border-green-600/40',
      'Q3': 'bg-masters-yellow/10 border-masters-yellow/30',
      'Q4': 'bg-masters-gold/10 border-masters-gold/30'
    };
    return colors[segment] || 'bg-green-800/20 border-green-700/50';
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="glass rounded-2xl p-6">
        <h2 className="text-3xl mb-6 text-masters-yellow">FULL SEASON SCHEDULE</h2>
        
        <div className="grid gap-4">
          {tournaments.map((tournament) => (
            <div 
              key={tournament.id}
              className={`rounded-lg p-4 border ${
                tournament.is_completed ? 'bg-masters-dark/30' : 'bg-masters-dark/50'
              } ${getSegmentColor(tournament.segment)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-mono text-green-200/60">
                      Week {tournament.week_number}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getSegmentColor(tournament.segment)}`}>
                      {tournament.segment}
                    </span>
                    {tournament.event_type === 'Major' && (
                      <span className="px-2 py-0.5 bg-masters-azalea/20 border border-masters-azalea/40 rounded-full text-xs font-semibold text-masters-azalea">
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
                  <p className="text-sm text-green-200/60">
                    {tournament.course_name} • {tournament.city}, {tournament.country}
                  </p>
                  
                  {tournament.is_completed && tournament.winner && (
                    <p className="text-sm text-masters-yellow mt-2">
                      Winner: {tournament.winner}
                    </p>
                  )}
                </div>
                
                <div className="text-right">
                  <div className="text-sm text-green-300/40">
                    {new Date(tournament.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-lg font-bold text-masters-yellow">
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

// Form Section Component
const FormSection = ({ form }: { form: NonNullable<PlayerRecommendation['form']> }) => {
  const [expanded, setExpanded] = React.useState(false);

  const badge =
    form.category === 'hot' ? { label: '🔥 HOT', cls: 'bg-amber-500/20 border-amber-500/40 text-amber-300' } :
    form.category === 'cold' ? { label: '🧊 COLD', cls: 'bg-blue-500/20 border-blue-500/40 text-blue-300' } :
    null;

  // Trend arrow: compare most-recent half vs older half of results
  // Results are most-recent-first; lower position = better in golf
  const trend = (() => {
    const results = form.last_5_results;
    if (results.length < 3) return null;

    const toNum = (r: { made_cut: boolean; withdrew: boolean; finish: string }) => {
      if (r.withdrew) return 80;
      if (!r.made_cut) return 70;
      const pos = parseInt(r.finish.replace(/^T/, ''), 10);
      return isNaN(pos) ? 70 : pos;
    };

    const nums = results.map(toNum);
    const mid = Math.ceil(nums.length / 2);
    // recent = indexes 0..mid-1 (most recent), older = indexes mid..end
    const avgRecent = nums.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const avgOlder  = nums.slice(mid).reduce((a, b) => a + b, 0) / (nums.length - mid);

    // Dynamic threshold: 8 positions or 20% of the average, whichever is larger
    const threshold = Math.max(8, avgOlder * 0.2);
    const diff = avgRecent - avgOlder; // negative = improving (lower position = better)

    if (diff < -threshold) return { arrow: '↗', label: 'Improving', cls: 'text-green-400' };
    if (diff > threshold)  return { arrow: '↘', label: 'Declining',  cls: 'text-red-400' };
    return { arrow: '→', label: 'Steady', cls: 'text-green-300/40' };
  })();

  const finishIcon = (r: { made_cut: boolean; withdrew: boolean; finish: string }) => {
    if (r.withdrew) return <span className="text-orange-400">✗</span>;
    if (!r.made_cut) return <span className="text-red-400">✗</span>;
    const pos = parseInt(r.finish.replace(/^T/, ''), 10);
    if (!isNaN(pos) && pos <= 10) return <span className="text-green-400">✓</span>;
    return <span className="text-green-300/40">·</span>;
  };

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between text-xs text-green-300/60 hover:text-green-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-green-200/60">
            Recent Form <span className="font-normal text-green-300/40">(last {form.last_5_results.length})</span>
          </span>
          {badge && (
            <span className={`px-1.5 py-0.5 border rounded-full text-[10px] font-bold ${badge.cls}`}>
              {badge.label}
            </span>
          )}
          {trend && (
            <span className={`text-sm font-bold ${trend.cls}`} title={trend.label}>
              {trend.arrow}
            </span>
          )}
          <span className="text-green-300/40">
            {form.top_10_last_5} top-10 · {form.missed_cuts_last_5} MC · {form.withdrawals_last_5} WD
          </span>
        </div>
        <span className="text-green-300/40">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && form.last_5_results.length > 0 && (
        <div className="mt-1.5 space-y-0.5 border border-green-800/30 rounded-lg p-2">
          {form.last_5_results.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                {finishIcon(r)}
                <span className="text-green-200/60 truncate">{r.event_name}</span>
              </div>
              <span className={`font-semibold ml-2 shrink-0 ${
                r.withdrew ? 'text-orange-400' :
                !r.made_cut ? 'text-red-400' :
                parseInt(r.finish.replace(/^T/, ''), 10) <= 10 ? 'text-green-400' :
                'text-green-200/60'
              }`}>
                {r.finish}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Main Component
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
  const [narrativeError, setNarrativeError] = useState<{ playerId: number; message: string } | null>(null);
  const [courseSpecialists, setCourseSpecialists] = useState<CourseSpecialist[]>([]);
  const [showSpecialists, setShowSpecialists] = useState(false);
  const [courseHistoryDetail, setCourseHistoryDetail] = useState<Record<number, any[]>>({});
  const [expandedCourseHistory, setExpandedCourseHistory] = useState<Record<number, boolean>>({});
  const [loadingCourseHistory, setLoadingCourseHistory] = useState<Record<number, boolean>>({});
  
  // Segment standings
  const [segmentStandings, setSegmentStandings] = useState<SegmentStanding[]>([]);
  const [allPicks, setAllPicks] = useState<Pick[]>([]);

  // Result entry state
  const [editingPickId, setEditingPickId] = useState<number | null>(null);
  const [editFinishPosition, setEditFinishPosition] = useState('');
  const [editEarnings, setEditEarnings] = useState('');
  const [savingResult, setSavingResult] = useState(false);

  // Reservations state (for rec card badges)
  const [reservations, setReservations] = useState<{dg_id: number; player_name: string; week_number: number; event_name?: string}[]>([]);

  // Weather state
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const [showWeatherSuitability, setShowWeatherSuitability] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadCurrentTournament();
    loadPlayers();
    loadPicks();
    loadSegmentStandings();
    loadRecommendations();
    loadReservations();
    loadWeather();
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
        const tournamentPick = (picksData.picks || []).find((p: Pick) => p.tournament_id === data.tournament.id);
        
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
      setAllPicks(data.picks || []);
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

  const loadReservations = async () => {
    try {
      const response = await fetch('/api/reservations');
      if (response.ok) {
        const data = await response.json();
        setReservations(data.reservations || []);
      }
    } catch (error) {
      console.error('Failed to load reservations:', error);
    }
  };

  const loadWeather = async () => {
    try {
      const res = await fetch('/api/tournament-weather');
      if (res.ok) setWeatherData(await res.json());
    } catch (error) {
      console.error('Failed to load weather:', error);
    } finally {
      setLoadingWeather(false);
    }
  };

  const savePickResult = async (pickId: number) => {
    const earnings = parseFloat(editEarnings.replace(/[,$]/g, ''));
    if (isNaN(earnings)) return;

    setSavingResult(true);
    try {
      const response = await fetch('/api/picks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pick_id: pickId,
          finish_position: editFinishPosition ? parseInt(editFinishPosition) : null,
          earnings
        })
      });

      if (response.ok) {
        setEditingPickId(null);
        setEditFinishPosition('');
        setEditEarnings('');
        loadPicks();
        loadSegmentStandings();
      }
    } catch (error) {
      console.error('Failed to save result:', error);
    }
    setSavingResult(false);
  };

  const loadRecommendations = async () => {
    try {
      setLoadingRecommendations(true);
      const response = await fetch('/api/weekly-recommendations');
      
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.top_picks || []);
        setNextMajor(data.next_major);
        setCourseSpecialists(data.course_specialists || []);
      } else {
        console.error('Failed to load recommendations');
      }
      setLoadingRecommendations(false);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
      setLoadingRecommendations(false);
    }
  };

  const loadCourseHistoryDetail = async (dgId: number, eventId: string | number) => {
    if (dgId in courseHistoryDetail) {
      setExpandedCourseHistory(prev => ({ ...prev, [dgId]: !prev[dgId] }));
      return;
    }
    setLoadingCourseHistory(prev => ({ ...prev, [dgId]: true }));
    setExpandedCourseHistory(prev => ({ ...prev, [dgId]: true }));
    try {
      const res = await fetch(`/api/course-history?dg_id=${dgId}&event_id=${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setCourseHistoryDetail(prev => ({ ...prev, [dgId]: data.history || [] }));
      }
    } catch (error) {
      console.error('Failed to load course history detail:', error);
      setCourseHistoryDetail(prev => ({ ...prev, [dgId]: [] }));
    } finally {
      setLoadingCourseHistory(prev => ({ ...prev, [dgId]: false }));
    }
  };

  const generateNarrative = async (player: PlayerRecommendation) => {
    setLoadingNarrativeFor(player.dg_id);
    setNarrativeError(null);

    try {
      // Calculate actual course fit comparison
      const courseFitComparison = player.course_fit && player.win_probability
        ? ((player.course_fit / player.win_probability - 1) * 100).toFixed(0)
        : null;

      const response = await fetch('/api/generate-narratives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          players: [{
            ...player,
            enrichment: player.enrichment,
            course_fit_comparison: courseFitComparison
          }],
          tournament: currentTournament?.event_name || 'this tournament',
          context: {
            week_number: currentTournament?.week_number,
            segment: currentTournament?.segment,
            next_major: nextMajor
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData.error || `API error: ${response.status}`;
        console.error('Narrative API error:', msg, errData.details);
        setNarrativeError({ playerId: player.dg_id, message: msg });
        return;
      }

      const data = await response.json();
      const narrative = data.narratives?.[player.dg_id];
      const tier = data.tiers?.[player.dg_id];

      if (!narrative) {
        console.error('No narrative returned for player:', player.dg_id);
        setNarrativeError({ playerId: player.dg_id, message: 'No narrative returned from API' });
        return;
      }

      // Update the player's narrative AND tier in state
      setRecommendations(prev => prev.map(p =>
        p.dg_id === player.dg_id ? {
          ...p,
          narrative,
          recommendation_tier: tier || p.recommendation_tier
        } : p
      ));
    } catch (error) {
      console.error('Failed to generate narrative:', error);
      setNarrativeError({ playerId: player.dg_id, message: 'Network error' });
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
        loadPicks();
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
    if (tier.includes("Elite")) return "from-masters-yellow/15 to-masters-gold/10 border-masters-yellow/40";
    if (tier === "Tier 1") return "from-masters-green/20 to-masters-dark/20 border-masters-green/40";
    if (tier === "Tier 2") return "from-green-800/15 to-green-900/15 border-green-700/30";
    return "from-green-900/10 to-green-950/10 border-green-800/20";
  };

  const getRecommendationColor = (rec: string) => {
    if (rec.includes("USE NOW")) return "text-masters-yellow";
    if (rec.includes("TOP PICK")) return "text-masters-yellow";
    if (rec.includes("STRONG")) return "text-green-400";
    if (rec.includes("SAVE")) return "text-amber-400";
    if (rec.includes("VALUE")) return "text-green-300";
    if (rec.includes("PLAYABLE")) return "text-masters-gold";
    if (rec.includes("LONGSHOT")) return "text-orange-400";
    return "text-green-200/60";
  };

  const getRecommendationIcon = (rec: string) => {
    if (rec.includes("USE NOW")) return Award;
    if (rec.includes("TOP PICK")) return Award;
    if (rec.includes("STRONG")) return Zap;
    if (rec.includes("SAVE")) return Shield;
    if (rec.includes("LONGSHOT")) return TrendingUp;
    return Target;
  };

  const formatOdds = (odds: number) => {
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  if (loadingTournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-masters-darker via-masters-dark to-masters-green text-green-50 flex items-center justify-center">
        <div className="text-2xl text-masters-yellow">Loading tournament data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-masters-darker via-masters-dark to-masters-green text-green-50 p-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&display=swap');

        * {
          font-family: 'Inter', sans-serif;
        }

        h1, h2, h3 {
          font-family: 'Playfair Display', serif;
          letter-spacing: 0.02em;
        }

        .glass {
          background: rgba(0, 55, 42, 0.5);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(254, 209, 65, 0.1);
        }

        .glow {
          box-shadow: 0 0 30px rgba(254, 209, 65, 0.1);
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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-7xl mb-2 bg-gradient-to-r from-masters-yellow to-masters-gold bg-clip-text text-transparent" style={{ fontFamily: "'Pinyon Script', cursive" }}>
              Pimento Command Center
            </h1>
            <p className="text-green-200/60 text-lg">One & Done Earnings Pool • 171 Entries • $25,650 Pot</p>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            className="mt-3 px-4 py-2 bg-green-900/40 hover:bg-green-900/70 border border-green-800/30 text-green-300/60 hover:text-green-200 rounded-lg text-sm transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Segment Standings Bar */}
      {segmentStandings.length > 0 && (
        <div className="max-w-7xl mx-auto mb-6 space-y-4">
          {/* Season Total */}
          <div className="glass rounded-xl p-4 text-center">
            <div className="text-sm text-green-200/60">Season Total</div>
            <div className="text-4xl font-bold text-masters-yellow">
              {formatDollar(segmentStandings[0]?.season_total_earnings || 0)}
            </div>
            <div className="text-xs text-green-300/40 mt-1">
              {segmentStandings.reduce((sum, s) => sum + s.events_completed, 0)}/28 events
            </div>
          </div>

          {/* Segment Breakdown */}
          <div className="flex gap-4">
            {segmentStandings.map((standing) => (
              <div key={standing.segment} className="glass rounded-xl p-4 flex-1 text-center">
                <div className="text-xs text-green-200/60">{standing.segment}</div>
                <div className="text-2xl font-bold text-masters-yellow">
                  {formatDollar(standing.total_earnings || 0)}
                </div>
                <div className="text-xs text-green-300/40">
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
            { id: 'planner', label: 'Planner', icon: Map },
            { id: 'stats', label: 'My Picks', icon: Trophy }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-masters-green text-white font-semibold'
                    : 'bg-transparent text-green-200/60 hover:bg-masters-dark/50 hover:text-green-100'
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
                  <div className="text-sm text-green-200/60 mb-1">
                    YOUR PICK - WEEK {currentTournament.week_number}
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                    <div>
                      <div className="text-3xl font-bold text-masters-yellow">{currentPick.player_name}</div>
                      <div className="text-sm text-green-200/60">
                        {currentTournament.event_name}
                        {currentPick.finish_position && ` • Finished T${currentPick.finish_position}`}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-green-200/60">Earnings</div>
                  <div className="text-2xl font-bold text-masters-yellow">
                    {formatDollar(currentPick.earnings)}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-2xl mb-4 text-masters-yellow">
                  MAKE YOUR PICK - WEEK {currentTournament.week_number}
                </h3>
                
                {loadingPlayers ? (
                  <div className="text-center py-8 text-green-200/60">Loading players...</div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-green-200/60" />
                      <input
                        type="text"
                        placeholder="Search for a player..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-masters-dark border border-green-800/30 rounded-lg text-white focus:border-masters-yellow focus:outline-none"
                      />
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm text-green-200/60 mb-2">
                          Select Player ({filteredPlayers.length} {searchTerm ? 'results' : 'shown'})
                        </label>
                        <select
                          value={selectedPickPlayer}
                          onChange={(e) => setSelectedPickPlayer(e.target.value)}
                          className="w-full px-4 py-3 bg-masters-dark border border-green-800/30 rounded-lg text-white focus:border-masters-yellow focus:outline-none"
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
                        <div className="text-xs text-green-300/40 mt-1">
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
                              ? 'bg-green-900/50 text-green-300/40 cursor-not-allowed'
                              : 'bg-masters-green hover:bg-green-700 text-white glow'
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
                <h2 className="text-3xl mb-1 text-masters-yellow">{currentTournament.event_name}</h2>
                <p className="text-green-200/60">
                  Week {currentTournament.week_number} • {currentTournament.segment} • {currentTournament.event_type}
                </p>
                <p className="text-sm text-green-300/40 mt-1">
                  {currentTournament.course_name} • {currentTournament.city}, {currentTournament.country}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-masters-yellow">
                  ${(currentTournament.purse / 1000000).toFixed(1)}M
                </div>
                <div className="text-sm text-green-200/60">
                  {currentTournament.multiplier}x multiplier
                </div>
                <div className="text-xs text-green-300/40 mt-1">
                  {new Date(currentTournament.start_date).toLocaleDateString()} - {new Date(currentTournament.end_date).toLocaleDateString()}
                </div>
              </div>
            </div>

            {nextMajor && (
              <div className="bg-masters-azalea/10 border border-masters-azalea/30 rounded-xl p-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-masters-azalea" />
                <div className="text-sm">
                  <span className="text-masters-azalea font-semibold">Next Major:</span>{' '}
                  <span className="text-green-100">{nextMajor.name}</span>{' '}
                  <span className="text-green-300/40">({nextMajor.weeks_away} weeks away)</span>
                </div>
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className="max-w-7xl mx-auto mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-3xl text-masters-yellow">TOP PICKS BY EXPECTED VALUE</h3>
                <p className="text-sm text-green-300/40">
                  Live odds & probabilities • DataGolf analysis • Click to generate AI insights
                </p>
              </div>
              <button
                onClick={loadRecommendations}
                disabled={loadingRecommendations}
                className="px-4 py-2 bg-masters-green/20 hover:bg-masters-green/30 rounded-lg text-sm transition-all"
              >
                {loadingRecommendations ? 'Updating...' : 'Refresh Data'}
              </button>
            </div>
          </div>

          {/* Tournament Weather */}
          {(loadingWeather || weatherData) && (
            <div className="max-w-7xl mx-auto mb-4">
              <div className="glass rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowWeather(s => !s)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-masters-dark/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🌤️</span>
                    <span className="font-semibold text-sm text-masters-yellow">TOURNAMENT WEATHER</span>
                    {weatherData && (
                      <span className="text-xs text-green-300/40">{weatherData.course_name}</span>
                    )}
                  </div>
                  <span className="text-green-300/40 text-sm">{showWeather ? '▲' : '▼'}</span>
                </button>

                {showWeather && (
                  <div className="border-t border-green-800/30 px-4 pb-4 pt-3">
                    {loadingWeather ? (
                      <div className="grid grid-cols-4 gap-3">
                        {[0, 1, 2, 3].map(i => (
                          <div key={i} className="bg-masters-dark/40 rounded-lg p-3 animate-pulse">
                            <div className="h-3 bg-green-800/40 rounded mb-2 w-3/4" />
                            <div className="h-6 bg-green-800/40 rounded mb-2" />
                            <div className="h-3 bg-green-800/40 rounded w-1/2" />
                          </div>
                        ))}
                      </div>
                    ) : weatherData && weatherData.forecast.length > 0 ? (
                      <>
                        <div className="grid grid-cols-4 gap-3 mb-3">
                          {weatherData.forecast.map(day => (
                            <div key={day.date} className="bg-masters-dark/40 rounded-lg p-3 text-center">
                              <div className="text-xs text-green-300/40 font-semibold mb-1">
                                {day.day.substring(0, 3).toUpperCase()}
                              </div>
                              <div className="text-2xl mb-1">{day.icon}</div>
                              <div className="text-sm font-bold text-green-50">
                                {day.temp_high}°
                                {day.temp_low != null && (
                                  <span className="text-green-300/40 font-normal">/{day.temp_low}°</span>
                                )}
                              </div>
                              <div className="text-xs text-green-300/40 mt-1">
                                {day.wind_speed} mph {day.wind_direction}
                              </div>
                              <div className="text-xs text-blue-300/70 mt-0.5">
                                {day.precipitation > 0 ? `${day.precipitation}% rain` : 'No rain'}
                              </div>
                            </div>
                          ))}
                        </div>
                        {weatherData.impact && (
                          <div className={`rounded-lg px-3 py-2 flex items-start gap-2 text-sm ${
                            weatherData.impact.severity === 'high'
                              ? 'bg-red-900/30 border border-red-500/30 text-red-300'
                              : 'bg-amber-900/30 border border-amber-500/30 text-amber-300'
                          }`}>
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold">{weatherData.impact.message}</span>
                              <span className="text-xs ml-2 opacity-70">Favors: {weatherData.impact.favors}</span>
                            </div>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Course History + Weather Suitability — side by side when both available */}
          {(courseSpecialists.length > 0 || weatherData || recommendations.length > 0) && (() => {
            // Read conditions directly from forecast data for more sensitive metric switching
            const maxPrecip = Math.max(...(weatherData?.forecast ?? []).map(d => d.precipitation), 0);
            const maxWind   = Math.max(...(weatherData?.forecast ?? []).map(d => d.wind_speed), 0);
            // >35% rain → soft conditions favour distance; >15 mph wind → accuracy matters; else overall
            const metric: 'sg_ott' | 'sg_app' | 'sg_total' =
              maxPrecip > 35 ? 'sg_ott' :
              maxWind   > 15 ? 'sg_app' :
              'sg_total';
            const metricLabel = metric === 'sg_ott' ? 'SG:OTT' : metric === 'sg_app' ? 'SG:APP' : 'SG:Total';
            const suitedPlayers = recommendations.length > 0
              ? [...recommendations]
                  .filter(r => r.enrichment?.[metric] != null)
                  .sort((a, b) => Number(b.enrichment?.[metric] ?? 0) - Number(a.enrichment?.[metric] ?? 0))
                  .slice(0, 8)
              : [];
            const hasCourse = courseSpecialists.length > 0;
            const hasWeather = suitedPlayers.length > 0;

            return (
              <div className={`max-w-7xl mx-auto mb-4 ${hasCourse && hasWeather ? 'grid grid-cols-2 gap-4 items-start' : ''}`}>

                {/* Course History */}
                {hasCourse && (
                  <div className="glass rounded-xl overflow-hidden">
                    <button
                      onClick={() => setShowSpecialists(s => !s)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-masters-dark/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Map className="w-4 h-4 text-masters-yellow" />
                        <span className="font-semibold text-sm text-masters-yellow">COURSE HISTORY</span>
                        <span className="text-xs text-green-300/40">
                          Best at {currentTournament?.course_name}
                        </span>
                      </div>
                      <span className="text-green-300/40 text-sm">{showSpecialists ? '▲' : '▼'}</span>
                    </button>
                    {showSpecialists && (
                      <div className="border-t border-green-800/30 px-4 pb-3">
                        <div className="space-y-1.5 pt-2">
                          {courseSpecialists.map((s, i) => (
                            <div key={s.dg_id} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-green-300/40 w-5 text-right font-mono text-xs">{i + 1}.</span>
                                <span className="font-semibold">{s.player_name}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-green-200/60">
                                <span>{s.times_played}x</span>
                                {s.average_finish != null && <span>Avg {Number(s.average_finish).toFixed(1)}</span>}
                                {s.best_finish != null && (
                                  <span>Best {s.best_finish === 1 ? 'Win' : `T${s.best_finish}`}</span>
                                )}
                                <span>{Math.round(Number(s.cut_percentage))}% cuts</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Weather Suitability */}
                {hasWeather && (
                  <div className="glass rounded-xl overflow-hidden">
                    <button
                      onClick={() => setShowWeatherSuitability(s => !s)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-masters-dark/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">
                          {metric === 'sg_ott' ? '💪' : metric === 'sg_app' ? '🎯' : '⛳'}
                        </span>
                        <span className="font-semibold text-sm text-masters-yellow">
                          {metric === 'sg_ott' ? 'DISTANCE ADVANTAGE' : metric === 'sg_app' ? 'ACCURACY ADVANTAGE' : 'TOP BALL-STRIKERS'}
                        </span>
                        <span className="text-xs text-green-300/40">{metricLabel}</span>
                      </div>
                      <span className="text-green-300/40 text-sm">{showWeatherSuitability ? '▲' : '▼'}</span>
                    </button>
                    {showWeatherSuitability && (
                      <div className="border-t border-green-800/30 px-4 pb-3 pt-1">
                        <div className="text-xs text-green-300/40 mb-2">
                          {weatherData?.impact?.message ?? (
                            metric === 'sg_ott' ? 'Rain likely — soft conditions favour distance players' :
                            metric === 'sg_app' ? 'Wind expected — accuracy players have the edge' :
                            'Favorable conditions — best overall ball-strikers in the field'
                          )}
                        </div>
                        <div className="space-y-1.5">
                          {suitedPlayers.map((rec, i) => (
                            <div key={rec.dg_id} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-green-300/40 w-5 text-right font-mono text-xs">{i + 1}.</span>
                                <span className="font-semibold">{rec.name}</span>
                                <span className="text-xs text-green-300/40">{rec.tier}</span>
                              </div>
                              <span className={`text-xs font-mono font-semibold ${Number(rec.enrichment?.[metric] ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {Number(rec.enrichment?.[metric] ?? 0) > 0 ? '+' : ''}
                                {Number(rec.enrichment?.[metric] ?? 0).toFixed(2)} {metricLabel}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {loadingRecommendations ? (
            <div className="max-w-7xl mx-auto glass rounded-2xl p-12 text-center">
              <div className="text-green-200/60">Loading recommendations...</div>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="max-w-7xl mx-auto glass rounded-2xl p-12 text-center">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-green-300/40" />
              <div className="text-green-200/60">No recommendations available. Check back closer to tournament start.</div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((rec, idx) => {
                const Icon = getRecommendationIcon(rec.recommendation_tier);

                return (
                  <div
                    key={rec.dg_id}
                    className={`glass rounded-xl p-4 transition-all hover:scale-[1.01] bg-gradient-to-br ${getTierColor(rec.tier)} border ${
                      rec.is_used ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Header: Rank, Name, Tier, EV */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="shrink-0 text-center">
                          <div className="text-lg font-bold text-green-200/60">#{idx + 1}</div>
                          <div className="text-[10px] text-green-300/40 leading-none">OWGR {rec.owgr_rank}</div>
                        </div>
                        <h4 className="text-lg font-bold truncate">{rec.name}</h4>
                        <span className="px-1.5 py-0.5 bg-masters-dark/60 rounded-full text-xs font-semibold shrink-0">
                          {rec.tier}
                        </span>
                        {rec.is_used && (
                          <span className="px-1.5 py-0.5 bg-red-500/30 rounded-full text-xs font-semibold flex items-center gap-1 shrink-0">
                            <Lock className="w-3 h-3" />
                            W{rec.used_week}
                          </span>
                        )}
                        {!rec.is_used && (() => {
                          const res = reservations.find(r => r.dg_id === rec.dg_id);
                          return res ? (
                            <span className="px-1.5 py-0.5 bg-masters-yellow/15 border border-masters-yellow/30 rounded-full text-[10px] font-semibold text-masters-yellow flex items-center gap-1 shrink-0">
                              <Calendar className="w-3 h-3" />
                              Reserved for {res.event_name || `W${res.week_number}`}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="text-xs text-green-300/40">EV</div>
                        <div className="text-sm font-bold text-masters-yellow">
                          {rec.ev ? formatDollar(rec.ev) : 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Core Stats */}
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        <div className="bg-masters-dark/30 rounded px-2 py-1">
                          <span className="text-green-300/40">Odds </span>
                          <span className="font-bold text-masters-yellow">{formatOdds(rec.win_odds)}</span>
                        </div>
                        <div className="bg-masters-dark/30 rounded px-2 py-1">
                          <span className="text-green-300/40">Win </span>
                          <span className="font-semibold">{(rec.win_probability * 100).toFixed(1)}%</span>
                        </div>
                        <div className="bg-masters-dark/30 rounded px-2 py-1">
                          <span className="text-green-300/40">T5 </span>
                          <span className="font-semibold">{(rec.top_5_probability * 100).toFixed(1)}%</span>
                        </div>
                        <div className="bg-masters-dark/30 rounded px-2 py-1">
                          <span className="text-green-300/40">T10 </span>
                          <span className="font-semibold">{(rec.top_10_probability * 100).toFixed(1)}%</span>
                        </div>
                        <div className="bg-masters-dark/30 rounded px-2 py-1">
                          <span className="text-green-300/40">Cut </span>
                          <span className="font-semibold">{(rec.make_cut_probability * 100).toFixed(1)}%</span>
                        </div>
                        <div className="bg-masters-dark/30 rounded px-2 py-1">
                          <span className="text-green-300/40">DK </span>
                          <span className="font-semibold">{rec.dk_salary ? `$${(rec.dk_salary / 1000).toFixed(1)}K` : 'N/A'}</span>
                        </div>
                      </div>

                      {/* Skill Badges */}
                      {rec.enrichment && (
                        <div className="flex flex-wrap gap-1.5">
                          {rec.enrichment.sg_total && (
                            <div className="px-1.5 py-0.5 bg-masters-green/20 border border-masters-yellow/30 rounded text-xs">
                              <span className="text-masters-yellow font-bold">
                                {Number(rec.enrichment.sg_total) > 0 ? '+' : ''}{Number(rec.enrichment.sg_total).toFixed(2)}
                              </span>
                              <span className="text-green-200/60 ml-1">SG</span>
                            </div>
                          )}
                          {Number(rec.enrichment.sg_putt) > 0.4 && (
                            <div className="px-1.5 py-0.5 bg-masters-yellow/15 border border-masters-yellow/30 rounded text-xs text-masters-yellow">
                              Elite Putter
                            </div>
                          )}
                          {Number(rec.enrichment.sg_app) > 0.8 && (
                            <div className="px-1.5 py-0.5 bg-green-600/20 border border-green-500/40 rounded text-xs text-green-300">
                              Elite Irons
                            </div>
                          )}
                          {Number(rec.enrichment.sg_ott) > 0.6 && (
                            <div className="px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/50 rounded text-xs text-yellow-300">
                              Elite Driver
                            </div>
                          )}
                          {Number(rec.enrichment.driving_dist) > 10 && (
                            <div className="px-1.5 py-0.5 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-300">
                              Bomber
                            </div>
                          )}
                          {rec.enrichment.course_history_adj && Math.abs(rec.enrichment.course_history_adj) > 0.05 && (
                            <div className={`px-1.5 py-0.5 rounded text-xs ${
                              Number(rec.enrichment.course_history_adj) > 0
                                ? 'bg-green-500/20 border border-green-500/50 text-green-300'
                                : 'bg-orange-500/20 border border-orange-500/50 text-orange-300'
                            }`}>
                              {Number(rec.enrichment.course_history_adj) > 0 ? '+' : ''}{(Number(rec.enrichment.course_history_adj) * 100).toFixed(1)}% Course Hx
                            </div>
                          )}
                        </div>
                      )}

                      {/* Strokes Gained Statistics */}
                      {rec.enrichment && (
                        <div className="text-xs border border-green-800/30 rounded-lg p-2.5">
                          <div className="text-green-200/60 font-semibold mb-1.5">Strokes Gained Statistics</div>
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <div className="text-green-300/40">OTT</div>
                              <div className={Number(rec.enrichment.sg_ott) > 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                                {Number(rec.enrichment.sg_ott) > 0 ? '+' : ''}{Number(rec.enrichment.sg_ott)?.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-green-300/40">APP</div>
                              <div className={Number(rec.enrichment.sg_app) > 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                                {Number(rec.enrichment.sg_app) > 0 ? '+' : ''}{Number(rec.enrichment.sg_app)?.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-green-300/40">ARG</div>
                              <div className={Number(rec.enrichment.sg_arg) > 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                                {Number(rec.enrichment.sg_arg) > 0 ? '+' : ''}{Number(rec.enrichment.sg_arg)?.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-green-300/40">PUTT</div>
                              <div className={Number(rec.enrichment.sg_putt) > 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                                {Number(rec.enrichment.sg_putt) > 0 ? '+' : ''}{Number(rec.enrichment.sg_putt)?.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Course History */}
                    {rec.course_history && (
                      <div className="mt-2">
                        <button
                          onClick={() => loadCourseHistoryDetail(rec.dg_id, currentTournament?.id || '')}
                          className="w-full flex items-center justify-between text-xs text-green-300/60 hover:text-green-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-green-200/60">Course History</span>
                            <span className="text-green-300/40">
                              {rec.course_history.times_played} starts
                              {rec.course_history.average_finish != null && ` · Avg ${Number(rec.course_history.average_finish).toFixed(1)}`}
                              {rec.course_history.best_finish != null && ` · Best ${rec.course_history.best_finish === 1 ? 'Win' : `T${rec.course_history.best_finish}`}`}
                              {` · ${Math.round(Number(rec.course_history.cut_percentage))}% cuts`}
                            </span>
                          </div>
                          <span className="text-green-300/40">
                            {loadingCourseHistory[rec.dg_id] ? '···' : expandedCourseHistory[rec.dg_id] ? '▲' : '▼'}
                          </span>
                        </button>
                        {expandedCourseHistory[rec.dg_id] && (
                          <div className="mt-1.5 border border-green-800/30 rounded-lg p-2">
                            {loadingCourseHistory[rec.dg_id] ? (
                              <div className="text-xs text-green-300/40 text-center py-1">Loading...</div>
                            ) : courseHistoryDetail[rec.dg_id]?.length > 0 ? (
                              <div className="space-y-0.5">
                                {courseHistoryDetail[rec.dg_id].map((h: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between text-xs">
                                    <span className="text-green-300/40">{h.year}</span>
                                    <span className={`font-semibold ${
                                      h.withdrew ? 'text-orange-400' :
                                      !h.made_cut ? 'text-red-400' :
                                      parseInt(String(h.finish_label).replace(/^T/, ''), 10) <= 10 ? 'text-green-400' :
                                      'text-green-200/60'
                                    }`}>
                                      {h.finish_label}
                                    </span>
                                    {h.earnings && (
                                      <span className="text-green-300/40">
                                        {(() => {
                                          const num = Number(String(h.earnings).replace(/[$,]/g, ''));
                                          if (isNaN(num)) return h.earnings;
                                          if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
                                          if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
                                          return `$${num}`;
                                        })()}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-green-300/40 text-center py-1">No historical data found</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recent Form */}
                    {rec.form && (
                      <FormSection form={rec.form} />
                    )}

                    {/* AI Narrative / Generate Button */}
                    <div className="mt-3">
                      {rec.narrative ? (
                        <div className="p-2.5 bg-masters-darker/60 rounded-lg border border-green-800/30">
                          {rec.narrative && (
                            <div className={`flex items-center gap-1.5 text-sm font-bold mb-1.5 ${getRecommendationColor(rec.recommendation_tier)}`}>
                              <Icon className="w-4 h-4" />
                              <span>{rec.recommendation_tier}</span>
                            </div>
                          )}
                          <div className="text-xs text-green-100 leading-relaxed">
                            {rec.narrative}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <button
                            onClick={() => generateNarrative(rec)}
                            disabled={loadingNarrativeFor === rec.dg_id}
                            className="w-full px-3 py-1.5 bg-masters-green/20 hover:bg-masters-green/30 border border-masters-yellow/30 rounded-lg text-xs font-semibold text-masters-yellow transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {loadingNarrativeFor === rec.dg_id ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-masters-yellow border-t-transparent rounded-full animate-spin"></div>
                                Generating...
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                                </svg>
                                {narrativeError?.playerId === rec.dg_id ? 'Retry AI Analysis' : 'Generate AI Analysis'}
                              </>
                            )}
                          </button>
                          {narrativeError?.playerId === rec.dg_id && (
                            <div className="mt-1 text-xs text-red-400 text-center">
                              {narrativeError.message}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Strategic Note */}
                    {rec.strategic_note && (
                      <div className="mt-2 text-xs text-yellow-400 flex items-center gap-1">
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

      {/* TOURNAMENT FIELD TAB */}
      {activeTab === 'roster' && <TournamentFieldTab />}

      {/* SCHEDULE TAB */}
      {activeTab === 'schedule' && <ScheduleTab />}

      {/* SEASON PLANNER TAB */}
      {activeTab === 'planner' && <SeasonPlannerTab />}

      {/* MY PICKS TAB */}
      {activeTab === 'stats' && (
        <div className="max-w-7xl mx-auto">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-3xl mb-6 text-masters-yellow">MY PICKS</h2>

            {allPicks.length === 0 ? (
              <div className="text-center py-12 text-green-200/60">
                <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No picks yet. Make your first pick!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {allPicks.map((pick) => (
                  <div key={pick.id} className="bg-masters-dark/50 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-lg">{pick.player_name}</div>
                        <div className="text-sm text-green-200/60">
                          Week {pick.week_number} • {pick.event_name}
                          {pick.segment && <span className="ml-2 text-xs text-green-300/40">({pick.segment})</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        {pick.finish_position || pick.earnings > 0 ? (
                          <div className="flex items-center gap-3">
                            {pick.finish_position && (
                              <div className="text-sm text-green-200/60">T{pick.finish_position}</div>
                            )}
                            <div className="text-xl font-bold text-masters-yellow">
                              {formatDollar(pick.earnings)}
                            </div>
                            <button
                              onClick={() => {
                                setEditingPickId(pick.id);
                                setEditFinishPosition(pick.finish_position?.toString() || '');
                                setEditEarnings(pick.earnings.toString());
                              }}
                              className="text-xs text-green-300/40 hover:text-green-100 ml-1"
                            >
                              Edit
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingPickId(pick.id);
                              setEditFinishPosition('');
                              setEditEarnings('');
                            }}
                            className="px-3 py-1 bg-masters-green/30 text-masters-yellow text-sm rounded-lg hover:bg-green-700/50 transition-colors"
                          >
                            Enter Result
                          </button>
                        )}
                      </div>
                    </div>

                    {editingPickId === pick.id && (
                      <div className="mt-3 pt-3 border-t border-green-800/30 flex items-end gap-3">
                        <div>
                          <label className="block text-xs text-green-200/60 mb-1">Finish Position</label>
                          <input
                            type="number"
                            min="1"
                            max="200"
                            placeholder="e.g. 15"
                            value={editFinishPosition}
                            onChange={(e) => setEditFinishPosition(e.target.value)}
                            className="w-24 px-2 py-1.5 bg-green-900/50 border border-green-700/30 rounded-lg text-sm text-white focus:outline-none focus:border-masters-yellow"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-green-200/60 mb-1">Earnings ($)</label>
                          <input
                            type="text"
                            placeholder="e.g. 150000"
                            value={editEarnings}
                            onChange={(e) => setEditEarnings(e.target.value)}
                            className="w-32 px-2 py-1.5 bg-green-900/50 border border-green-700/30 rounded-lg text-sm text-white focus:outline-none focus:border-masters-yellow"
                          />
                        </div>
                        <button
                          onClick={() => savePickResult(pick.id)}
                          disabled={savingResult || !editEarnings}
                          className="px-4 py-1.5 bg-masters-green text-white text-sm rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors"
                        >
                          {savingResult ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingPickId(null);
                            setEditFinishPosition('');
                            setEditEarnings('');
                          }}
                          className="px-3 py-1.5 text-green-200/60 text-sm hover:text-green-100 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="max-w-7xl mx-auto mt-8 text-center text-green-200/30 text-sm">
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

export default GolfPoolTool;