import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, idFromUrl } from '../lib/api';
import { Sprite } from '../components/Sprite';
import { FixedSizeList as List } from 'react-window';
import { padId, prettyName } from '../lib/utils';
import { GAME_GROUPS, type GameGroup } from '../lib/games';
import {
  getPrefs,
  listGameDexForGame,
  setGameDexStatus,
  clearGameDex,
  type GameDexStatus,
} from '../lib/store';
import { useStoreValue } from '../lib/use-store';
import { regionalDexQueryKey, fetchGameDex, getDexIds } from '../lib/regional-dex';

/** Maps game group IDs to their regional Pokédex display names. */
const DEX_NAMES: Record<string, string> = {
  rby:  'Kanto Pokédex',
  gsc:  'Johto Pokédex',
  rse:  'Hoenn Pokédex',
  frlg: 'Kanto Pokédex',
  dppt: 'Sinnoh Pokédex',
  hgss: 'Johto Pokédex',
  bw:   'Unova Pokédex',
  b2w2: 'Unova Pokédex',
  xy:   'Kalos Pokédex',
  oras: 'Hoenn Pokédex',
  sm:   'Alola Pokédex',
  usum: 'Alola Pokédex',
  lgpe: 'Kanto Pokédex',
  swsh: 'Galar Pokédex',
  bdsp: 'Sinnoh Pokédex',
  pla:  'Hisui Pokédex',
  sv:   'Paldea Pokédex',
};

type StatusFilter = 'all' | 'missing' | 'registered' | 'in_game';

interface IndexedPokemon {
  id: number;
  name: string;
}

