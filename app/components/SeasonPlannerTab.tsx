'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, Calendar, Lock, Search, X, GripVertical, TrendingUp, AlertCircle } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';

// Types
interface Tournament {
  id: string;
  event_name: string;
  course_name: string;
  week_number: number;
  segment: string;
  event_type: string;
  purse: number;
  multiplier: number;
  is_completed: boolean;
  start_date: string;
}

interface Pick {
  id: number;
  tournament_id: string;
  player_name: string;
  earnings: number;
  finish_position: number | null;
  week_number?: number;
}

interface Reservation {
  id: number;
  player_name: string;
  dg_id: number;
  week_number: number;
  event_name?: string;
}

interface Player {
  id: number;
  name: string;
  tier: string;
  dg_id: number;
  used_in_tournament_id: string | null;
  used_in_week: number | null;
  owgr_rank?: number;
}

// ── EV Utilities ────────────────────────────────────────────────────────────

// Tier-based probability estimates used for planning future weeks
// (DataGolf live odds only available for the current tournament)
const TIER_PROBS: Record<string, { win: number; top5: number; top10: number; top20: number; make_cut: number }> = {
  'Elite':  { win: 0.080, top5: 0.240, top10: 0.400, top20: 0.580, make_cut: 0.820 },
  'Tier 1': { win: 0.035, top5: 0.120, top10: 0.220, top20: 0.380, make_cut: 0.760 },
  'Tier 2': { win: 0.015, top5: 0.055, top10: 0.110, top20: 0.220, make_cut: 0.670 },
  'Tier 3': { win: 0.005, top5: 0.022, top10: 0.055, top20: 0.140, make_cut: 0.560 },
};

function calcEV(tier: string, purse: number, multiplier: number): number {
  const p = TIER_PROBS[tier] || TIER_PROBS['Tier 3'];
  const ep = purse * multiplier;
  const secondProb = (p.top5 - p.win) * 0.25;
  const top5Only   = p.top5 - p.win - secondProb;
  return (
    p.win                * ep * 0.180 +
    secondProb           * ep * 0.109 +
    top5Only             * ep * 0.048 +
    (p.top10 - p.top5)   * ep * 0.032 +
    (p.top20 - p.top10)  * ep * 0.018 +
    (p.make_cut - p.top20) * ep * 0.008
  );
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(n / 1000)}k`;
}

// ── Draggable Player Card ────────────────────────────────────────────────────

const DraggablePlayerCard = ({
  player,
  isUsed,
  reservation,
  isOverlay,
  isSelected,
  onTap,
}: {
  player: Player;
  isUsed: boolean;
  reservation?: Reservation;
  isOverlay?: boolean;
  isSelected?: boolean;
  onTap?: () => void;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `player-${player.dg_id}`,
    disabled: isUsed,
    data: { player },
  });

  const tierColor: Record<string, string> = {
    'Elite': 'bg-masters-yellow/20 text-masters-yellow border-masters-yellow/30',
    'Tier 1': 'bg-masters-green/30 text-green-300 border-masters-green/40',
    'Tier 2': 'bg-green-800/30 text-green-400 border-green-700/40',
    'Tier 3': 'bg-green-900/30 text-green-500 border-green-800/40',
  };

  return (
    <div
      ref={!isOverlay ? setNodeRef : undefined}
      {...(!isOverlay ? { ...attributes, ...listeners } : {})}
      onClick={onTap}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
        isOverlay
          ? 'bg-masters-dark border-masters-yellow/50 shadow-lg shadow-masters-yellow/20 scale-105'
          : isUsed
          ? 'bg-masters-dark/20 border-green-800/20 opacity-40 cursor-not-allowed'
          : isSelected
          ? 'bg-masters-yellow/10 border-masters-yellow/50 ring-1 ring-masters-yellow/40'
          : isDragging
          ? 'opacity-30'
          : 'bg-masters-dark/50 border-green-800/30 hover:border-green-600/40'
      }`}
    >
      <GripVertical className={`w-3 h-3 flex-shrink-0 ${isUsed ? 'text-green-800/40' : 'text-green-400/40'}`} />
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium truncate ${isUsed ? 'line-through text-green-400/40' : ''}`}>
          {player.name}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${tierColor[player.tier] || tierColor['Tier 3']}`}>
            {player.tier}
          </span>
          {player.owgr_rank && (
            <span className="text-[10px] text-green-300/40">#{player.owgr_rank}</span>
          )}
        </div>
      </div>
      {isUsed && (
        <div className="flex items-center gap-1 text-[10px] text-red-400/60 flex-shrink-0">
          <Lock className="w-3 h-3" />
          W{player.used_in_week}
        </div>
      )}
      {reservation && !isUsed && (
        <div className="text-[10px] text-masters-yellow/70 flex-shrink-0">
          W{reservation.week_number}
        </div>
      )}
    </div>
  );
};

