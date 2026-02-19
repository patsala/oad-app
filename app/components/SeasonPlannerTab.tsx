'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, Calendar, Lock, Search, X, GripVertical } from 'lucide-react';
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

// --- Draggable Player Card ---
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

// --- Droppable Event Cell ---
const DroppableEventCell = ({
  tournament,
  reservation,
  pick,
  onClearReservation,
  isActiveDrag,
  selectedPlayer,
  onTapAssign,
}: {
  tournament: Tournament;
  reservation?: Reservation;
  pick?: Pick;
  onClearReservation: (weekNumber: number) => void;
  isActiveDrag: boolean;
  selectedPlayer: number | null;
  onTapAssign: (weekNumber: number) => void;
}) => {
  const isPicked = !!pick;
  const isReserved = !!reservation && !isPicked;

  const { isOver, setNodeRef } = useDroppable({
    id: `week-${tournament.week_number}`,
    disabled: isPicked,
    data: { tournament },
  });

  const isMajor = tournament.event_type === 'Major';

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
            <div className="text-[10px] text-masters-yellow">${(pick.earnings / 1000).toFixed(0)}k</div>
          )}
        </div>
      )}

      {isReserved && (
        <div className="mt-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[10px] text-masters-yellow">
              <Calendar className="w-3 h-3" /> RESERVED
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

// --- Main Season Planner ---
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
      setPlayers((playerData.players || []).sort((a: Player, b: Player) => (a.owgr_rank || 999) - (b.owgr_rank || 999)));
      setPicks(pickData.picks || []);
      setReservations(reserveData.reservations || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load season planner data:', error);
      setLoading(false);
    }
  };

  // Reservation lookup maps
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

  // Filter players for sidebar
  const filteredPlayers = useMemo(() => {
    let filtered = players;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(term));
    }
    // Show all when searching, otherwise top 100
    if (!searchTerm) {
      filtered = filtered.slice(0, 100);
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

  // Tap-to-assign handler (mobile)
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
    // Optimistic update
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
        // Reload to get proper IDs
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

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="glass rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl text-masters-yellow">SEASON PLANNER</h2>
              <p className="text-sm text-green-200/60">Drag players onto events to plan your season strategy</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="text-green-200/60">
                <span className="text-green-400 font-bold">{usedCount}</span> picked
              </div>
              <div className="text-green-200/60">
                <span className="text-masters-yellow font-bold">{reservedCount}</span> reserved
              </div>
              <div className="text-green-200/60">
                <span className="text-green-300 font-bold">{28 - usedCount - reservedCount}</span> open
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: Toggle sidebar button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden w-full mb-4 glass rounded-xl p-3 flex items-center justify-center gap-2 text-sm text-masters-yellow"
        >
          <Search className="w-4 h-4" />
          {sidebarOpen ? 'Hide Player Pool' : 'Show Player Pool'}
          {selectedPlayer && (
            <span className="ml-2 px-2 py-0.5 bg-masters-yellow/20 rounded-full text-xs">
              Player selected — tap an event
            </span>
          )}
        </button>

        <div className="flex gap-4">
          {/* Player Pool Sidebar */}
          <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-full md:w-72 flex-shrink-0`}>
            <div className="glass rounded-2xl p-4 md:sticky md:top-6">
              <h3 className="text-lg text-masters-yellow mb-3">Player Pool</h3>

              {/* Search */}
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

              {/* Player List */}
              <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                {filteredPlayers.map(player => {
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

              {!searchTerm && players.length > 100 && (
                <p className="text-[10px] text-green-300/30 mt-2 text-center">
                  Showing top 100 by OWGR. Search to find more.
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
                      Weeks {segmentTournaments[0]?.week_number}-{segmentTournaments[segmentTournaments.length - 1]?.week_number}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                    {segmentTournaments.map(tournament => (
                      <DroppableEventCell
                        key={tournament.id}
                        tournament={tournament}
                        reservation={reservationByWeek.get(tournament.week_number)}
                        pick={pickByWeek.get(tournament.week_number)}
                        onClearReservation={clearReservation}
                        isActiveDrag={!!activeDragPlayer}
                        selectedPlayer={selectedPlayer}
                        onTapAssign={handleTapAssign}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
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
