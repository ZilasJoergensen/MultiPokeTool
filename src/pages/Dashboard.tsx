import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Sprite } from '../components/Sprite';
import { prettyName } from '../lib/utils';
import { GAME_GROUPS } from '../lib/games';
import { getMethod, formatOdds, cumulativeProbability } from '../lib/shiny-odds';
import { Teams } from '../lib/teams';
import {
  getPrefs,
  listActiveHunts,
  listAllCatches,
  listRecent,
  listCollection,
  listHunts,
  incrementEncounters,
  updateHunt,
  type ShinyHunt,
  type RecentView,
  type CollectedPokemon,
} from '../lib/store';
import { useStoreValue } from '../lib/use-store';
import { getGameDexPokemon } from '../lib/regional-dex';

// ---------------------------------------------------------------------------
// Game meta — regional dex names, accent colours, gen totals
// ---------------------------------------------------------------------------


const GAME_DEX_NAME: Record<string, string> = {
  rby: 'Kanto', gsc: 'Johto', rse: 'Hoenn', frlg: 'Kanto',
  dppt: 'Sinnoh', hgss: 'Johto', bw: 'Unova', b2w2: 'Unova',
  xy: 'Kalos', oras: 'Hoenn', sm: 'Alola', usum: 'Alola', lgpe: 'Kanto',
  swsh: 'Galar', bdsp: 'Sinnoh', pla: 'Hisui', sv: 'Paldea',
};

/** Tailwind bg class for a small game colour dot. */
const GAME_DOT: Record<string, string> = {
  rby: 'bg-red-500', gsc: 'bg-yellow-600', rse: 'bg-emerald-500', frlg: 'bg-orange-500',
  dppt: 'bg-blue-500', hgss: 'bg-amber-400', bw: 'bg-slate-400', b2w2: 'bg-slate-600',
  xy: 'bg-blue-400', oras: 'bg-red-400', sm: 'bg-orange-400', usum: 'bg-yellow-400',
  lgpe: 'bg-yellow-300', swsh: 'bg-teal-500', bdsp: 'bg-sky-400', pla: 'bg-stone-500',
  sv: 'bg-violet-500',
};