export function CatchTrackerPage() {
  const [prefs] = useStoreValue(getPrefs, ['prefs']);

  const { data: allPokemon, isLoading } = useQuery({
    queryKey: ['pokemon-index'],
    queryFn: api.pokemonIndex,
    select: (rows): IndexedPokemon[] =>
      rows
        .map((r) => ({ name: r.name, id: idFromUrl(r.url) }))
        .filter((r) => r.id > 0 && r.id <= 1025)
        .sort((a, b) => a.id - b.id),
    staleTime: 1000 * 60 * 60 * 24 * 30,
  });

  // Which game groups the user owns
  const ownedGroups = useMemo<GameGroup[]>(() => {
    if (!prefs) return [];
    const ownedSet = new Set(prefs.ownedVersions);
    return GAME_GROUPS.filter((g) => g.versions.some((v) => ownedSet.has(v)));
  }, [prefs]);

  const [selectedId, setSelectedId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Fetch regional dex for selected game using React Query (cached + persisted)
  // Uses game ID as key — handles multi-dex games like X/Y (Central+Coastal+Mountain)
  const hasDex = selectedId ? getDexIds(selectedId).length > 0 : false;

  const { data: regionalDexIds = [] } = useQuery({
    queryKey: selectedId ? regionalDexQueryKey(selectedId) : ['regional-dex', 'none'],
    queryFn: selectedId ? () => fetchGameDex(selectedId) : () => Promise.resolve([]),
    enabled: hasDex,
    staleTime: 1000 * 60 * 60 * 24 * 30, // 30 days
  });

  const regionalDexIdsSet = useMemo(() => new Set(regionalDexIds), [regionalDexIds]);

  function selectGame(id: string) {
    setSelectedId(id);
    setStatusFilter('all');
  }

  // Auto-select the first owned game once prefs load
  useEffect(() => {
    if (ownedGroups.length > 0 && !selectedId) {
      selectGame(ownedGroups[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownedGroups, selectedId]);

  const selectedGroup = GAME_GROUPS.find((g) => g.id === selectedId) ?? null;
  const dexName = selectedId ? (DEX_NAMES[selectedId] ?? 'Regional Pokédex') : null;

  // Catch map for selected game: pokemonId → status
  const [catchMap, setGameDexStatusMap] = useState<Map<number, GameDexStatus>>(new Map());
  const [catchesLoading, setGameDexStatusesLoading] = useState(false);

  // Responsive virtualization: measure container width to compute columns
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setGameDexStatusesLoading(true);
    listGameDexForGame(selectedId).then((records) => {
      setGameDexStatusMap(new Map(records.map((r) => [r.pokemonId, r.status])));
      setGameDexStatusesLoading(false);
    });
  }, [selectedId]);

  // Grid: only Pokémon in the selected game's regional dex, filtered by status
  const filtered = useMemo<IndexedPokemon[]>(() => {
    if (!allPokemon || regionalDexIdsSet.size === 0) return [];
    return allPokemon.filter((p) => {
      // Only show Pokémon that belong to this game's regional Pokédex
      if (!regionalDexIdsSet.has(p.id)) return false;
      const status = catchMap.get(p.id);
      if (statusFilter === 'missing') return !status;
      if (statusFilter === 'registered') return status === 'registered';
      if (statusFilter === 'in_game') return status === 'in_game';
      return true;
    });
  }, [allPokemon, catchMap, regionalDexIdsSet, statusFilter]);

  // Stats are always scoped to the regional dex — consistent with what's in the grid
  const stats = useMemo(() => {
    let total = 0;
    let inGame = 0;
    let registered = 0;
    allPokemon?.forEach((p) => {
      if (!regionalDexIdsSet.has(p.id)) return;
      total++;
      const s = catchMap.get(p.id);
      if (s === 'in_game') inGame++;
      else if (s === 'registered') registered++;
    });
    return { total, inGame, registered, missing: total - inGame - registered };
  }, [allPokemon, catchMap, regionalDexIdsSet]);

  const toggleStatus = useCallback(
    async (p: IndexedPokemon) => {
      if (!selectedId) return;
      const current = catchMap.get(p.id);
      // Cycle: missing → in_game → registered → missing
      const next: GameDexStatus | null =
        current === undefined || current === 'missing' ? 'in_game' : current === 'in_game' ? 'registered' : null;

      // Optimistic update
      setGameDexStatusMap((m) => {
        const next2 = new Map(m);
        if (next === null) next2.delete(p.id);
        else next2.set(p.id, next);
        return next2;
      });

      // Persist
      if (next === null) await clearGameDex(selectedId, p.id);
      else await setGameDexStatus(selectedId, p.id, p.name, next);
    },
    [selectedId, catchMap],
  );

  // ── No owned games ─────────────────────────────────────────────────────────
  if (prefs && ownedGroups.length === 0) {
    return (
      <div className="card p-10 text-center space-y-3 max-w-md mx-auto mt-16">
        <div className="text-3xl">🎮</div>
        <div className="font-semibold text-lg">No games selected</div>
        <p className="text-sm text-muted">
          Go to Settings and tick the games you own to start tracking your catches.
        </p>
        <Link to="/settings" className="btn btn-primary inline-flex mt-2">
          Go to Settings
        </Link>
      </div>
    );
  }

  const pct = stats.total > 0 ? Math.round((stats.inGame / stats.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Game tabs */}
      <div className="card p-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {ownedGroups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => selectGame(g.id)}
              title={g.label}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium shrink-0 transition-colors',
                g.id === selectedId
                  ? 'bg-accent text-white shadow-card'
                  : 'bg-bg-elev text-muted hover:text-text',
              )}
            >
              {g.short}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      {selectedGroup && (
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div>
              <div className="font-semibold text-base">{selectedGroup.label}</div>
              {dexName && <div className="text-xs text-muted mt-0.5">{dexName}</div>}
            </div>
            <span className="text-muted tabular-nums">{pct}% in game</span>
          </div>
          <div className="h-2 bg-bg-elev rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex gap-4 text-xs text-muted">
            <span className="text-green-400 font-medium">✓ {stats.inGame} in game</span>
            <span className="text-yellow-400 font-medium">◉ {stats.registered} registered</span>
            <span>{stats.missing} missing</span>
            <span className="ml-auto">{stats.total} total</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 bg-bg-elev rounded-lg p-1">
          {(['all', 'missing', 'registered', 'in_game'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={clsx(
                'px-3 py-1 rounded-md text-sm transition-colors capitalize',
                statusFilter === f
                  ? 'bg-bg text-text shadow-card'
                  : 'text-muted hover:text-text',
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <span className="text-xs text-muted ml-auto">
          {regionalDexIdsSet.size === 0 ? 'Loading…' : `Showing ${filtered.length} of ${stats.total}`}
        </span>
      </div>

      {/* Grid */}
      {isLoading || catchesLoading ? (
        // Simple skeleton grid for mobile perceived performance
        <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="card p-2 flex flex-col items-center gap-0.5 animate-pulse">
              <div className="w-14 h-14 bg-bg-elev rounded-md" />
              <div className="h-3 w-10 bg-bg-elev rounded mt-2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-muted">
          {statusFilter !== 'all'
            ? `No Pokémon in the "${statusFilter}" category. Great work!`
            : 'No Pokémon found.'}
        </div>
      ) : (
        <div ref={containerRef}>
          {containerWidth > 0 ? (
            (() => {
              const minColWidth = 88; // matches previous minmax
              const gap = 8;
              const cols = Math.max(1, Math.floor((containerWidth + gap) / (minColWidth + gap)));
              const rowCount = Math.ceil(filtered.length / cols);
              const rowHeight = 120; // approximate card height

              return (
                <List
                  height={Math.min(rowCount * rowHeight, window.innerHeight - 200)}
                  itemCount={rowCount}
                  itemSize={rowHeight}
                  width={containerWidth}
                >
                  {( { index: rowIndex, style }: { index: number; style: React.CSSProperties } ) => (
                    <div style={style} className="flex gap-2 px-1">
                      {Array.from({ length: cols }).map((_, colIndex) => {
                        const itemIndex = rowIndex * cols + colIndex;
                        const p = filtered[itemIndex];
                        if (!p) return <div key={colIndex} className="flex-1" />;
                        const status = catchMap.get(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleStatus(p)}
                            title={`${prettyName(p.name)} — click to mark in game, again for registered, again to clear`}
                            className={clsx(
                              'card p-2 flex flex-col items-center gap-0.5 text-center transition-all cursor-pointer select-none flex-1',
                              status === 'in_game'
                                ? 'border-green-500/70 bg-green-500/10'
                                : status === 'registered'
                                  ? 'border-yellow-500/70 bg-yellow-500/10'
                                  : 'opacity-50 hover:opacity-100',
                            )}
                          >
                            <div className="relative">
                              <Sprite id={p.id} name={p.name} size={56} className="drop-shadow-sm" />
                              {status && (
                                <span
                                  className={clsx(
                                    'absolute -top-1 -right-1 w-5 h-5 rounded-full text-[11px] font-bold grid place-items-center shadow-card',
                                    status === 'in_game'
                                      ? 'bg-green-500 text-white'
                                      : 'bg-yellow-500 text-black',
                                  )}
                                >
                                  {status === 'in_game' ? '✓' : '◉'}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted leading-none">{padId(p.id)}</div>
                            <div className="text-[11px] font-medium leading-tight truncate w-full">
                              {prettyName(p.name)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </List>
              );
            })()
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
              {filtered.map((p) => {
                const status = catchMap.get(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleStatus(p)}
                    title={`${prettyName(p.name)} — click to mark in game, again for registered, again to clear`}
                    className={clsx(
                      'card p-2 flex flex-col items-center gap-0.5 text-center transition-all cursor-pointer select-none',
                      status === 'in_game'
                        ? 'border-green-500/70 bg-green-500/10'
                        : status === 'registered'
                          ? 'border-yellow-500/70 bg-yellow-500/10'
                          : 'opacity-50 hover:opacity-100',
                    )}
                  >
                    <div className="relative">
                      <Sprite id={p.id} name={p.name} size={56} className="drop-shadow-sm" />
                      {status && (
                        <span
                          className={clsx(
                            'absolute -top-1 -right-1 w-5 h-5 rounded-full text-[11px] font-bold grid place-items-center shadow-card',
                            status === 'in_game'
                              ? 'bg-green-500 text-white'
                              : 'bg-yellow-500 text-black',
                          )}
                        >
                          {status === 'in_game' ? '✓' : '◉'}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted leading-none">{padId(p.id)}</div>
                    <div className="text-[11px] font-medium leading-tight truncate w-full">
                      {prettyName(p.name)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
