import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  listGoalsForGame,
  setGoalState,
  addCustomGoal,
  removeGoal,
  resetGoalsForGame,
  type GameCompletionGoal,
} from '../lib/store';
import { CATEGORY_ORDER } from '../lib/game-completion-goals';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GoalFilter = 'all' | 'included' | 'excluded' | 'completed' | 'incomplete';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DIFFICULTY_LABEL: Record<string, string> = {
  core:     'Core',
  postgame: 'Postgame',
  hardcore: 'Hardcore',
  event:    'Event',
  custom:   'Custom',
};

const DIFFICULTY_COLOR: Record<string, string> = {
  core:     'bg-blue-500/15 text-blue-300 border-blue-500/30',
  postgame: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  hardcore: 'bg-red-500/15 text-red-300 border-red-500/30',
  event:    'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  custom:   'bg-teal-500/15 text-teal-300 border-teal-500/30',
};

const CUSTOM_CATEGORIES = [
  'Core Completion',
  'Pokédex Completion',
  'Legendary Pokémon',
  'Postgame & Side Content',
  'Trainer Card / Achievements',
  'Optional Hardcore Goals',
  'Event / Mythical Goals',
  'Custom Goals',
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GameCompletionView({
  gameId,
  gameName,
}: {
  gameId: string;
  gameName: string;
}) {
  const [goals, setGoals] = useState<GameCompletionGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<GoalFilter>('all');
  const [showExcluded, setShowExcluded] = useState(true);
  const [customModal, setCustomModal] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Load goals whenever the selected game changes
  useEffect(() => {
    setLoading(true);
    listGoalsForGame(gameId).then((g) => {
      setGoals(g);
      setLoading(false);
    });
  }, [gameId]);

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  const stats = useMemo(() => {
    const included = goals.filter((g) => g.included);
    const done = included.filter((g) => g.completed);
    const pct = included.length > 0 ? Math.round((done.length / included.length) * 100) : 0;
    return { included: included.length, done: done.length, pct, total: goals.length };
  }, [goals]);

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------

  const visible = useMemo(() => {
    return goals.filter((g) => {
      if (!showExcluded && !g.included) return false;
      switch (filter) {
        case 'included':   return g.included;
        case 'excluded':   return !g.included;
        case 'completed':  return g.included && g.completed;
        case 'incomplete': return g.included && !g.completed;
        default:           return true;
      }
    });
  }, [goals, filter, showExcluded]);

  // Group visible goals by category, respecting CATEGORY_ORDER
  const grouped = useMemo(() => {
    const map = new Map<string, GameCompletionGoal[]>();
    for (const g of visible) {
      const arr = map.get(g.category) ?? [];
      arr.push(g);
      map.set(g.category, arr);
    }
    // Sort categories by canonical order
    return [...map.entries()].sort(([a], [b]) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [visible]);

  // ---------------------------------------------------------------------------
  // Mutators
  // ---------------------------------------------------------------------------

  async function toggleCompleted(goal: GameCompletionGoal) {
    const next = !goal.completed;
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, completed: next } : g)));
    await setGoalState(goal.id, { completed: next });
  }

  async function toggleIncluded(goal: GameCompletionGoal) {
    const next = !goal.included;
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, included: next } : g)));
    await setGoalState(goal.id, { included: next });
  }

  async function handleAddCustom(draft: {
    title: string;
    category: string;
    description: string;
    included: boolean;
    progressTarget: number | undefined;
    notes: string;
  }) {
    const goal = await addCustomGoal({ gameId, ...draft });
    setGoals((prev) => [...prev, goal]);
    setCustomModal(false);
  }

  async function handleDelete(goal: GameCompletionGoal) {
    if (!goal.isCustom) return;
    await removeGoal(goal.id);
    setGoals((prev) => prev.filter((g) => g.id !== goal.id));
  }

  async function handleReset() {
    const seeded = await resetGoalsForGame(gameId);
    setGoals(seeded);
    setConfirmReset(false);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 h-24 bg-bg-elev" />
        ))}
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="card p-10 text-center text-muted space-y-2">
        <p className="text-lg font-semibold">No completion goals defined for this game yet.</p>
        <p className="text-sm">You can add custom goals below.</p>
        <button type="button" className="btn btn-primary mx-auto" onClick={() => setCustomModal(true)}>
          + Add Custom Goal
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Overall Completion Card */}
      <div className="card p-5 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold">{gameName} — Game Completion</h2>
            <p className="text-sm text-muted mt-0.5">
              {stats.done} / {stats.included} selected goals complete · {stats.total - stats.included} excluded
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className={clsx(
              'text-4xl font-black tabular-nums',
              stats.pct === 100 ? 'text-green-400' : stats.pct >= 70 ? 'text-yellow-400' : 'text-text',
            )}>
              {stats.pct}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-3 bg-bg-elev rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-500',
              stats.pct === 100 ? 'bg-green-400' : 'bg-accent',
            )}
            style={{ width: `${stats.pct}%` }}
          />
        </div>

        <p className="text-xs text-muted">
          Goals marked <span className="text-text font-medium">Counts: OFF</span> are excluded from the percentage.
          Toggle them to match your personal definition of 100%.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Filter pills */}
        <div className="flex gap-1 bg-bg-elev rounded-lg p-1">
          {(['all', 'included', 'excluded', 'completed', 'incomplete'] as GoalFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={clsx(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize',
                filter === f ? 'bg-bg text-text shadow-card' : 'text-muted hover:text-text',
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Show excluded toggle */}
        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none ml-1">
          <input
            type="checkbox"
            className="sr-only"
            checked={showExcluded}
            onChange={(e) => setShowExcluded(e.target.checked)}
          />
          <div
            className={clsx(
              'w-8 h-4 rounded-full relative transition-colors',
              showExcluded ? 'bg-accent' : 'bg-bg-elev border border-line',
            )}
            onClick={() => setShowExcluded((v) => !v)}
          >
            <div className={clsx('absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform', showExcluded ? 'translate-x-4' : 'translate-x-0.5')} />
          </div>
          Show excluded goals
        </label>

        <div className="ml-auto flex gap-2">
          <button type="button" className="btn text-xs px-3 py-1.5" onClick={() => setCustomModal(true)}>
            + Custom Goal
          </button>
          <button
            type="button"
            className="text-xs text-muted hover:text-red-400 transition-colors px-2"
            onClick={() => setConfirmReset(true)}
          >
            Reset to defaults
          </button>
        </div>
      </div>

      {/* Goal categories */}
      {grouped.length === 0 && (
        <div className="card p-8 text-center text-muted text-sm">
          No goals match the current filter.
        </div>
      )}

      {grouped.map(([category, categoryGoals]) => (
        <div key={category} className="card overflow-hidden">
          {/* Category header */}
          <div className="px-4 py-2.5 bg-bg-elev/60 border-b border-line flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">{category}</span>
            <span className="text-xs text-muted tabular-nums">
              {categoryGoals.filter((g) => g.included && g.completed).length}
              {' / '}
              {categoryGoals.filter((g) => g.included).length} included
            </span>
          </div>

          {/* Goal list */}
          <div className="divide-y divide-line/30">
            {categoryGoals.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                onToggleCompleted={() => toggleCompleted(goal)}
                onToggleIncluded={() => toggleIncluded(goal)}
                onDelete={goal.isCustom ? () => handleDelete(goal) : undefined}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Add custom goal modal */}
      {customModal && (
        <CustomGoalModal
          onClose={() => setCustomModal(false)}
          onSave={handleAddCustom}
        />
      )}

      {/* Reset confirmation modal */}
      {confirmReset && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmReset(false)}
        >
          <div className="card w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg">Reset to Defaults?</h3>
            <p className="text-sm text-muted">
              This will delete all your progress and custom goals for {gameName}, and restore the original goal list.
              This cannot be undone.
            </p>
            <div className="flex gap-3 pt-1">
              <button type="button" className="btn flex-1" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
                onClick={handleReset}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GoalRow
// ---------------------------------------------------------------------------

const DESC_LIMIT = 90;

function GoalRow({
  goal,
  onToggleCompleted,
  onToggleIncluded,
  onDelete,
}: {
  goal: GameCompletionGoal;
  onToggleCompleted: () => void;
  onToggleIncluded: () => void;
  onDelete?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const needsTruncation = (goal.description?.length ?? 0) > DESC_LIMIT;
  const displayDesc = needsTruncation && !expanded
    ? goal.description!.slice(0, DESC_LIMIT).trimEnd() + '…'
    : goal.description;

  return (
    <div className={clsx('px-4 py-3 transition-colors', !goal.included && 'opacity-40')}>
      <div className="flex items-start gap-3">
        {/* Completed checkbox */}
        <button
          type="button"
          aria-label={goal.completed ? 'Mark incomplete' : 'Mark complete'}
          onClick={onToggleCompleted}
          className={clsx(
            'mt-0.5 shrink-0 w-5 h-5 rounded border-2 transition-all flex items-center justify-center',
            goal.completed
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-line/60 hover:border-accent',
          )}
        >
          {goal.completed && <span className="text-[10px] font-bold leading-none">✓</span>}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-start gap-2 flex-wrap">
            <span className={clsx('text-sm font-medium leading-tight', goal.completed && 'line-through text-muted')}>
              {goal.title}
            </span>
            <span className={clsx('text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0', DIFFICULTY_COLOR[goal.difficulty])}>
              {DIFFICULTY_LABEL[goal.difficulty]}
            </span>
          </div>

          {displayDesc && (
            <p className="text-xs text-muted leading-relaxed">
              {displayDesc}
            </p>
          )}

          {needsTruncation && (
            <button
              type="button"
              className="text-[10px] text-accent hover:text-accent/80"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}

          {/* Progress bar (custom goals with progressTarget) */}
          {goal.progressTarget !== undefined && (
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1 h-1.5 bg-bg-elev rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((goal.progressCurrent ?? 0) / goal.progressTarget) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted tabular-nums shrink-0">
                {goal.progressCurrent ?? 0} / {goal.progressTarget}
              </span>
            </div>
          )}

          {goal.notes && (
            <p className="text-xs text-muted/80 italic">{goal.notes}</p>
          )}
        </div>

        {/* Included toggle + optional delete */}
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <span className="text-[10px] text-muted hidden sm:inline">Counts:</span>
            <div
              role="switch"
              aria-checked={goal.included}
              onClick={onToggleIncluded}
              className={clsx(
                'w-8 h-4 rounded-full relative cursor-pointer transition-colors',
                goal.included ? 'bg-accent' : 'bg-bg-elev border border-line',
              )}
            >
              <div className={clsx('absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform', goal.included ? 'translate-x-4' : 'translate-x-0.5')} />
            </div>
          </label>

          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete custom goal"
              className="text-muted hover:text-red-400 transition-colors text-sm"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CustomGoalModal
// ---------------------------------------------------------------------------

function CustomGoalModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (draft: {
    title: string;
    category: string;
    description: string;
    included: boolean;
    progressTarget: number | undefined;
    notes: string;
  }) => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Custom Goals');
  const [description, setDescription] = useState('');
  const [included, setIncluded] = useState(true);
  const [hasProgress, setHasProgress] = useState(false);
  const [progressTarget, setProgressTarget] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      category,
      description: description.trim(),
      included,
      progressTarget: hasProgress && progressTarget ? Number(progressTarget) : undefined,
      notes: notes.trim(),
    });
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
          <h2 className="text-lg font-bold">Add Custom Goal</h2>
          <button type="button" className="text-muted hover:text-text" onClick={onClose}>✕</button>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted uppercase tracking-wide">Goal Title *</label>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input w-full"
            placeholder="e.g. Build a competitive team"
            required
          />
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted uppercase tracking-wide">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input w-full">
            {CUSTOM_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted uppercase tracking-wide">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input w-full h-16 resize-none text-sm"
            placeholder="Optional details about this goal…"
          />
        </div>

        {/* Progress tracker */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
            <input
              type="checkbox"
              checked={hasProgress}
              onChange={(e) => setHasProgress(e.target.checked)}
            />
            Track progress (e.g. 37 / 200)
          </label>
          {hasProgress && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Target:</span>
              <input
                type="number"
                min="1"
                value={progressTarget}
                onChange={(e) => setProgressTarget(e.target.value)}
                className="input w-24 text-sm"
                placeholder="200"
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted uppercase tracking-wide">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input w-full h-12 resize-none text-sm"
            placeholder="Optional personal notes…"
          />
        </div>

        {/* Included toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            className={clsx('w-10 h-6 rounded-full relative transition-colors', included ? 'bg-accent' : 'bg-bg-elev border border-line')}
            onClick={() => setIncluded((v) => !v)}
          >
            <div className={clsx('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', included ? 'translate-x-4' : 'translate-x-0.5')} />
          </div>
          <span className="text-sm font-medium">{included ? 'Counts toward completion' : 'Excluded from completion'}</span>
        </label>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn flex-1">Cancel</button>
          <button type="submit" disabled={!title.trim()} className="btn btn-primary flex-1 disabled:opacity-40">
            Add Goal
          </button>
        </div>
      </form>
    </div>
  );
}