function formatPct(caught: number, total: number): string {
  if (total === 0 || caught === 0) return '0%';
  const pct = (caught / total) * 100;
  if (pct < 1) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

export function DashboardPage() {
  const [prefs] = useStoreValue(getPrefs, ['prefs']);
  const [activeHunts, refetchHunts] = useStoreValue(listActiveHunts, ['shinyHunts']);
  const [allHunts] = useStoreValue(listHunts, ['shinyHunts']);
  const [allCatches] = useStoreValue(listAllCatches, ['catches']);
  const [recent] = useStoreValue(listRecent, ['recent']);
  const [collection] = useStoreValue(listCollection, ['collection']);
  const [regionalDexSizes, setRegionalDexSizes] = useState<Record<string, number>>({});

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const ownedGroups = useMemo(() => {
    if (!prefs) return [];
    const owned = new Set(prefs.ownedVersions);
    return GAME_GROUPS.filter((g) => g.versions.some((v) => owned.has(v)));
  }, [prefs]);

  // Preload regional dex sizes on mount
  useEffect(() => {
    if (ownedGroups.length === 0) return;
    const gameIds = ownedGroups.map((g) => g.id);
    Promise.all(gameIds.map((id) =>
      getGameDexPokemon(id).then((pokemon) => ({
        id,
        size: pokemon.length,
      }))
    )).then((results) => {
      const sizes: Record<string, number> = {};
      for (const { id, size } of results) {
        sizes[id] = size;
      }
      setRegionalDexSizes(sizes);
    });
  }, [ownedGroups]);

  // Caught count per game (scoped to game's regional dex)
  const catchCountByGame = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of allCatches ?? []) {
      if (c.status !== 'caught') continue;
      map[c.gameGroupId] = (map[c.gameGroupId] ?? 0) + 1;
    }
    return map;
  }, [allCatches]);

  // Collection stats
  const collectionStats = useMemo(() => {
    const entries = collection ?? [];
    const uniqueSpecies = new Set(entries.map((e) => e.pokemonId)).size;
    const shinies = entries.filter((e) => e.shiny).length;
    return { total: entries.length, uniqueSpecies, shinies };
  }, [collection]);

  const completedHunts = useMemo(
    () => (allHunts ?? []).filter((h) => h.status === 'completed'),
    [allHunts],
  );

  const teams = useMemo(() => Teams.list(), []);

  // Recently caught (collection, newest first)
  const recentlyCaught = useMemo(
    () => (collection ?? []).slice(0, 6),
    [collection],
  );

  // Recently viewed (newest first, up to 6)
  const recentlyViewed = useMemo(
    () => (recent ?? []).slice(0, 6),
    [recent],
  );

  // Primary active hunt (most recently updated, active only)
  const primaryHunt = useMemo(
    () => (activeHunts ?? []).find((h) => h.status === 'active') ?? (activeHunts ?? [])[0] ?? null,
    [activeHunts],
  );

  const hasAnyData =
    (activeHunts?.length ?? 0) > 0 ||
    (allCatches?.length ?? 0) > 0 ||
    (recent?.length ?? 0) > 0 ||
    (collection?.length ?? 0) > 0 ||
    teams.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Greeting + Search ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{greeting}!</h1>
          <p className="text-muted text-sm mt-0.5">Here's your Pokémon progress.</p>
        </div>
        <QuickSearch />
      </div>

      {/* ── Empty state ── */}
      {!hasAnyData && prefs !== undefined && (
        <GetStartedCard hasOwnedGames={ownedGroups.length > 0} />
      )}

      {/* ── Row 1: Active Hunt + Collection Summary ── */}
      {(primaryHunt || collectionStats.total > 0 || teams.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Active hunt */}
          <div>
            <SectionHeader title="Active Shiny Hunt" linkTo="/shiny-hunter" linkLabel="All hunts →" />
            {primaryHunt ? (
              <ActiveHuntWidget
                hunt={primaryHunt}
                onIncrement={async () => { await incrementEncounters(primaryHunt.id); refetchHunts(); }}
                onAdd10={async () => { await incrementEncounters(primaryHunt.id, 10); refetchHunts(); }}
                onSub10={async () => {
                  const next = Math.max(0, primaryHunt.encounters - 10);
                  await updateHunt(primaryHunt.id, { encounters: next });
                  refetchHunts();
                }}
              />
            ) : (
              <div className="card p-5 text-center space-y-2">
                <div className="text-2xl">✨</div>
                <div className="text-sm font-semibold">No active hunt</div>
                <p className="text-xs text-muted">Start tracking your shiny encounters.</p>
                <Link to="/shiny-hunter" className="btn btn-primary text-sm inline-flex mt-1">
                  + Start a hunt
                </Link>
              </div>
            )}
          </div>

          {/* Collection summary */}
          <div>
            <SectionHeader title="Collection Summary" linkTo="/collection" linkLabel="View collection →" />
            <div className="card p-4 space-y-2.5">
              <CollStat label="Pokémon owned" value={collectionStats.total} />
              <CollStat label="Unique species" value={collectionStats.uniqueSpecies} />
              <CollStat label="Shinies" value={collectionStats.shinies} accent="text-yellow-300" />
              <CollStat label="Teams built" value={teams.length} />
              <CollStat
                label="Shinies found (hunts)"
                value={completedHunts.length}
                accent="text-accent"
              />
              <div className="pt-1.5 border-t border-line/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Living Dex</span>
                  <span className="font-mono">
                    <span className="font-bold">{collectionStats.uniqueSpecies}</span>
                    <span className="text-muted">/1025</span>
                    <span className="text-muted ml-1.5">
                      ({formatPct(collectionStats.uniqueSpecies, 1025)})
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 bg-bg-elev rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full"
                    style={{ width: `${(collectionStats.uniqueSpecies / 1025) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Row 2: Catch Progress + Next Tasks ── */}
      {ownedGroups.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Catch progress */}
          <div>
            <SectionHeader title="Catch Progress" linkTo="/catch-tracker" linkLabel={ownedGroups.length > 3 ? "View all →" : "Open tracker →"} />
            <div className="card divide-y divide-line/50">
              {ownedGroups.slice(0, 3).map((g) => {
                const caught = catchCountByGame[g.id] ?? 0;
                const total = regionalDexSizes[g.id] ?? 0;
                const pct = total > 0 ? (caught / total) * 100 : 0;
                const dot = GAME_DOT[g.id] ?? 'bg-muted';
                const dexName = GAME_DEX_NAME[g.id];
                return (
                  <Link
                    key={g.id}
                    to="/catch-tracker"
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-hover transition-colors"
                  >
                    <span className={clsx('w-2 h-2 rounded-full shrink-0', dot)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium shrink-0">{g.short}</span>
                          {dexName && (
                            <span className="text-[10px] text-muted truncate">{dexName} Dex</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs tabular-nums">
                            <span className="font-bold text-green-400">{caught}</span>
                            <span className="text-muted">/{total}</span>
                          </span>
                          <span className="text-xs text-muted w-10 text-right tabular-nums">
                            {formatPct(caught, total)}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-bg-elev rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] text-accent shrink-0">→</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Next Tasks */}
          <div>
            <SectionHeader title="Next Tasks" linkTo="/pokedex" linkLabel="" />
            <NextTasksWidget
              ownedGroups={ownedGroups}
              teams={teams}
              activeHunts={activeHunts ?? []}
              catchCountByGame={catchCountByGame}
              regionalDexSizes={regionalDexSizes}
            />
          </div>
        </div>
      )}

      {/* ── Row 3: Recently Caught + Recently Viewed ── */}
      {(recentlyCaught.length > 0 || recentlyViewed.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {recentlyCaught.length > 0 && (
            <div>
              <SectionHeader title="Recently Caught" linkTo="/collection" linkLabel="View all →" />
              <div className="flex gap-2 overflow-x-auto pb-1 scroll-thin">
                {recentlyCaught.map((entry) => (
                  <CollectionChip key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          )}
          {recentlyViewed.length > 0 && (
            <div>
              <SectionHeader title="Recently Viewed" linkTo="/pokedex" linkLabel="Browse →" />
              <div className="flex gap-2 overflow-x-auto pb-1 scroll-thin">
                {recentlyViewed.map((r) => (
                  <RecentChip key={r.pokemonId} view={r} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Quick Add (compact) ── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Quick Add</h2>
        <div className="flex flex-wrap gap-2">
          <QuickChip to="/catch-tracker" icon="✓" label="Record Catch" />
          <QuickChip to="/shiny-hunter" icon="✨" label="New Hunt" />
          <QuickChip to="/team-builder" icon="⚔" label="New Team" onClick={() => Teams.create()} />
          <QuickChip to="/pokedex" icon="🔍" label="Search Pokédex" />
          <QuickChip to="/damage-calc" icon="⚡" label="Damage Calc" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick search — navigates to pokemon page by name/number
// ---------------------------------------------------------------------------

function QuickSearch() {
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) { navigate('/pokedex'); return; }
    navigate(`/pokemon/${trimmed.toLowerCase()}`);
    setQ('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      <input
        className="input text-sm w-48"
        placeholder="Search Pokémon…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <button type="submit" className="btn text-sm">Go</button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Active hunt widget
// ---------------------------------------------------------------------------

function ActiveHuntWidget({
  hunt,
  onIncrement,
  onAdd10,
  onSub10,
}: {
  hunt: ShinyHunt;
  onIncrement: () => void;
  onAdd10: () => void;
  onSub10: () => void;
}) {
  const method = getMethod(hunt.method);
  const odds = method.odds(hunt.shinyCharm);
  const prob = cumulativeProbability(odds, hunt.encounters);
  const game = GAME_GROUPS.find((g) => g.id === hunt.gameId);

  return (
    <div className={clsx('card p-4 space-y-3', hunt.status === 'paused' && 'opacity-70')}>
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <Sprite id={hunt.targetPokemonId} name={hunt.targetPokemonName} shiny size={56} />
          <span className="absolute -bottom-1 -right-1 text-base">✨</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold">{prettyName(hunt.targetPokemonName)}</div>
          <div className="text-xs text-muted">
            {game?.short ?? hunt.gameId} · {method.label}
          </div>
          <div className="text-xs text-muted">{formatOdds(odds)}{hunt.shinyCharm ? ' · Charm ✓' : ''}</div>
          {hunt.status === 'paused' && (
            <span className="text-[10px] uppercase tracking-wide text-muted">Paused</span>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-3xl font-bold tabular-nums">{hunt.encounters.toLocaleString()}</div>
          <div className="text-[10px] text-muted">{method.unit}</div>
        </div>
      </div>

      {hunt.encounters > 0 && (
        <div className="space-y-0.5">
          <div className="h-1.5 bg-bg-elev rounded-full overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all',
                prob < 0.5 ? 'bg-emerald-500' : prob < 0.9 ? 'bg-yellow-500' : 'bg-red-500')}
              style={{ width: `${Math.min(100, prob * 100)}%` }}
            />
          </div>
          <div className="text-[10px] text-muted text-right">{Math.round(prob * 100)}% odds exceeded</div>
        </div>
      )}

      {/* Counter buttons */}
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={hunt.status === 'paused' || hunt.encounters === 0}
          onClick={onSub10}
          className="btn text-sm px-3 tabular-nums disabled:opacity-40"
        >
          −10
        </button>
        <button
          type="button"
          disabled={hunt.status === 'paused'}
          onClick={onIncrement}
          className="flex-1 py-2.5 rounded-lg bg-accent text-white font-bold text-xl hover:bg-accent/90 active:scale-95 transition-all disabled:opacity-40 select-none"
        >
          +1
        </button>
        <button
          type="button"
          disabled={hunt.status === 'paused'}
          onClick={onAdd10}
          className="btn text-sm px-3 tabular-nums disabled:opacity-40"
        >
          +10
        </button>
        <Link to="/shiny-hunter" className="btn text-xs px-2.5">Open →</Link>
      </div>

      {hunt.phases > 0 && (
        <div className="text-[10px] text-muted">Phases: {hunt.phases}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collection summary stat row
// ---------------------------------------------------------------------------

function CollStat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={clsx('font-bold tabular-nums', accent ?? 'text-text')}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Next tasks widget
// ---------------------------------------------------------------------------

function NextTasksWidget({
  ownedGroups, teams, activeHunts, catchCountByGame, regionalDexSizes,
}: {
  ownedGroups: typeof GAME_GROUPS;
  teams: ReturnType<typeof Teams.list>;
  activeHunts: ShinyHunt[];
  catchCountByGame: Record<string, number>;
  regionalDexSizes: Record<string, number>;
}) {
  const tasks: { icon: string; label: string; to: string; sub?: string }[] = [];

  // Most advanced catch tracker game
  const topGame = [...ownedGroups].sort(
    (a, b) => (catchCountByGame[b.id] ?? 0) - (catchCountByGame[a.id] ?? 0)
  )[0];
  if (topGame) {
    const caught = catchCountByGame[topGame.id] ?? 0;
    const total = regionalDexSizes[topGame.id] ?? 0;
    if (total > 0) {
      tasks.push({
        icon: '✓',
        label: `Continue catching in ${topGame.short}`,
        sub: `${caught}/${total} caught`,
        to: '/catch-tracker',
      });
    }
  }

  // Incomplete teams
  const incompleteTeam = teams.find((t) => t.slots.length < 6);
  if (incompleteTeam) {
    tasks.push({
      icon: '⚔',
      label: `Finish "${incompleteTeam.name}"`,
      sub: `${incompleteTeam.slots.length}/6 members`,
      to: `/team-builder/${incompleteTeam.id}`,
    });
  }

  // No active hunts
  if (activeHunts.length === 0) {
    tasks.push({
      icon: '✨',
      label: 'Start a shiny hunt',
      sub: 'Track your encounters',
      to: '/shiny-hunter',
    });
  } else {
    // Paused hunts
    const paused = activeHunts.filter((h) => h.status === 'paused');
    if (paused.length > 0) {
      tasks.push({
        icon: '▶',
        label: `Resume ${prettyName(paused[0].targetPokemonName)} hunt`,
        sub: `${paused[0].encounters.toLocaleString()} encounters`,
        to: '/shiny-hunter',
      });
    }
  }

  // Team with items/EVs/moves missing
  const incompleteSlot = teams.flatMap((t) => t.slots).find(
    (s) => s.moves.filter(Boolean).length === 0 || !s.item,
  );
  if (incompleteSlot) {
    tasks.push({
      icon: '📋',
      label: `Set up ${prettyName(incompleteSlot.pokemonName)}`,
      sub: 'Missing moves or item',
      to: '/team-builder',
    });
  }

  if (tasks.length === 0) {
    return (
      <div className="card p-5 text-center text-muted text-sm">
        You're all caught up! ✓
      </div>
    );
  }

  return (
    <div className="card divide-y divide-line/50">
      {tasks.slice(0, 4).map((task, i) => (
        <Link
          key={i}
          to={task.to}
          className="flex items-start gap-3 px-4 py-3 hover:bg-bg-hover transition-colors"
        >
          <span className="text-base shrink-0 mt-0.5">{task.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{task.label}</div>
            {task.sub && <div className="text-xs text-muted">{task.sub}</div>}
          </div>
          <span className="text-[10px] text-accent shrink-0 mt-1">→</span>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recently caught chip (from collection)
// ---------------------------------------------------------------------------

function CollectionChip({ entry }: { entry: CollectedPokemon }) {
  return (
    <Link
      to={`/pokemon/${entry.pokemonId}`}
      className="card p-2 flex flex-col items-center gap-0.5 shrink-0 hover:border-accent/40 transition-colors min-w-[72px]"
      title={prettyName(entry.pokemonName) + (entry.shiny ? ' ✨' : '')}
    >
      <div className="relative">
        <Sprite id={entry.pokemonId} name={entry.pokemonName} shiny={entry.shiny} size={48} />
        {entry.shiny && <span className="absolute -top-1 -right-1 text-[10px]">✨</span>}
      </div>
      <div className="text-[10px] text-muted text-center w-16 truncate">
        {prettyName(entry.pokemonName)}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Recently viewed chip
// ---------------------------------------------------------------------------

function RecentChip({ view }: { view: RecentView }) {
  return (
    <Link
      to={`/pokemon/${view.pokemonId}`}
      className="card p-2 flex flex-col items-center gap-0.5 shrink-0 hover:border-accent/40 transition-colors min-w-[72px]"
      title={prettyName(view.pokemonName)}
    >
      <Sprite id={view.pokemonId} name={view.pokemonName} size={48} />
      <div className="text-[10px] text-muted text-center w-16 truncate">
        {prettyName(view.pokemonName)}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Quick Add compact chip button
// ---------------------------------------------------------------------------

function QuickChip({
  to, icon, label, onClick,
}: {
  to: string; icon: string; label: string; onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-elev border border-line text-sm hover:border-accent/40 hover:text-text transition-colors text-muted"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SectionHeader({ title, linkTo, linkLabel }: { title: string; linkTo: string; linkLabel: string }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
      {linkLabel && (
        <Link to={linkTo} className="text-xs text-accent hover:underline">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

function GetStartedCard({ hasOwnedGames }: { hasOwnedGames: boolean }) {
  return (
    <div className="card p-8 space-y-4">
      <div className="text-3xl">👋</div>
      <div className="font-bold text-lg">Welcome to your Pokédex!</div>
      <p className="text-sm text-muted max-w-md">
        Track your catches, hunt shinies, and build competitive teams — all saved locally, no account needed.
      </p>
      <div className="flex flex-wrap gap-3 pt-1">
        {!hasOwnedGames && (
          <Link to="/settings" className="btn btn-primary">Select your games →</Link>
        )}
        <Link to="/catch-tracker" className="btn">Start catching</Link>
        <Link to="/shiny-hunter" className="btn">Start a shiny hunt</Link>
        <Link to="/pokedex" className="btn">Browse the Pokédex</Link>
      </div>
    </div>
  );
}
