import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, idFromUrl } from '../lib/api';
import { Sprite } from '../components/Sprite';
import { prettyName } from '../lib/utils';
import { GAME_GROUPS } from '../lib/games';
import {
  HUNT_METHODS,
  getMethod,
  formatOdds,
  cumulativeProbability,
  expectedEncounters,
} from '../lib/shiny-odds';
import {
  createHunt,
  deleteHunt,
  incrementEncounters,
  togglePauseHunt,
  completeHunt,
  listHunts,
  type ShinyHunt,
} from '../lib/store';
import { useStoreValue } from '../lib/use-store';

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

export function ShinyHunterPage() {
  const [hunts, refetch] = useStoreValue(listHunts, ['shinyHunts']);
  const [showNew, setShowNew] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const active = useMemo(
    () => (hunts ?? []).filter((h) => h.status !== 'completed'),
    [hunts],
  );
  const completed = useMemo(
    () => (hunts ?? []).filter((h) => h.status === 'completed'),
    [hunts],
  );

  const totalShinies = completed.length;
  const avgEncounters =
    completed.length > 0
      ? Math.round(completed.reduce((s, h) => s + h.encounters, 0) / completed.length)
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">✨ Shiny Hunter</h1>
          <p className="text-sm text-muted mt-0.5">
            Track your hunts, count encounters, and celebrate your shinies.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowNew(true)}
        >
          + New Hunt
        </button>
      </div>

      {/* Global stats */}
      {(totalShinies > 0 || active.length > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatChip label="Active hunts" value={active.length} />
          <StatChip label="Shinies found" value={totalShinies} accent />
          {avgEncounters != null && (
            <StatChip label="Avg encounters" value={avgEncounters.toLocaleString()} />
          )}
          {completed.length > 0 && (
            <StatChip
              label="Luckiest"
              value={Math.min(...completed.map((h) => h.encounters)).toLocaleString()}
            />
          )}
        </div>
      )}

      {/* Active hunts */}
      {active.length === 0 && !showNew ? (
        <div className="card p-12 text-center space-y-3">
          <div className="text-4xl">✨</div>
          <div className="font-semibold text-lg">No active hunts</div>
          <p className="text-sm text-muted">Start a new hunt to track your encounters and shiny odds.</p>
          <button
            type="button"
            className="btn btn-primary mt-2"
            onClick={() => setShowNew(true)}
          >
            + New Hunt
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {active.map((hunt) => (
            <HuntCard
              key={hunt.id}
              hunt={hunt}
              onComplete={() => setCompletingId(hunt.id)}
              onFocus={() => setFocusId(hunt.id)}
            />
          ))}
        </div>
      )}

      {/* Completed hunts */}
      {completed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Completed ({completed.length})
          </h2>
          <div className="card divide-y divide-line/50">
            {completed.map((hunt) => (
              <CompletedRow key={hunt.id} hunt={hunt} />
            ))}
          </div>
        </section>
      )}

      {/* New hunt drawer */}
      {showNew && (
        <NewHuntModal
          onClose={() => setShowNew(false)}
          onCreate={async (draft) => {
            await createHunt(draft);
            setShowNew(false);
            refetch();
          }}
        />
      )}

      {/* Focus mode overlay */}
      {focusId && (
        <FocusCounter
          hunt={(hunts ?? []).find((h) => h.id === focusId)!}
          onClose={() => setFocusId(null)}
          onComplete={() => { setCompletingId(focusId); setFocusId(null); }}
        />
      )}

      {/* Complete hunt modal */}
      {completingId && (
        <CompleteModal
          hunt={(hunts ?? []).find((h) => h.id === completingId)!}
          onClose={() => setCompletingId(null)}
          onConfirm={async (details) => {
            await completeHunt(completingId, details);
            setCompletingId(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hunt card (active / paused)
// ---------------------------------------------------------------------------

function HuntCard({ hunt, onComplete, onFocus }: { hunt: ShinyHunt; onComplete: () => void; onFocus: () => void }) {
  const method = getMethod(hunt.method);
  const odds = method.odds(hunt.shinyCharm);
  const prob = cumulativeProbability(odds, hunt.encounters);
  const expected = expectedEncounters(odds);
  const [elapsed, setElapsed] = useState('');

  // Live timer
  useEffect(() => {
    function tick() {
      const activeMs =
        Date.now() -
        hunt.startedAt -
        (hunt.totalPausedMs ?? 0) -
        (hunt.status === 'paused' && hunt.pausedAt ? Date.now() - hunt.pausedAt : 0);
      const totalSec = Math.max(0, Math.floor(activeMs / 1000));
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      setElapsed(
        h > 0
          ? `${h}h ${String(m).padStart(2, '0')}m`
          : `${m}m ${String(s).padStart(2, '0')}s`,
      );
    }
    tick();
    if (hunt.status === 'active') {
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }
  }, [hunt.startedAt, hunt.totalPausedMs, hunt.pausedAt, hunt.status]);

  const game = GAME_GROUPS.find((g) => g.id === hunt.gameId);

  async function handleIncrement() {
    await incrementEncounters(hunt.id);
  }

  async function handleTogglePause() {
    await togglePauseHunt(hunt.id);
  }

  async function handleDelete() {
    if (confirm(`Delete hunt for ${prettyName(hunt.targetPokemonName)}?`)) {
      await deleteHunt(hunt.id);
    }
  }

  // Luck interpretation
  const luckPct = Math.round(prob * 100);
  const luckLabel =
    hunt.encounters === 0
      ? null
      : prob < 0.5
        ? { text: `Lucky — ${100 - luckPct}% of hunters would've found it by now`, color: 'text-emerald-400' }
        : { text: `${luckPct}% of hunters would've found it by now`, color: 'text-yellow-400' };

  return (
    <div
      className={clsx(
        'card p-4 space-y-4 relative',
        hunt.status === 'paused' && 'opacity-70',
      )}
    >
      {/* Paused badge */}
      {hunt.status === 'paused' && (
        <div className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide bg-bg-elev px-2 py-0.5 rounded-full text-muted">
          Paused
        </div>
      )}

      {/* Pokemon header */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <Sprite id={hunt.targetPokemonId} name={hunt.targetPokemonName} shiny size={72} />
          <span className="absolute -bottom-1 -right-1 text-base">✨</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-lg leading-tight">{prettyName(hunt.targetPokemonName)}</div>
          <div className="text-xs text-muted mt-0.5">
            {game?.short ?? hunt.gameId} · {method.label}
          </div>
          <div className="text-xs text-muted">
            {formatOdds(odds)}{hunt.shinyCharm ? ' · Shiny Charm ✓' : ''}
          </div>
        </div>
      </div>

      {/* Counter */}
      <div className="text-center space-y-1">
        <div className="text-5xl font-bold tabular-nums">
          {hunt.encounters.toLocaleString()}
        </div>
        <div className="text-xs text-muted">{method.unit}</div>
      </div>

      {/* +1 button */}
      <button
        type="button"
        disabled={hunt.status === 'paused'}
        onClick={handleIncrement}
        className="w-full py-4 rounded-xl bg-accent text-white text-xl font-bold hover:bg-accent/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed select-none"
      >
        +1
      </button>

      {/* Progress bar + luck */}
      {hunt.encounters > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 bg-bg-elev rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all',
                prob < 0.5 ? 'bg-emerald-500' : prob < 0.9 ? 'bg-yellow-500' : 'bg-red-500',
              )}
              style={{ width: `${Math.min(100, prob * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted">
            <span>{luckLabel && <span className={luckLabel.color}>{luckLabel.text}</span>}</span>
            <span>~{expected.toLocaleString()} expected</span>
          </div>
        </div>
      )}

      {/* Timer + phases */}
      <div className="flex items-center gap-3 text-xs text-muted border-t border-line/50 pt-3">
        {elapsed && <span>⏱ {elapsed}</span>}
        {hunt.phases > 0 && <span>Phases: {hunt.phases}</span>}
        <button
          type="button"
          className="ml-auto text-yellow-400 hover:text-yellow-300"
          onClick={() => {
            if (confirm('Record this as a phase (wrong shiny found) and keep counting?')) {
              incrementEncounters(hunt.id, 0); // just to trigger update
              // Persist phase count increase
              import('../lib/store').then(({ updateHunt }) =>
                updateHunt(hunt.id, { phases: hunt.phases + 1 }),
              );
            }
          }}
        >
          Phase
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn flex-1 text-sm"
          onClick={handleTogglePause}
        >
          {hunt.status === 'paused' ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button
          type="button"
          className="btn text-sm text-accent hover:text-accent/80"
          onClick={onFocus}
          title="Open focus counter (Space to +1)"
        >
          ⛶
        </button>
        <button
          type="button"
          className="btn flex-1 text-sm text-emerald-400 hover:text-emerald-300"
          onClick={onComplete}
        >
          ✨ Found it!
        </button>
        <button
          type="button"
          className="btn text-sm text-muted hover:text-red-400"
          onClick={handleDelete}
          title="Delete hunt"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Completed row
// ---------------------------------------------------------------------------

function CompletedRow({ hunt }: { hunt: ShinyHunt }) {
  const method = getMethod(hunt.method);
  const odds = method.odds(hunt.shinyCharm);
  const prob = cumulativeProbability(odds, hunt.encounters);
  const game = GAME_GROUPS.find((g) => g.id === hunt.gameId);

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Sprite id={hunt.targetPokemonId} name={hunt.targetPokemonName} shiny size={40} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{prettyName(hunt.targetPokemonName)}</div>
        <div className="text-xs text-muted">
          {game?.short ?? hunt.gameId} · {method.label}
          {hunt.ball ? ` · ${prettyName(hunt.ball)} Ball` : ''}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-bold tabular-nums">
          {hunt.encounters.toLocaleString()} {method.unit}
        </div>
        <div
          className={clsx(
            'text-[10px]',
            prob < 0.5 ? 'text-emerald-400' : 'text-yellow-400',
          )}
        >
          {prob < 0.5 ? '✓ Lucky' : '◎ Unlucky'}
          {' '}· {formatOdds(odds)}
        </div>
      </div>
      {hunt.completedAt && (
        <div className="text-[10px] text-muted shrink-0 hidden sm:block">
          {new Date(hunt.completedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New hunt modal
// ---------------------------------------------------------------------------

interface DraftHunt {
  targetPokemonId: number;
  targetPokemonName: string;
  gameId: string;
  method: string;
  shinyCharm: boolean;
}

function NewHuntModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (draft: DraftHunt) => void;
}) {
  const { data: pokemonList } = useQuery({
    queryKey: ['pokemon-index'],
    queryFn: api.pokemonIndex,
    select: (rows: Awaited<ReturnType<typeof api.pokemonIndex>>): { name: string; id: number }[] =>
      rows
        .map((r) => ({ name: r.name, id: idFromUrl(r.url) }))
        .filter((r) => r.id > 0 && r.id <= 1025)
        .sort((a, b) => a.id - b.id),
    staleTime: 1000 * 60 * 60 * 24 * 30,
  });

  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<{ id: number; name: string } | null>(null);
  const [gameId, setGameId] = useState(GAME_GROUPS[0].id);
  const [method, setMethod] = useState(HUNT_METHODS[0].id);
  const [charm, setCharm] = useState(false);

  const suggestions = useMemo(() => {
    if (!pokemonList || picked) return [];
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return pokemonList.filter((p) => p.name.includes(q)).slice(0, 8);
  }, [pokemonList, search, picked]);

  const selectedMethod = getMethod(method);
  const odds = selectedMethod.odds(charm);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) return;
    onCreate({ targetPokemonId: picked.id, targetPokemonName: picked.name, gameId, method, shinyCharm: charm });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        className="card w-full max-w-md space-y-5 p-6"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">New Shiny Hunt</h2>
          <button type="button" className="text-muted hover:text-text" onClick={onClose}>✕</button>
        </div>

        {/* Pokemon picker */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted uppercase tracking-wide">Target Pokémon</label>
          {picked ? (
            <div className="input flex items-center gap-3">
              <Sprite id={picked.id} name={picked.name} shiny size={32} />
              <span className="flex-1 font-semibold">{prettyName(picked.name)}</span>
              <button
                type="button"
                className="text-muted hover:text-accent text-xs"
                onClick={() => { setPicked(null); setSearch(''); }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                autoFocus
                className="input w-full"
                placeholder="Search Pokémon…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 left-0 right-0 card max-h-48 overflow-y-auto">
                  {suggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-bg-hover text-left"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setPicked(p); setSearch(''); }}
                    >
                      <Sprite id={p.id} name={p.name} size={28} />
                      <span className="font-medium">{prettyName(p.name)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Game picker */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted uppercase tracking-wide">Game</label>
          <select
            className="input w-full"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
          >
            {GAME_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
        </div>

        {/* Method picker */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted uppercase tracking-wide">Hunting Method</label>
          <select
            className="input w-full"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {HUNT_METHODS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <p className="text-xs text-muted">{selectedMethod.description}</p>
        </div>

        {/* Shiny charm */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={charm}
            onChange={(e) => setCharm(e.target.checked)}
            className="accent-accent w-4 h-4"
          />
          <span className="text-sm">I have the Shiny Charm</span>
        </label>

        {/* Odds preview */}
        <div className="bg-bg-elev rounded-lg px-4 py-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted">Odds per {selectedMethod.unit.replace('s', '')}</span>
            <span className="font-bold text-accent">{formatOdds(odds)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Expected {selectedMethod.unit}</span>
            <span className="font-mono">{expectedEncounters(odds).toLocaleString()}</span>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" className="btn flex-1" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            className="btn btn-primary flex-1"
            disabled={!picked}
          >
            Start Hunt
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Complete hunt modal
// ---------------------------------------------------------------------------

function CompleteModal({
  hunt,
  onClose,
  onConfirm,
}: {
  hunt: ShinyHunt;
  onClose: () => void;
  onConfirm: (details: { ball?: string; nature?: string; notes?: string }) => void;
}) {
  const [ball, setBall] = useState('');
  const [nature, setNature] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!hunt) return null;
  const method = getMethod(hunt.method);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="card w-full max-w-sm p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="text-center space-y-2">
          <div className="text-4xl">✨</div>
          <h2 className="text-xl font-bold">You found a shiny!</h2>
          <div className="flex items-center justify-center gap-2">
            <Sprite id={hunt.targetPokemonId} name={hunt.targetPokemonName} shiny size={56} />
            <div className="text-left">
              <div className="font-semibold">{prettyName(hunt.targetPokemonName)}</div>
              <div className="text-sm text-muted">
                {hunt.encounters.toLocaleString()} {method.unit}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted uppercase tracking-wide">Poké Ball used</label>
            <input
              className="input w-full mt-1"
              placeholder="e.g. Masterball, Ultra Ball…"
              value={ball}
              onChange={(e) => setBall(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide">Nature</label>
            <input
              className="input w-full mt-1"
              placeholder="e.g. Timid, Adamant…"
              value={nature}
              onChange={(e) => setNature(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide">Notes</label>
            <textarea
              className="input w-full mt-1 resize-none"
              rows={2}
              placeholder="First shiny, special mark, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" className="btn flex-1" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary flex-1"
            onClick={() => onConfirm({ ball: ball || undefined, nature: nature || undefined, notes: notes || undefined })}
          >
            🎉 Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Focus counter — full-screen counter overlay for active hunting
// ---------------------------------------------------------------------------

function FocusCounter({
  hunt,
  onClose,
  onComplete,
}: {
  hunt: ShinyHunt;
  onClose: () => void;
  onComplete: () => void;
}) {
  const method = getMethod(hunt.method);
  const odds = method.odds(hunt.shinyCharm);
  const prob = hunt.encounters > 0 ? cumulativeProbability(odds, hunt.encounters) : 0;
  const game = GAME_GROUPS.find((g) => g.id === hunt.gameId);

  // Keyboard: Space / Enter → +1, Escape → close
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if ((e.key === ' ' || e.key === 'Enter') && hunt.status === 'active') {
        e.preventDefault();
        await incrementEncounters(hunt.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hunt.id, hunt.status, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur flex flex-col items-center justify-center gap-6 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm space-y-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pokemon + info */}
        <div className="flex items-center justify-center gap-4">
          <Sprite id={hunt.targetPokemonId} name={hunt.targetPokemonName} shiny size={80} />
          <div className="text-left">
            <div className="text-2xl font-bold">{prettyName(hunt.targetPokemonName)}</div>
            <div className="text-sm text-muted">{game?.short ?? hunt.gameId} · {method.label}</div>
            <div className="text-sm text-muted">{formatOdds(odds)}</div>
          </div>
        </div>

        {/* Big counter */}
        <div>
          <div className="text-7xl font-bold tabular-nums text-white">
            {hunt.encounters.toLocaleString()}
          </div>
          <div className="text-sm text-muted mt-1">{method.unit}</div>
        </div>

        {/* Progress bar */}
        {hunt.encounters > 0 && (
          <div className="space-y-1">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  prob < 0.5 ? 'bg-emerald-500' : prob < 0.9 ? 'bg-yellow-500' : 'bg-red-500',
                )}
                style={{ width: `${Math.min(100, prob * 100)}%` }}
              />
            </div>
            <div className="text-xs text-muted">
              {Math.round(prob * 100)}% of hunters have found one — ~{expectedEncounters(odds).toLocaleString()} expected
            </div>
          </div>
        )}

        {/* Big +1 button */}
        <button
          type="button"
          disabled={hunt.status === 'paused'}
          onClick={() => incrementEncounters(hunt.id)}
          className="w-full py-8 rounded-2xl bg-accent text-white text-4xl font-bold hover:bg-accent/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed select-none"
        >
          +1
        </button>

        <div className="text-xs text-muted">
          Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-white">Space</kbd> or{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-white">Enter</kbd> to increment ·{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-white">Esc</kbd> to close
        </div>

        {/* Found it */}
        <button
          type="button"
          className="btn btn-primary w-full text-lg"
          onClick={onComplete}
        >
          ✨ Found it!
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatChip({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="card p-3 text-center">
      <div className={clsx('text-2xl font-bold tabular-nums', accent && 'text-accent')}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}
