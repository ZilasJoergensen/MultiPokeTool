import { useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { prefetchPokemonDetail, preloadSprite } from '../lib/prefetch';
import { api, idFromUrl, type EvolutionLink, type PokemonListItem } from '../lib/api';
import { Sprite } from '../components/Sprite';
import { padId, prettyName } from '../lib/utils';
import { TYPES } from '../lib/types-chart';
import { listFavorites, listRecent } from '../lib/store';
import { useStoreValue } from '../lib/use-store';
import clsx from 'clsx';

// Generations roughly correspond to id ranges. Gen 9 + Indigo Disk takes us to 1025.
const GENERATIONS: { label: string; min: number; max: number }[] = [
  { label: 'Gen 1 — Kanto', min: 1, max: 151 },
  { label: 'Gen 2 — Johto', min: 152, max: 251 },
  { label: 'Gen 3 — Hoenn', min: 252, max: 386 },
  { label: 'Gen 4 — Sinnoh', min: 387, max: 493 },
  { label: 'Gen 5 — Unova', min: 494, max: 649 },
  { label: 'Gen 6 — Kalos', min: 650, max: 721 },
  { label: 'Gen 7 — Alola', min: 722, max: 809 },
  { label: 'Gen 8 — Galar/Hisui', min: 810, max: 905 },
  { label: 'Gen 9 — Paldea', min: 906, max: 1025 },
];

interface IndexedPokemon extends PokemonListItem {
  id: number;
}

function walkChain(link: EvolutionLink, visit: (l: EvolutionLink) => void) {
  visit(link);
  for (const next of link.evolves_to) walkChain(next, visit);
}

export function PokedexPage() {
  const { data: indexed, isLoading } = useQuery({
    queryKey: ['pokemon-index'],
    queryFn: api.pokemonIndex,
    select: (rows): IndexedPokemon[] =>
      rows
        .map((r) => ({ ...r, id: idFromUrl(r.url) }))
        .filter((r) => r.id > 0 && r.id <= 1025) // skip variant ids in the 10000+ range
        .sort((a, b) => a.id - b.id),
  });

  const [q, setQ] = useState('');
  const [gen, setGen] = useState<number | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [typeMode, setTypeMode] = useState<'any' | 'all'>('any');
  const [showEvoLine, setShowEvoLine] = useState(false);
  const [searchMode, setSearchMode] = useState<'name' | 'ability' | 'move'>('name');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favs] = useStoreValue(listFavorites, ['favorites']);
  const favIds = useMemo(() => new Set(favs?.map((f) => f.pokemonId) ?? []), [favs]);
  // The picked ability/move once the user selects one from the autocomplete.
  const [pickedAbility, setPickedAbility] = useState<string | null>(null);
  const [pickedMove, setPickedMove] = useState<string | null>(null);

  // Fetch the id-set for each selected type. /type/{name} returns ALL pokemon
  // of that type — much cheaper than fetching 1025 detail records. We intersect
  // (mode=all) or union (mode=any) the resulting id sets.
  const typeQueries = useQueries({
    queries: typeFilter.map((t) => ({
      queryKey: ['type-pokemon', t],
      queryFn: () => api.type(t),
      staleTime: 1000 * 60 * 60 * 24 * 30,
    })),
  });
  const typeIdSet = useMemo<Set<number> | null>(() => {
    if (typeFilter.length === 0) return null;
    if (typeQueries.some((q) => !q.data)) return null;
    const sets = typeQueries.map(
      (q) => new Set(q.data!.pokemon.map((p) => idFromUrl(p.pokemon.url))),
    );
    if (typeMode === 'all') {
      const [first, ...rest] = sets;
      return new Set([...first].filter((id) => rest.every((s) => s.has(id))));
    }
    const union = new Set<number>();
    for (const s of sets) for (const id of s) union.add(id);
    return union;
  }, [typeQueries, typeFilter, typeMode]);
  const typesLoading =
    typeFilter.length > 0 && typeQueries.some((q) => q.isLoading);

  // Ability / move picker data
  const abilityIndexQ = useQuery({
    queryKey: ['ability-index'],
    queryFn: api.abilityIndex,
    enabled: searchMode === 'ability',
  });
  const moveIndexQ = useQuery({
    queryKey: ['move-index'],
    queryFn: api.moveIndex,
    enabled: searchMode === 'move',
  });
  const abilityPokemonQ = useQuery({
    queryKey: ['ability-pokemon', pickedAbility],
    queryFn: () => api.ability(pickedAbility!),
    enabled: searchMode === 'ability' && !!pickedAbility,
  });
  const movePokemonQ = useQuery({
    queryKey: ['move-pokemon', pickedMove],
    queryFn: () => api.move(pickedMove!),
    enabled: searchMode === 'move' && !!pickedMove,
  });

  // When an ability/move is picked, we restrict the dex to that set of pokemon.
  const skillIdSet = useMemo<Set<number> | null>(() => {
    if (searchMode === 'ability' && abilityPokemonQ.data) {
      return new Set(abilityPokemonQ.data.pokemon.map((x) => idFromUrl(x.pokemon.url)));
    }
    if (searchMode === 'move' && movePokemonQ.data) {
      return new Set(
        (movePokemonQ.data as any).learned_by_pokemon?.map((x: { url: string }) => idFromUrl(x.url)) ?? [],
      );
    }
    return null;
  }, [searchMode, abilityPokemonQ.data, movePokemonQ.data]);

  const filtered = useMemo(() => {
    if (!indexed) return [];
    const ql = q.trim().toLowerCase();
    return indexed.filter((p) => {
      if (gen !== 'all') {
        const g = GENERATIONS[gen];
        if (p.id < g.min || p.id > g.max) return false;
      }
      if (typeIdSet && !typeIdSet.has(p.id)) return false;
      if (skillIdSet && !skillIdSet.has(p.id)) return false;
      if (favoritesOnly && !favIds.has(p.id)) return false;
      if (searchMode === 'name' && ql) {
        if (p.name.includes(ql)) return true;
        if (String(p.id).padStart(4, '0').includes(ql)) return true;
        return false;
      }
      return true;
    });
  }, [indexed, q, gen, typeIdSet, skillIdSet, searchMode, favoritesOnly, favIds]);

  // Evolution-line expansion: when toggle is on AND user has a search query,
  // fetch species for each match -> get unique evolution chains -> walk chains
  // to collect all relatives, then merge them into the displayed list.
  // We cap matches at 40 so a broad "char" search doesn't fire 100+ requests.
  const evoActive = showEvoLine && q.trim().length > 0 && filtered.length > 0 && filtered.length <= 40;

  const speciesQueries = useQueries({
    queries: evoActive
      ? filtered.map((p) => ({
          queryKey: ['species', p.name],
          queryFn: () => api.species(p.name),
          staleTime: 1000 * 60 * 60 * 24 * 30,
        }))
      : [],
  });

  const uniqueChainIds = useMemo(() => {
    if (!evoActive) return [];
    const set = new Set<number>();
    for (const q of speciesQueries) {
      if (q.data) set.add(idFromUrl(q.data.evolution_chain.url));
    }
    return Array.from(set);
  }, [speciesQueries, evoActive]);

  const chainQueries = useQueries({
    queries: uniqueChainIds.map((id) => ({
      queryKey: ['evolution-chain', id],
      queryFn: () => api.evolutionChain(id),
      staleTime: 1000 * 60 * 60 * 24 * 30,
    })),
  });

  const expanded = useMemo(() => {
    if (!evoActive) return filtered;
    const ids = new Set(filtered.map((p) => p.id));
    for (const cq of chainQueries) {
      if (!cq.data) continue;
      walkChain(cq.data.chain, (link) => ids.add(idFromUrl(link.species.url)));
    }
    if (!indexed) return filtered;
    return indexed
      .filter((p) => ids.has(p.id))
      .sort((a, b) => a.id - b.id);
  }, [evoActive, filtered, chainQueries, indexed]);

  const evoLoading =
    evoActive &&
    (speciesQueries.some((q) => q.isLoading) || chainQueries.some((q) => q.isLoading));

  return (
    <div className="space-y-6">
      {/* Sticky just below the nav (Layout header is h-14). z-20 keeps it above
          the grid but below the global header (z-30). The card has a fully
          opaque background so cards scrolling underneath aren't visible. */}
      <div className="card p-5 space-y-4 sticky top-14 z-20">
        {/* Search mode toggle */}
        <div className="inline-flex bg-bg-elev rounded-lg border border-line text-sm overflow-hidden">
          {(['name', 'ability', 'move'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setSearchMode(m);
                setQ('');
                if (m !== 'ability') setPickedAbility(null);
                if (m !== 'move') setPickedMove(null);
              }}
              className={clsx(
                'px-4 py-1.5 capitalize transition-colors',
                searchMode === m ? 'bg-accent text-white' : 'text-muted hover:text-text',
              )}
            >
              {m === 'name' ? 'By Name' : `By ${m}`}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:items-start">
          {searchMode === 'name' ? (
            <div className="relative flex-1">
              <input
                className="input w-full pl-9"
                placeholder="Search by name or #0025…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <svg
                className="absolute left-3 top-2.5 w-4 h-4 text-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
          ) : (
            <SkillPicker
              kind={searchMode}
              all={
                searchMode === 'ability'
                  ? abilityIndexQ.data ?? []
                  : moveIndexQ.data ?? []
              }
              loading={searchMode === 'ability' ? abilityIndexQ.isLoading : moveIndexQ.isLoading}
              picked={searchMode === 'ability' ? pickedAbility : pickedMove}
              onPick={(name) => {
                if (searchMode === 'ability') setPickedAbility(name);
                else setPickedMove(name);
              }}
              onClear={() => {
                if (searchMode === 'ability') setPickedAbility(null);
                else setPickedMove(null);
              }}
            />
          )}
          <select
            className="input min-w-[200px]"
            value={gen}
            onChange={(e) => setGen(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">All Generations</option>
            {GENERATIONS.map((g, i) => (
              <option key={i} value={i}>{g.label}</option>
            ))}
          </select>
        </div>
        <TypeFilter
          selected={typeFilter}
          onChange={setTypeFilter}
          mode={typeMode}
          onModeChange={setTypeMode}
        />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-wrap gap-2">
            {searchMode === 'name' && (
              <button
                type="button"
                onClick={() => setShowEvoLine((x) => !x)}
                className={clsx(
                  'btn text-xs',
                  showEvoLine && 'btn-primary',
                )}
                title="When ON, search results expand to include each match's full evolution line"
              >
                <span aria-hidden>🧬</span>
                Show Evolution Line {showEvoLine ? 'ON' : 'OFF'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setFavoritesOnly((x) => !x)}
              className={clsx(
                'btn text-xs',
                favoritesOnly && 'btn-primary',
              )}
              title="Show only Pokémon you've favorited"
            >
              <span aria-hidden>{favoritesOnly ? '★' : '☆'}</span>
              Favorites {favIds.size > 0 && `(${favIds.size})`}
            </button>
          </div>
          <div className="text-xs text-muted">
            {isLoading
              ? 'Loading dex…'
              : typesLoading
                ? 'Filtering by type…'
                : evoLoading
                  ? 'Expanding evolution lines…'
                  : evoActive
                    ? `${expanded.length.toLocaleString()} Pokémon (incl. evolutions)`
                    : `${filtered.length.toLocaleString()} Pokémon`}
          </div>
        </div>
        {showEvoLine && q.trim() && filtered.length > 40 && (
          <div className="text-[11px] text-yellow-400/80">
            Evolution expansion paused — too many matches ({filtered.length}). Narrow your search to under 40.
          </div>
        )}
      </div>

      <RecentlyViewedRail />

      {isLoading ? (
        <SkeletonGrid />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {expanded.map((p) => (
            <DexCard
              key={p.id}
              id={p.id}
              name={p.name}
              isEvoRelative={evoActive && !filtered.some((f) => f.id === p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Combobox for picking an ability or move. Types in a search to filter the
 * dropdown; clicking an item commits the selection which then filters the dex.
 */
function SkillPicker({
  kind,
  all,
  loading,
  picked,
  onPick,
  onClear,
}: {
  kind: 'ability' | 'move';
  all: { name: string }[];
  loading: boolean;
  picked: string | null;
  onPick: (name: string) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    if (!q.trim()) return all.slice(0, 50);
    const ql = q.toLowerCase();
    return all.filter((a) => a.name.includes(ql)).slice(0, 50);
  }, [all, q]);

  if (picked) {
    return (
      <div className="flex-1 flex items-center gap-2">
        <div className="input flex-1 flex items-center justify-between">
          <span>
            <span className="text-muted text-xs uppercase tracking-wide mr-2">{kind}</span>
            <span className="font-semibold">{prettyName(picked)}</span>
          </span>
          <button
            type="button"
            className="text-muted hover:text-accent text-sm"
            onClick={() => {
              onClear();
              setQ('');
            }}
          >
            ✕ change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1">
      <input
        className="input w-full pl-9"
        placeholder={loading ? `Loading ${kind}s…` : `Search ${kind}s…`}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        disabled={loading}
      />
      <svg
        className="absolute left-3 top-2.5 w-4 h-4 text-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      {open && matches.length > 0 && (
        <div className="absolute z-20 mt-1 left-0 right-0 card max-h-72 overflow-y-auto scroll-thin">
          {matches.map((m) => (
            <button
              key={m.name}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-bg-hover"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(m.name);
                setQ('');
                setOpen(false);
              }}
            >
              {prettyName(m.name)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DexCard({
  id,
  name,
  isEvoRelative,
}: {
  id: number;
  name: string;
  isEvoRelative?: boolean;
}) {
  const qc = useQueryClient();
  // Prefetch on hover/focus so the detail page renders without a flash on click.
  const prefetch = () => {
    prefetchPokemonDetail(qc, id);
    preloadSprite(id);
  };
  return (
    <Link
      to={`/pokemon/${id}`}
      viewTransition
      onMouseEnter={prefetch}
      onFocus={prefetch}
      onTouchStart={prefetch}
      onPointerDown={prefetch}
      className={clsx(
        'card p-3 group hover:border-accent/40 hover:bg-bg-hover transition-colors text-center relative',
        isEvoRelative && 'opacity-80 border-dashed',
      )}
    >
      {isEvoRelative && (
        <span
          className="absolute top-1.5 right-1.5 chip bg-bg-elev border border-line text-muted normal-case text-[9px] px-1.5 py-0.5"
          title="Related evolution"
        >
          evo
        </span>
      )}
      <div className="aspect-square grid place-items-center bg-bg-elev/50 rounded-lg overflow-hidden">
        <Sprite
          id={id}
          name={name}
          size={120}
          className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform"
        />
      </div>
      <div className="mt-2 text-[11px] font-mono text-muted">{padId(id)}</div>
      <div className="text-sm font-semibold truncate">{prettyName(name)}</div>
    </Link>
  );
}

function TypeFilter({
  selected,
  onChange,
  mode,
  onModeChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  mode: 'any' | 'all';
  onModeChange: (m: 'any' | 'all') => void;
}) {
  return (
    <details className="group" open={selected.length > 0}>
      <summary className="cursor-pointer text-xs text-muted hover:text-text inline-flex items-center gap-2">
        <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
        Filter by type {selected.length > 0 && `(${selected.length})`}
        {selected.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onChange([]);
            }}
            className="text-accent hover:underline"
          >
            clear
          </button>
        )}
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {TYPES.map((t) => {
          const active = selected.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() =>
                onChange(active ? selected.filter((x) => x !== t) : [...selected, t])
              }
              className={clsx(
                `chip text-white bg-type-${t} transition-opacity`,
                active ? 'opacity-100 ring-2 ring-white/60' : 'opacity-40 hover:opacity-80',
              )}
            >
              {t}
            </button>
          );
        })}
        {selected.length > 1 && (
          <div className="ml-2 inline-flex items-center bg-bg-elev rounded-lg border border-line text-xs overflow-hidden">
            <button
              type="button"
              onClick={() => onModeChange('any')}
              className={clsx('px-2.5 py-1', mode === 'any' ? 'bg-accent text-white' : 'text-muted hover:text-text')}
            >
              Any
            </button>
            <button
              type="button"
              onClick={() => onModeChange('all')}
              className={clsx('px-2.5 py-1', mode === 'all' ? 'bg-accent text-white' : 'text-muted hover:text-text')}
            >
              All
            </button>
          </div>
        )}
      </div>
    </details>
  );
}

function RecentlyViewedRail() {
  const qc = useQueryClient();
  const [recent] = useStoreValue(listRecent, ['recent']);
  if (!recent || recent.length === 0) return null;
  const top = recent.slice(0, 12);
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Recently Viewed
        </h2>
      </div>
      <div className="flex gap-2 overflow-x-auto scroll-thin pb-1">
        {top.map((r) => (
          <Link
            key={r.pokemonId}
            to={`/pokemon/${r.pokemonId}`}
            viewTransition
            onMouseEnter={() => {
              prefetchPokemonDetail(qc, r.pokemonId);
              preloadSprite(r.pokemonId);
            }}
            onFocus={() => {
              prefetchPokemonDetail(qc, r.pokemonId);
              preloadSprite(r.pokemonId);
            }}
            onTouchStart={() => {
              prefetchPokemonDetail(qc, r.pokemonId);
              preloadSprite(r.pokemonId);
            }}
            onPointerDown={() => {
              prefetchPokemonDetail(qc, r.pokemonId);
              preloadSprite(r.pokemonId);
            }}
            className="shrink-0 w-20 text-center rounded-lg p-2 hover:bg-bg-hover transition-colors"
            title={prettyName(r.pokemonName)}
          >
            <div className="aspect-square bg-bg-elev/50 rounded">
              <Sprite
                id={r.pokemonId}
                name={r.pokemonName}
                size={64}
                className="w-full h-full object-contain p-1"
              />
            </div>
            <div className="mt-1 text-[10px] truncate">{prettyName(r.pokemonName)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {Array.from({ length: 24 }).map((_, i) => (
        <div key={i} className="card p-3 animate-pulse">
          <div className="aspect-square rounded-lg bg-bg-elev" />
          <div className="mt-2 h-3 w-12 mx-auto rounded bg-bg-elev" />
          <div className="mt-1 h-4 w-20 mx-auto rounded bg-bg-elev" />
        </div>
      ))}
    </div>
  );
}
