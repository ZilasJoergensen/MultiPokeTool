import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Sprite } from '../components/Sprite';
import { prettyName, padId } from '../lib/utils';
import { GAME_GROUPS } from '../lib/games';
import { api, idFromUrl } from '../lib/api';
import {
  listCollection,
  addToCollection,
  updateCollected,
  removeFromCollection,
  type CollectedPokemon,
} from '../lib/store';
import { useStoreValue } from '../lib/use-store';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NATURES = [
  'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
  'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
  'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
  'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
  'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky',
];

const BALLS = [
  'Poké Ball', 'Great Ball', 'Ultra Ball', 'Master Ball',
  'Safari Ball', 'Net Ball', 'Dive Ball', 'Nest Ball',
  'Repeat Ball', 'Timer Ball', 'Luxury Ball', 'Premier Ball',
  'Dusk Ball', 'Heal Ball', 'Quick Ball', 'Dream Ball',
  'Beast Ball', 'Fast Ball', 'Level Ball', 'Lure Ball',
  'Heavy Ball', 'Love Ball', 'Friend Ball', 'Moon Ball',
  'Sport Ball', 'Park Ball',
];

type ViewMode = 'mine' | 'living-dex';
type PokemonRef = { id: number; name: string };

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function CollectionPage() {
  const [collection, refetch] = useStoreValue(listCollection, ['collection']);

  const { data: pokemonIndex } = useQuery({
    queryKey: ['pokemon-index'],
    queryFn: api.pokemonIndex,
    select: (rows) =>
      rows
        .map((r) => ({ name: r.name, id: idFromUrl(r.url) }))
        .filter((r) => r.id > 0 && r.id <= 1025)
        .sort((a, b) => a.id - b.id),
    staleTime: 1000 * 60 * 60 * 24 * 30,
  });

  const [view, setView] = useState<ViewMode>('mine');
  const [searchQ, setSearchQ] = useState('');
  const [shinyOnly, setShinyOnly] = useState(false);
  const [gameFilter, setGameFilter] = useState('all');

  // null = modal closed; PokemonRef with id=0 = add with blank picker
  const [addTarget, setAddTarget] = useState<PokemonRef | null>(null);
  const [editTarget, setEditTarget] = useState<CollectedPokemon | null>(null);

  const stats = useMemo(() => {
    const items = collection ?? [];
    const speciesSet = new Set(items.map((c) => c.pokemonId));
    return { total: items.length, species: speciesSet.size, shinies: items.filter((c) => c.shiny).length };
  }, [collection]);

  const ownedIds = useMemo(() => new Set((collection ?? []).map((c) => c.pokemonId)), [collection]);
  const shinyIds = useMemo(
    () => new Set((collection ?? []).filter((c) => c.shiny).map((c) => c.pokemonId)),
    [collection],
  );

  const filtered = useMemo(() => {
    let items = collection ?? [];
    if (shinyOnly) items = items.filter((c) => c.shiny);
    if (gameFilter !== 'all') items = items.filter((c) => c.originGame === gameFilter);
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      items = items.filter(
        (c) => c.pokemonName.includes(q) || (c.nickname?.toLowerCase().includes(q) ?? false),
      );
    }
    return items;
  }, [collection, shinyOnly, gameFilter, searchQ]);

  async function handleAdd(draft: Omit<CollectedPokemon, 'id' | 'addedAt' | 'updatedAt'>) {
    await addToCollection(draft);
    refetch();
    setAddTarget(null);
  }

  async function handleUpdate(id: string, patch: Partial<CollectedPokemon>) {
    await updateCollected(id, patch);
    refetch();
    setEditTarget(null);
  }

  async function handleDelete(id: string) {
    await removeFromCollection(id);
    refetch();
    setEditTarget(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Collection</h1>
          <p className="text-sm text-muted mt-0.5">
            {stats.total} Pokémon · {stats.species} / 1025 species · {stats.shinies} ✨
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddTarget({ id: 0, name: '' })}
          className="btn btn-primary shrink-0"
        >
          + Add
        </button>
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        {(['mine', 'living-dex'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={clsx(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              view === v ? 'bg-accent text-white' : 'bg-bg-elev text-muted hover:text-text',
            )}
          >
            {v === 'mine' ? 'My Pokémon' : 'Living Dex'}
          </button>
        ))}
      </div>

      {/* Filters (My Pokémon only) */}
      {view === 'mine' && (
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search name or nickname…"
            className="input flex-1 min-w-40"
          />
          <button
            type="button"
            onClick={() => setShinyOnly((v) => !v)}
            className={clsx(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
              shinyOnly
                ? 'bg-yellow-500/20 border-yellow-500/60 text-yellow-300'
                : 'border-line text-muted hover:text-text',
            )}
          >
            ✨ Shiny only
          </button>
          <select
            value={gameFilter}
            onChange={(e) => setGameFilter(e.target.value)}
            className="input"
          >
            <option value="all">All games</option>
            {GAME_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>{g.short}</option>
            ))}
          </select>
        </div>
      )}

      {/* My Pokémon grid */}
      {view === 'mine' && (
        <>
          {filtered.length === 0 ? (
            <div className="card p-12 text-center text-muted">
              {(collection?.length ?? 0) === 0
                ? 'No Pokémon yet — hit "+ Add" to record your first!'
                : 'No Pokémon match your filters.'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filtered.map((entry) => (
                <CollectionCard key={entry.id} entry={entry} onClick={() => setEditTarget(entry)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Living Dex grid */}
      {view === 'living-dex' && (
        <LivingDexView
          pokemonIndex={pokemonIndex}
          ownedIds={ownedIds}
          shinyIds={shinyIds}
          onAdd={(p) => setAddTarget(p)}
          onEdit={(pokemonId) => {
            const entry = (collection ?? []).find((c) => c.pokemonId === pokemonId);
            if (entry) setEditTarget(entry);
          }}
        />
      )}

      {/* Modals */}
      {addTarget !== null && (
        <EntryModal
          mode="add"
          preselected={addTarget.id > 0 ? addTarget : null}
          pokemonIndex={pokemonIndex}
          onClose={() => setAddTarget(null)}
          onSave={handleAdd}
        />
      )}
      {editTarget !== null && (
        <EntryModal
          mode="edit"
          entry={editTarget}
          pokemonIndex={pokemonIndex}
          onClose={() => setEditTarget(null)}
          onSave={(data) => handleUpdate(editTarget.id, data)}
          onDelete={() => handleDelete(editTarget.id)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CollectionCard
// ---------------------------------------------------------------------------

function CollectionCard({ entry, onClick }: { entry: CollectedPokemon; onClick: () => void }) {
  const game = GAME_GROUPS.find((g) => g.id === entry.originGame);
  return (
    <button
      type="button"
      onClick={onClick}
      className="card p-3 flex flex-col items-center gap-1.5 hover:border-accent/40 transition-colors text-center"
    >
      <div className="relative">
        <Sprite id={entry.pokemonId} name={entry.pokemonName} shiny={entry.shiny} size={64} />
        {entry.shiny && <span className="absolute -top-1 -right-1 text-sm">✨</span>}
      </div>
      <div className="text-xs font-medium leading-tight w-full">
        {entry.nickname ? (
          <>
            <div className="truncate">{entry.nickname}</div>
            <div className="text-muted truncate">{prettyName(entry.pokemonName)}</div>
          </>
        ) : (
          <div className="truncate">{prettyName(entry.pokemonName)}</div>
        )}
      </div>
      {game && <div className="text-[10px] text-muted">{game.short}</div>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Living Dex view
// ---------------------------------------------------------------------------

function LivingDexView({
  pokemonIndex,
  ownedIds,
  shinyIds,
  onAdd,
  onEdit,
}: {
  pokemonIndex?: PokemonRef[];
  ownedIds: Set<number>;
  shinyIds: Set<number>;
  onAdd: (p: PokemonRef) => void;
  onEdit: (pokemonId: number) => void;
}) {
  const pct = Math.round((ownedIds.size / 1025) * 100);

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-2 bg-bg-elev rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-sm tabular-nums shrink-0">
          <span className="font-bold text-green-400">{ownedIds.size}</span>
          <span className="text-muted"> / 1025 ({pct}%)</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-1">
        {(pokemonIndex ?? []).map((p) => {
          const owned = ownedIds.has(p.id);
          const shiny = shinyIds.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              title={`#${padId(p.id)} ${prettyName(p.name)}${owned ? ' ✓' : ''}`}
              onClick={() => (owned ? onEdit(p.id) : onAdd(p))}
              className={clsx(
                'relative rounded-lg p-0.5 transition-all flex flex-col items-center gap-0',
                owned
                  ? 'ring-1 ring-green-500/50 bg-green-500/10 hover:ring-green-400'
                  : 'opacity-35 hover:opacity-60',
              )}
            >
              <Sprite id={p.id} name={p.name} shiny={shiny} size={48} />
              {shiny && (
                <span className="absolute top-0 right-0 text-[8px] leading-none">✨</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entry modal (add + edit)
// ---------------------------------------------------------------------------

type EntryDraft = Omit<CollectedPokemon, 'id' | 'addedAt' | 'updatedAt'>;

function EntryModal({
  mode,
  entry,
  preselected,
  pokemonIndex,
  onClose,
  onSave,
  onDelete,
}: {
  mode: 'add' | 'edit';
  entry?: CollectedPokemon;
  preselected?: PokemonRef | null;
  pokemonIndex?: PokemonRef[];
  onClose: () => void;
  onSave: (data: EntryDraft) => void;
  onDelete?: () => void;
}) {
  const initial = entry ?? null;
  const initPicked: PokemonRef | null =
    initial
      ? { id: initial.pokemonId, name: initial.pokemonName }
      : preselected ?? null;

  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<PokemonRef | null>(initPicked);
  const [shiny, setShiny] = useState(initial?.shiny ?? false);
  const [nickname, setNickname] = useState(initial?.nickname ?? '');
  const [nature, setNature] = useState(initial?.nature ?? '');
  const [ball, setBall] = useState(initial?.ball ?? '');
  const [originGame, setOriginGame] = useState(initial?.originGame ?? '');
  const [currentLocation, setCurrentLocation] = useState(initial?.currentLocation ?? 'home');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const suggestions = useMemo(() => {
    if (!pokemonIndex || picked) return [];
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return pokemonIndex.filter((p) => p.name.includes(q)).slice(0, 8);
  }, [pokemonIndex, search, picked]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) return;
    onSave({
      pokemonId: picked.id,
      pokemonName: picked.name,
      nickname: nickname.trim() || undefined,
      shiny,
      nature: nature || undefined,
      ball: ball || undefined,
      originGame: originGame || undefined,
      currentLocation: currentLocation || undefined,
      notes: notes.trim() || undefined,
    });
  }

  function handleDelete() {
    if (confirm(`Remove ${picked ? prettyName(picked.name) : 'this Pokémon'} from your collection?`)) {
      onDelete?.();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        className="card w-full max-w-md space-y-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {mode === 'add' ? 'Add to Collection' : 'Edit Pokémon'}
          </h2>
          <button type="button" className="text-muted hover:text-text" onClick={onClose}>✕</button>
        </div>

        {/* Pokémon picker */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted uppercase tracking-wide">Pokémon</label>
          {picked ? (
            <div className="input flex items-center gap-3">
              <Sprite id={picked.id} name={picked.name} shiny={shiny} size={32} />
              <span className="flex-1 font-semibold">{prettyName(picked.name)}</span>
              {mode === 'add' && (
                <button
                  type="button"
                  className="text-muted hover:text-accent text-xs"
                  onClick={() => { setPicked(null); setSearch(''); }}
                >
                  Change
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Pokémon…"
                className="input w-full"
              />
              {suggestions.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 card divide-y divide-line/50 max-h-48 overflow-y-auto">
                  {suggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full px-3 py-2 flex items-center gap-2 hover:bg-bg-hover text-sm text-left"
                      onClick={() => setPicked(p)}
                    >
                      <Sprite id={p.id} name={p.name} size={28} />
                      <span>{prettyName(p.name)}</span>
                      <span className="ml-auto text-muted text-xs">#{padId(p.id)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Shiny toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            className={clsx(
              'w-10 h-6 rounded-full transition-colors relative shrink-0',
              shiny ? 'bg-yellow-500' : 'bg-bg-elev border border-line',
            )}
          >
            <div
              className={clsx(
                'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                shiny ? 'translate-x-4' : 'translate-x-0.5',
              )}
            />
          </div>
          <span className="text-sm font-medium">{shiny ? '✨ Shiny' : 'Not shiny'}</span>
          <input
            type="checkbox"
            checked={shiny}
            onChange={(e) => setShiny(e.target.checked)}
            className="sr-only"
          />
        </label>

        {/* Nickname */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted uppercase tracking-wide">Nickname</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="input w-full"
            placeholder="Leave blank if none"
          />
        </div>

        {/* Nature + Ball */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted uppercase tracking-wide">Nature</label>
            <select value={nature} onChange={(e) => setNature(e.target.value)} className="input w-full">
              <option value="">— unknown —</option>
              {NATURES.map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted uppercase tracking-wide">Ball</label>
            <select value={ball} onChange={(e) => setBall(e.target.value)} className="input w-full">
              <option value="">— unknown —</option>
              {BALLS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
        </div>

        {/* Origin game + Current location */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted uppercase tracking-wide">Origin game</label>
            <select value={originGame} onChange={(e) => setOriginGame(e.target.value)} className="input w-full">
              <option value="">— unknown —</option>
              {GAME_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.short}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted uppercase tracking-wide">Location</label>
            <select value={currentLocation} onChange={(e) => setCurrentLocation(e.target.value)} className="input w-full">
              <option value="home">Pokémon HOME</option>
              {GAME_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.short}</option>)}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted uppercase tracking-wide">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input w-full h-20 resize-none"
            placeholder="e.g. First shiny, competitive-ready, bred for perfect IVs…"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          {mode === 'edit' && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors border border-red-500/30"
            >
              Delete
            </button>
          )}
          <button type="button" onClick={onClose} className="btn flex-1">Cancel</button>
          <button type="submit" disabled={!picked} className="btn btn-primary flex-1 disabled:opacity-40">
            {mode === 'add' ? 'Add to Collection' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