// ── Droppable Event Cell ─────────────────────────────────────────────────────

const DroppableEventCell = ({
  tournament,
  reservation,
  pick,
  onClearReservation,
  isActiveDrag,
  selectedPlayer,
  onTapAssign,
  reservedPlayerTier,
}: {
  tournament: Tournament;
  reservation?: Reservation;
  pick?: Pick;
  onClearReservation: (weekNumber: number) => void;
  isActiveDrag: boolean;
  selectedPlayer: number | null;
  onTapAssign: (weekNumber: number) => void;
  reservedPlayerTier?: string;
}) => {
  const isPicked = !!pick;
  const isReserved = !!reservation && !isPicked;

  const { isOver, setNodeRef } = useDroppable({
    id: `week-${tournament.week_number}`,
    disabled: isPicked,
    data: { tournament },
  });

  const isMajor = tournament.event_type === 'Major';

  const reservedEV = reservedPlayerTier
    ? calcEV(reservedPlayerTier, tournament.purse, tournament.multiplier)
    : null;

  return (
    <div
      ref={setNodeRef}
      onClick={() => {
        if (!isPicked && selectedPlayer) {
          onTapAssign(tournament.week_number);
        }
      }}
      className={`rounded-lg p-2.5 border transition-all min-h-[110px] flex flex-col ${
        isPicked
          ? 'bg-masters-dark/30 border-green-500/20'
          : isOver
          ? 'bg-masters-yellow/10 border-masters-yellow/50 scale-[1.03]'
          : isReserved
          ? 'bg-masters-dark/50 border-masters-yellow/30 border-dashed'
          : isActiveDrag || selectedPlayer
          ? 'bg-masters-dark/40 border-green-600/30 hover:border-masters-yellow/40 cursor-pointer'
          : 'bg-masters-dark/50 border-green-800/30'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono text-green-300/40">W{tournament.week_number}</span>
        <div className="flex items-center gap-1">
          {isMajor && (
            <span className="text-[9px] px-1 py-0.5 bg-masters-azalea/20 border border-masters-azalea/30 rounded text-masters-azalea font-bold">
              MAJ
            </span>
          )}
          <span className="text-[10px] text-masters-yellow/70">
            ${(tournament.purse / 1000000).toFixed(0)}M
            {tournament.multiplier > 1 && <span className="text-masters-azalea">×{tournament.multiplier}</span>}
          </span>
        </div>
      </div>

      {/* Event Name */}
      <div className="text-xs font-semibold truncate mb-auto leading-tight">
        {tournament.event_name}
      </div>

      {/* State Content */}
      {isPicked && (
        <div className="mt-1.5">
          <div className="flex items-center gap-1 text-[10px] text-green-400 mb-0.5">
            <CheckCircle className="w-3 h-3" /> PICKED
          </div>
          <div className="text-xs font-bold text-green-300 truncate">{pick.player_name}</div>
          {pick.earnings > 0 && (
            <div className="text-[10px] text-masters-yellow">{fmtK(pick.earnings)}</div>
          )}
        </div>
      )}

      {isReserved && (
        <div className="mt-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[10px] text-masters-yellow">
              <Calendar className="w-3 h-3" /> PLANNED
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearReservation(tournament.week_number);
              }}
              className="p-0.5 hover:bg-red-500/20 rounded transition-colors"
            >
              <X className="w-3 h-3 text-red-400/50 hover:text-red-400" />
            </button>
          </div>
          <div className="text-xs font-semibold text-masters-yellow truncate">{reservation.player_name}</div>
          {reservedEV !== null && (
            <div className="text-[10px] text-masters-yellow/50 font-mono">
              EV ≈ {fmtK(reservedEV)}
            </div>
          )}
        </div>
      )}

      {!isPicked && !isReserved && (isActiveDrag || selectedPlayer) && (
        <div className="mt-1.5 text-[10px] text-green-300/20 text-center">
          {isActiveDrag ? 'Drop here' : 'Tap to assign'}
        </div>
      )}
    </div>
  );
};

// ── Main Season Planner ──────────────────────────────────────────────────────

const SeasonPlannerTab = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDragPlayer, setActiveDragPlayer] = useState<Player | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // What-If Analyzer state
  const [wiPlayerA, setWiPlayerA] = useState('');
  const [wiTournamentA, setWiTournamentA] = useState('');
  const [wiPlayerB, setWiPlayerB] = useState('');
  const [wiTournamentB, setWiTournamentB] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tourRes, playerRes, pickRes, reserveRes] = await Promise.all([
        fetch('/api/full-schedule'),
        fetch('/api/players'),
        fetch('/api/picks'),
        fetch('/api/reservations'),
      ]);

      const [tourData, playerData, pickData, reserveData] = await Promise.all([
        tourRes.json(),
        playerRes.json(),
        pickRes.json(),
        reserveRes.json(),
      ]);

      setTournaments(tourData.tournaments || []);
      const tierOrder: Record<string, number> = { 'Elite': 0, 'Tier 1': 1, 'Tier 2': 2, 'Tier 3': 3 };
      setPlayers((playerData.players || []).sort((a: Player, b: Player) => {
        const tierDiff = (tierOrder[a.tier] ?? 4) - (tierOrder[b.tier] ?? 4);
        if (tierDiff !== 0) return tierDiff;
        return (a.owgr_rank || 999) - (b.owgr_rank || 999);
      }));
      setPicks(pickData.picks || []);
      setReservations(reserveData.reservations || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load season planner data:', error);
      setLoading(false);
    }
  };

  // Lookup maps
  const reservationByWeek = useMemo(() => {
    const map = new Map<number, Reservation>();
    reservations.forEach(r => map.set(r.week_number, r));
    return map;
  }, [reservations]);

  const reservationByDgId = useMemo(() => {
    const map = new Map<number, Reservation>();
    reservations.forEach(r => map.set(r.dg_id, r));
    return map;
  }, [reservations]);

  const pickByWeek = useMemo(() => {
    const map = new Map<number, Pick>();
    picks.forEach(p => { if (p.week_number) map.set(p.week_number, p); });
    return map;
  }, [picks]);

  const playerByDgId = useMemo(() => {
    const map = new Map<number, Player>();
    players.forEach(p => map.set(p.dg_id, p));
    return map;
  }, [players]);

  // Season projection computations
  const actualEarnings = useMemo(
    () => picks.reduce((sum, p) => sum + (Number(p.earnings) || 0), 0),
    [picks]
  );

  const projectedEV = useMemo(() => {
    return reservations.reduce((sum, r) => {
      const tournament = tournaments.find(t => t.week_number === r.week_number);
      const player = playerByDgId.get(r.dg_id);
      if (!tournament || !player) return sum;
      return sum + calcEV(player.tier, tournament.purse, tournament.multiplier);
    }, 0);
  }, [reservations, tournaments, playerByDgId]);

  const elitePlayers = useMemo(() => players.filter(p => p.tier === 'Elite'), [players]);
  const eliteRemaining = useMemo(
    () => elitePlayers.filter(p => !p.used_in_tournament_id).length,
    [elitePlayers]
  );

  // What-If EV computations
  const wiResultA = useMemo(() => {
    const player = players.find(p => p.name === wiPlayerA);
    const tournament = tournaments.find(t => t.id === wiTournamentA);
    if (!player || !tournament) return null;
    return { ev: calcEV(player.tier, tournament.purse, tournament.multiplier), player, tournament };
  }, [wiPlayerA, wiTournamentA, players, tournaments]);

  const wiResultB = useMemo(() => {
    const player = players.find(p => p.name === wiPlayerB);
    const tournament = tournaments.find(t => t.id === wiTournamentB);
    if (!player || !tournament) return null;
    return { ev: calcEV(player.tier, tournament.purse, tournament.multiplier), player, tournament };
  }, [wiPlayerB, wiTournamentB, players, tournaments]);

  // Filter players for sidebar
  const filteredPlayers = useMemo(() => {
    let filtered = players;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(term));
    }
    return filtered;
  }, [players, searchTerm]);

  // DnD Handlers
  const handleDragStart = (event: DragStartEvent) => {
    const player = event.active.data.current?.player;
    if (player) {
      setActiveDragPlayer(player);
      setSelectedPlayer(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragPlayer(null);
    const { active, over } = event;
    if (!over) return;

    const player = active.data.current?.player as Player;
    const tournament = over.data.current?.tournament as Tournament;
    if (!player || !tournament) return;

    await createReservation(player.dg_id, player.name, tournament.week_number);
  };

  const handleTapAssign = async (weekNumber: number) => {
    if (!selectedPlayer) return;
    const player = players.find(p => p.dg_id === selectedPlayer);
    if (!player) return;

    await createReservation(player.dg_id, player.name, weekNumber);
    setSelectedPlayer(null);
  };

  const handlePlayerTap = (dgId: number) => {
    setSelectedPlayer(prev => prev === dgId ? null : dgId);
  };

  const createReservation = async (dgId: number, playerName: string, weekNumber: number) => {
    const oldReservations = [...reservations];
    setReservations(prev => {
      const filtered = prev.filter(r => r.dg_id !== dgId && r.week_number !== weekNumber);
      return [...filtered, { id: 0, dg_id: dgId, player_name: playerName, week_number: weekNumber }];
    });

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dg_id: dgId, player_name: playerName, week_number: weekNumber }),
      });

      if (!response.ok) {
        setReservations(oldReservations);
        const error = await response.json();
        console.error('Reservation failed:', error);
      } else {
        const res = await fetch('/api/reservations');
        const data = await res.json();
        setReservations(data.reservations || []);
      }
    } catch {
      setReservations(oldReservations);
    }
  };

  const clearReservation = async (weekNumber: number) => {
    const oldReservations = [...reservations];
    setReservations(prev => prev.filter(r => r.week_number !== weekNumber));

    try {
      const response = await fetch('/api/reservations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_number: weekNumber }),
      });
      if (!response.ok) {
        setReservations(oldReservations);
      }
    } catch {
      setReservations(oldReservations);
    }
  };

  const segments = ['Q1', 'Q2', 'Q3', 'Q4'];

  const getSegmentColor = (segment: string) => {
    const colors: Record<string, string> = {
      'Q1': 'text-green-400',
      'Q2': 'text-green-300',
      'Q3': 'text-masters-yellow',
      'Q4': 'text-masters-gold',
    };
    return colors[segment] || 'text-green-300';
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto glass rounded-2xl p-12 text-center">
        <div className="text-green-200/60">Loading season planner...</div>
      </div>
    );
  }

  const usedCount = players.filter(p => p.used_in_tournament_id).length;
  const reservedCount = reservations.length;

  // Available players sorted for what-if dropdowns
  const availablePlayersForWhatIf = players.filter(p => !p.used_in_tournament_id);
  const futureTournaments = tournaments.filter(t => !t.is_completed);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="max-w-7xl mx-auto space-y-4">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="glass rounded-2xl p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl text-masters-yellow">SEASON PLANNER</h2>
                <p className="text-sm text-green-200/60">Drag players onto events · Plan your full season strategy</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-green-300/50">
                <span className="text-green-400 font-bold">{usedCount}</span> picked ·{' '}
                <span className="text-masters-yellow font-bold">{reservedCount}</span> planned ·{' '}
                <span className="text-green-300 font-bold">{28 - usedCount - reservedCount}</span> open
              </div>
            </div>

            {/* Season Projection Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-green-800/30">
              <div className="text-center">
                <div className="text-[10px] text-green-300/50 uppercase tracking-wider mb-0.5">Actual Earnings</div>
                <div className="text-lg font-bold text-green-400">{fmtK(actualEarnings)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-green-300/50 uppercase tracking-wider mb-0.5">Planned EV</div>
                <div className="text-lg font-bold text-masters-yellow/80">
                  {projectedEV > 0 ? `+${fmtK(projectedEV)}` : '—'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-green-300/50 uppercase tracking-wider mb-0.5">Season Projection</div>
                <div className="text-lg font-bold text-masters-yellow">
                  {fmtK(actualEarnings + projectedEV)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-green-300/50 uppercase tracking-wider mb-0.5">Elite Remaining</div>
                <div className="text-lg font-bold text-masters-yellow">
                  {eliteRemaining}
                  <span className="text-sm text-green-300/40"> / {elitePlayers.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: Toggle sidebar button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden w-full glass rounded-xl p-3 flex items-center justify-center gap-2 text-sm text-masters-yellow"
        >
          <Search className="w-4 h-4" />
          {sidebarOpen ? 'Hide Player Pool' : 'Show Player Pool'}
          {selectedPlayer && (
            <span className="ml-2 px-2 py-0.5 bg-masters-yellow/20 rounded-full text-xs">
              Player selected — tap an event
            </span>
          )}
        </button>

        {/* ── Calendar + Sidebar ───────────────────────────────────────── */}
        <div className="flex gap-4">
          {/* Player Pool Sidebar */}
          <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-full md:w-72 flex-shrink-0`}>
            <div className="glass rounded-2xl p-4 md:sticky md:top-6">
              <h3 className="text-lg text-masters-yellow mb-3">Player Pool</h3>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400/40" />
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-masters-dark border border-green-800/30 rounded-lg text-sm text-white focus:border-masters-yellow focus:outline-none"
                />
              </div>

              <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                {['Elite', 'Tier 1', 'Tier 2', 'Tier 3'].map(tier => {
                  const tierPlayers = filteredPlayers.filter(p => p.tier === tier);
                  if (tierPlayers.length === 0) return null;
                  return (
                    <div key={tier}>
                      <div className="text-[10px] font-bold text-green-300/40 uppercase tracking-wider mt-2 mb-1 px-1">
                        {tier} ({tierPlayers.length})
                      </div>
                      {tierPlayers.map(player => {
                        const isUsed = !!player.used_in_tournament_id;
                        const reservation = reservationByDgId.get(player.dg_id);
                        return (
                          <DraggablePlayerCard
                            key={player.dg_id}
                            player={player}
                            isUsed={isUsed}
                            reservation={reservation}
                            isSelected={selectedPlayer === player.dg_id}
                            onTap={() => !isUsed && handlePlayerTap(player.dg_id)}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {!searchTerm && (
                <p className="text-[10px] text-green-300/30 mt-2 text-center">
                  {players.length} players in pool
                </p>
              )}
            </div>
          </div>

          {/* Event Grid */}
          <div className="flex-1 space-y-4">
            {segments.map(segment => {
              const segmentTournaments = tournaments
                .filter(t => t.segment === segment)
                .sort((a, b) => a.week_number - b.week_number);

              return (
                <div key={segment}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className={`text-lg font-bold ${getSegmentColor(segment)}`}>{segment}</h3>
                    <div className="h-px flex-1 bg-green-800/30"></div>
                    <span className="text-xs text-green-300/40">
                      Weeks {segmentTournaments[0]?.week_number}–{segmentTournaments[segmentTournaments.length - 1]?.week_number}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                    {segmentTournaments.map(tournament => {
                      const reservation = reservationByWeek.get(tournament.week_number);
                      const reservedPlayer = reservation ? playerByDgId.get(reservation.dg_id) : undefined;
                      return (
                        <DroppableEventCell
                          key={tournament.id}
                          tournament={tournament}
                          reservation={reservation}
                          pick={pickByWeek.get(tournament.week_number)}
                          onClearReservation={clearReservation}
                          isActiveDrag={!!activeDragPlayer}
                          selectedPlayer={selectedPlayer}
                          onTapAssign={handleTapAssign}
                          reservedPlayerTier={reservedPlayer?.tier}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── What-If Analyzer ─────────────────────────────────────────── */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-masters-yellow" />
            <h3 className="text-xl text-masters-yellow">WHAT-IF ANALYZER</h3>
            <span className="text-xs text-green-300/40 ml-1">Compare two scenarios side-by-side</span>
          </div>

          {/* Scenario Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Scenario A */}
            <div className="bg-masters-dark/40 border border-green-800/30 rounded-xl p-4">
              <div className="text-xs font-bold text-green-300/60 uppercase tracking-wider mb-3">Scenario A</div>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-green-300/50 uppercase tracking-wider block mb-1">Player</label>
                  <select
                    value={wiPlayerA}
                    onChange={e => setWiPlayerA(e.target.value)}
                    className="w-full bg-masters-dark border border-green-800/40 rounded-lg px-3 py-2 text-sm text-white focus:border-masters-yellow focus:outline-none"
                  >
                    <option value="">Select player...</option>
                    {['Elite', 'Tier 1', 'Tier 2', 'Tier 3'].map(tier => (
                      <optgroup key={tier} label={tier}>
                        {availablePlayersForWhatIf
                          .filter(p => p.tier === tier)
                          .map(p => (
                            <option key={p.dg_id} value={p.name}>{p.name}</option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-green-300/50 uppercase tracking-wider block mb-1">Tournament</label>
                  <select
                    value={wiTournamentA}
                    onChange={e => setWiTournamentA(e.target.value)}
                    className="w-full bg-masters-dark border border-green-800/40 rounded-lg px-3 py-2 text-sm text-white focus:border-masters-yellow focus:outline-none"
                  >
                    <option value="">Select tournament...</option>
                    {futureTournaments.map(t => (
                      <option key={t.id} value={t.id}>
                        W{t.week_number} · {t.event_name}{t.multiplier > 1 ? ` (×${t.multiplier})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Scenario A Result */}
              {wiResultA && (
                <div className="mt-3 pt-3 border-t border-green-800/30">
                  <div className="text-[10px] text-green-300/50 mb-1">
                    {wiResultA.player.name} @ {wiResultA.tournament.event_name}
                  </div>
                  <div className="text-[10px] text-green-300/40">
                    W{wiResultA.tournament.week_number} · ${(wiResultA.tournament.purse / 1_000_000).toFixed(0)}M purse
                    {wiResultA.tournament.multiplier > 1 && (
                      <span className="text-masters-azalea"> ×{wiResultA.tournament.multiplier} multiplier</span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-bold text-masters-yellow">{fmtK(wiResultA.ev)}</span>
                    <span className="text-xs text-green-300/50">expected value</span>
                  </div>
                  <div className="text-[10px] text-green-300/40 mt-1">
                    {wiResultA.player.tier} · {(TIER_PROBS[wiResultA.player.tier]?.win * 100 || 0).toFixed(1)}% win · {(TIER_PROBS[wiResultA.player.tier]?.top10 * 100 || 0).toFixed(0)}% top-10
                  </div>
                </div>
              )}
            </div>

            {/* Scenario B */}
            <div className="bg-masters-dark/40 border border-green-800/30 rounded-xl p-4">
              <div className="text-xs font-bold text-green-300/60 uppercase tracking-wider mb-3">Scenario B</div>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-green-300/50 uppercase tracking-wider block mb-1">Player</label>
                  <select
                    value={wiPlayerB}
                    onChange={e => setWiPlayerB(e.target.value)}
                    className="w-full bg-masters-dark border border-green-800/40 rounded-lg px-3 py-2 text-sm text-white focus:border-masters-yellow focus:outline-none"
                  >
                    <option value="">Select player...</option>
                    {['Elite', 'Tier 1', 'Tier 2', 'Tier 3'].map(tier => (
                      <optgroup key={tier} label={tier}>
                        {availablePlayersForWhatIf
                          .filter(p => p.tier === tier)
                          .map(p => (
                            <option key={p.dg_id} value={p.name}>{p.name}</option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-green-300/50 uppercase tracking-wider block mb-1">Tournament</label>
                  <select
                    value={wiTournamentB}
                    onChange={e => setWiTournamentB(e.target.value)}
                    className="w-full bg-masters-dark border border-green-800/40 rounded-lg px-3 py-2 text-sm text-white focus:border-masters-yellow focus:outline-none"
                  >
                    <option value="">Select tournament...</option>
                    {futureTournaments.map(t => (
                      <option key={t.id} value={t.id}>
                        W{t.week_number} · {t.event_name}{t.multiplier > 1 ? ` (×${t.multiplier})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Scenario B Result */}
              {wiResultB && (
                <div className="mt-3 pt-3 border-t border-green-800/30">
                  <div className="text-[10px] text-green-300/50 mb-1">
                    {wiResultB.player.name} @ {wiResultB.tournament.event_name}
                  </div>
                  <div className="text-[10px] text-green-300/40">
                    W{wiResultB.tournament.week_number} · ${(wiResultB.tournament.purse / 1_000_000).toFixed(0)}M purse
                    {wiResultB.tournament.multiplier > 1 && (
                      <span className="text-masters-azalea"> ×{wiResultB.tournament.multiplier} multiplier</span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-bold text-masters-yellow">{fmtK(wiResultB.ev)}</span>
                    <span className="text-xs text-green-300/50">expected value</span>
                  </div>
                  <div className="text-[10px] text-green-300/40 mt-1">
                    {wiResultB.player.tier} · {(TIER_PROBS[wiResultB.player.tier]?.win * 100 || 0).toFixed(1)}% win · {(TIER_PROBS[wiResultB.player.tier]?.top10 * 100 || 0).toFixed(0)}% top-10
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Comparison Result */}
          {wiResultA && wiResultB && (() => {
            const diff = wiResultA.ev - wiResultB.ev;
            const winner = diff > 0 ? 'A' : 'B';
            const absDiff = Math.abs(diff);
            const winnerResult = winner === 'A' ? wiResultA : wiResultB;
            const isSamePlayer = wiPlayerA === wiPlayerB;
            const severity = absDiff > 200_000 ? 'high' : absDiff > 75_000 ? 'medium' : 'low';
            const severityColor = severity === 'high'
              ? 'border-masters-yellow/50 bg-masters-yellow/5'
              : severity === 'medium'
              ? 'border-green-500/40 bg-green-900/20'
              : 'border-green-700/40 bg-masters-dark/30';

            return (
              <div className={`rounded-xl border p-4 ${severityColor}`}>
                <div className="flex items-start gap-3">
                  <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${severity === 'high' ? 'text-masters-yellow' : 'text-green-400'}`} />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-white mb-1">
                      Scenario {winner} is worth {fmtK(absDiff)} more
                    </div>
                    <div className="text-xs text-green-200/70">
                      {isSamePlayer ? (
                        <>
                          <strong className="text-white">{winnerResult.player.name}</strong> generates higher EV at{' '}
                          <strong className="text-masters-yellow">{winnerResult.tournament.event_name}</strong>
                          {winnerResult.tournament.multiplier > 1 && (
                            <> thanks to the <strong className="text-masters-azalea">×{winnerResult.tournament.multiplier} multiplier</strong></>
                          )}
                          .{' '}
                          {winner === 'A'
                            ? 'Consider using them here over the alternative.'
                            : 'Consider saving them for this tournament instead.'}
                        </>
                      ) : (
                        <>
                          <strong className="text-white">{winnerResult.player.name}</strong> at{' '}
                          <strong className="text-masters-yellow">{winnerResult.tournament.event_name}</strong> is the stronger play.
                          {winnerResult.tournament.multiplier > 1 && (
                            <> The <strong className="text-masters-azalea">×{winnerResult.tournament.multiplier} multiplier</strong> significantly boosts the EV.</>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex gap-4 mt-2 text-[10px] text-green-300/50">
                      <span>A: {fmtK(wiResultA.ev)}</span>
                      <span>B: {fmtK(wiResultB.ev)}</span>
                      <span className={diff > 0 ? 'text-masters-yellow' : 'text-green-400'}>
                        Δ {diff > 0 ? '+' : ''}{fmtK(diff)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Placeholder when no scenarios selected */}
          {!wiResultA && !wiResultB && (
            <div className="text-center py-6 text-green-300/30 text-sm">
              Select a player and tournament for each scenario to compare expected values
            </div>
          )}

          {/* EV Legend */}
          <div className="mt-4 pt-3 border-t border-green-800/20">
            <div className="text-[10px] text-green-300/30 mb-2 uppercase tracking-wider">EV Estimates by Tier</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(TIER_PROBS).map(([tier, probs]) => (
                <div key={tier} className="text-center">
                  <div className="text-[10px] font-bold text-green-300/50">{tier}</div>
                  <div className="text-[10px] text-green-300/30">
                    {(probs.win * 100).toFixed(1)}% win · {(probs.top10 * 100).toFixed(0)}% top-10
                  </div>
                  <div className="text-[10px] text-masters-yellow/50 font-mono">
                    {fmtK(calcEV(tier, 9_000_000, 1))} / $9M event
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeDragPlayer && (
          <DraggablePlayerCard
            player={activeDragPlayer}
            isUsed={false}
            isOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default SeasonPlannerTab;
