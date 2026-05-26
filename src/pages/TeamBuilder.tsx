import { useEffect, useState, useSyncExternalStore, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  EMPTY_EVS,
  FORMATS,
  STAT_KEYS,
  Teams,
  exportTeamShowdown,
  type EVSpread,
  type StatKey,
  type Team,
  type TeamFormat,
  type TeamSlot,
} from '../lib/teams';
import { api } from '../lib/api';
import { Sprite } from '../components/Sprite';
import { TypeBadge } from '../components/TypeBadge';
import { defenderMultipliers, TYPES, type TypeName } from '../lib/types-chart';
import { isValidType, padId, prettyName, STAT_LABELS, calculateStats, NATURES } from '../lib/utils';

// useSyncExternalStore requires getSnapshot to return the SAME reference unless
// the data actually changed; otherwise React loops forever.
let _cachedRaw: string | null = null;
let _cachedTeams: Team[] = [];
function getTeamsSnapshot(): Team[] {
  const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem('pokedex-teams-v1');
  if (raw !== _cachedRaw) {
    _cachedRaw = raw;
    _cachedTeams = Teams.list();
  }
  return _cachedTeams;
}
function subscribeTeams(cb: () => void) {
  const wrapped = () => { _cachedRaw = null; cb(); };
  window.addEventListener('teams-changed', wrapped);
  window.addEventListener('storage', wrapped);
  return () => {
    window.removeEventListener('teams-changed', wrapped);
    window.removeEventListener('storage', wrapped);
  };
}
function useTeams(): Team[] {
  return useSyncExternalStore(subscribeTeams, getTeamsSnapshot, () => []);
}

// ---------------------------------------------------------------------------
// Move data type (from PokeAPI)
// ---------------------------------------------------------------------------
interface MoveData {
  type: { name: string };
  power: number | null;
  accuracy: number | null;
  damage_class: { name: 'physical' | 'special' | 'status' };
}

const CATEGORY_ICON: Record<string, string> = {
  physical: '⚔',
  special: '✦',
  status: '●',
};
const CATEGORY_COLOR: Record<string, string> = {
  physical: 'text-orange-400',
  special: 'text-sky-400',
  status: 'text-muted',
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function TeamBuilderPage() {
  const { teamId } = useParams<{ teamId?: string }>();
  const teams = useTeams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!teamId && teams.length > 0) {
      const latest = [...teams].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      navigate(`/team-builder/${latest.id}`, { replace: true });
    }
  }, [teamId, teams, navigate]);

  if (teams.length === 0) {
    return <EmptyState onCreate={() => {
      const t = Teams.create();
      navigate(`/team-builder/${t.id}`);
    }} />;
  }

  return (
    <div className="grid md:grid-cols-[260px,1fr] gap-5">
      <aside className="card p-3 space-y-1 self-start sticky top-20">
        <div className="flex items-center justify-between px-2 py-1">
          <div className="text-xs uppercase tracking-wider text-muted">Teams</div>
          <button
            type="button"
            className="text-accent text-sm hover:underline"
            onClick={() => {
              const t = Teams.create();
              navigate(`/team-builder/${t.id}`);
            }}
          >
            + New
          </button>
        </div>
        {teams.map((t) => (
          <Link
            key={t.id}
            to={`/team-builder/${t.id}`}
            className={clsx(
              'block px-3 py-2 rounded-lg text-sm hover:bg-bg-hover',
              t.id === teamId && 'bg-bg-hover',
            )}
          >
            <div className="font-medium truncate">{t.name}</div>
            <div className="text-xs text-muted">{t.slots.length}/6</div>
          </Link>
        ))}
      </aside>

      {teamId ? <TeamEditor teamId={teamId} /> : null}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card p-12 text-center space-y-4">
      <div className="text-2xl font-bold">Build your first team</div>
      <p className="text-muted text-sm max-w-md mx-auto">
        Pick up to 6 Pokémon and see your team's combined type coverage and weaknesses at a glance.
      </p>
      <button type="button" className="btn btn-primary" onClick={onCreate}>
        + Create Team
      </button>
    </div>
  );
}

function TeamEditor({ teamId }: { teamId: string }) {
  const teams = useTeams();
  const team = teams.find((t) => t.id === teamId);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  if (!team) return <div className="card p-5 text-muted">Team not found.</div>;

  return (
    <div className="space-y-5">
      <TeamHeader team={team} />
      <SlotGrid team={team} onEditSlot={setEditingIdx} />
      <TeamAnalysisPanel team={team} />

      {editingIdx != null && team.slots[editingIdx] && (
        <SlotEditorModal
          team={team}
          slotIndex={editingIdx}
          onClose={() => setEditingIdx(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team header
// ---------------------------------------------------------------------------

function TeamHeader({ team }: { team: Team }) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(team.name);
  const [showExport, setShowExport] = useState(false);

  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 flex-wrap">
        {renaming ? (
          <input
            autoFocus
            className="input flex-1 text-lg min-w-[200px]"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => {
              Teams.update(team.id, { name: draftName.trim() || 'Untitled' });
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') { setDraftName(team.name); setRenaming(false); }
            }}
          />
        ) : (
          <h1
            className="text-2xl font-bold flex-1 cursor-text hover:text-accent min-w-[200px]"
            onClick={() => setRenaming(true)}
            title="Click to rename"
          >
            {team.name}
          </h1>
        )}
        <FormatSelector
          value={team.format}
          onChange={(format) => Teams.update(team.id, { format })}
        />
        <button
          type="button"
          className="btn text-sm"
          onClick={() => setShowExport((x) => !x)}
          title="Export team to Pokémon Showdown format"
        >
          ↑ Export
        </button>
        <button
          type="button"
          className="btn text-sm text-red-400 hover:text-red-300"
          onClick={() => {
            if (confirm(`Delete "${team.name}"?`)) Teams.delete(team.id);
          }}
        >
          Delete
        </button>
      </div>
      <div className="text-xs text-muted mt-2">
        {team.slots.length}/6 · {FORMATS[team.format].hint}
      </div>
      {showExport && team.slots.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted uppercase tracking-wide font-semibold">
              Pokémon Showdown export
            </span>
            <button
              type="button"
              className="btn text-xs ml-auto"
              onClick={() => {
                navigator.clipboard.writeText(exportTeamShowdown(team));
              }}
            >
              Copy to Clipboard
            </button>
            <button
              type="button"
              className="text-muted hover:text-text text-xs"
              onClick={() => setShowExport(false)}
            >
              ✕
            </button>
          </div>
          <textarea
            readOnly
            className="input w-full font-mono text-xs resize-none"
            rows={Math.min(20, team.slots.length * 8)}
            value={exportTeamShowdown(team)}
          />
        </div>
      )}
    </div>
  );
}

function FormatSelector({ value, onChange }: { value: TeamFormat; onChange: (f: TeamFormat) => void }) {
  return (
    <div className="inline-flex bg-bg-elev rounded-lg border border-line text-xs overflow-hidden">
      {(Object.keys(FORMATS) as TeamFormat[]).map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          className={clsx('px-3 py-1.5', value === f ? 'bg-accent text-white' : 'text-muted hover:text-text')}
          title={FORMATS[f].hint}
        >
          {FORMATS[f].label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slot grid (6 cards)
// ---------------------------------------------------------------------------

function SlotGrid({ team, onEditSlot }: { team: Team; onEditSlot: (idx: number) => void }) {
  const slotQueries = useQueries({
    queries: team.slots.map((s) => ({
      queryKey: ['pokemon', String(s.pokemonId)],
      queryFn: () => api.pokemon(s.pokemonId),
    })),
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, idx) => {
        const slot = team.slots[idx];
        if (!slot) {
          return (
            <Link
              key={idx}
              to="/pokedex"
              className="card p-4 min-h-[200px] grid place-items-center text-muted text-sm hover:border-accent/40 hover:text-text"
            >
              + Add Pokémon
            </Link>
          );
        }
        const q = slotQueries[idx];
        const types = q.data?.types.map((t: any) => t.type.name) ?? [];
        const evTotal = STAT_KEYS.reduce((sum, k) => sum + (slot.evs[k] ?? 0), 0);
        const rules = FORMATS[team.format];
        const evOver = evTotal > rules.totalCap;
        const displayName = slot.nickname ? `${slot.nickname}` : prettyName(slot.pokemonName);

        return (
          <div key={idx} className="card p-3 group relative space-y-2">
            <button
              type="button"
              className="absolute top-2 right-2 text-xs text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10"
              onClick={() => Teams.removeSlot(team.id, idx)}
              aria-label="Remove"
            >
              ✕
            </button>
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 bg-bg-elev/50 rounded-lg shrink-0 relative">
                <Sprite
                  id={slot.pokemonId}
                  name={slot.pokemonName}
                  size={80}
                  className="w-full h-full object-contain p-1"
                />
                {slot.shiny && (
                  <span className="absolute -top-1 -left-1 text-[11px]" title="Shiny">✨</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  to={`/pokemon/${slot.pokemonId}`}
                  className="text-[11px] font-mono text-muted hover:text-accent"
                >
                  {padId(slot.pokemonId)}
                </Link>
                <div className="text-sm font-semibold truncate">{displayName}</div>
                {slot.nickname && (
                  <div className="text-[10px] text-muted truncate">{prettyName(slot.pokemonName)}</div>
                )}
                <div className="mt-1 flex flex-wrap gap-1">
                  {types.map((t: string) => <TypeBadge key={t} type={t} size="sm" />)}
                </div>
              </div>
            </div>

            <div className="text-[11px] space-y-0.5 border-t border-line/50 pt-2">
              {slot.ability && (
                <SlotLine label="Ability">{prettyName(slot.ability)}</SlotLine>
              )}
              <SlotLine label="Item">
                {slot.item ? prettyName(slot.item) : <span className="text-muted">none</span>}
              </SlotLine>
              <SlotLine label="Moves">
                {slot.moves.filter(Boolean).length > 0 ? (
                  <span className="truncate">{slot.moves.filter(Boolean).map(prettyName).join(', ')}</span>
                ) : (
                  <span className="text-muted">none</span>
                )}
              </SlotLine>
              <SlotLine label="EVs">
                <span className={clsx('font-mono', evOver && 'text-red-400')}>
                  {evTotal}/{rules.totalCap}
                </span>
              </SlotLine>
            </div>

            <button
              type="button"
              className="btn w-full text-xs"
              onClick={() => onEditSlot(idx)}
            >
              Edit ▸
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SlotLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted uppercase tracking-wide text-[10px] w-12 shrink-0">{label}</span>
      <span className="flex-1 min-w-0 truncate">{children}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slot editor modal
// ---------------------------------------------------------------------------

function SlotEditorModal({ team, slotIndex, onClose }: { team: Team; slotIndex: number; onClose: () => void }) {
  const slot = team.slots[slotIndex];
  const rules = FORMATS[team.format];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pokemonQ = useQuery({
    queryKey: ['pokemon', String(slot.pokemonId)],
    queryFn: () => api.pokemon(slot.pokemonId),
  });

  // All learnable moves for this Pokémon
  const movePool = useMemo<string[]>(() => {
    if (!pokemonQ.data) return [];
    return Array.from(new Set(pokemonQ.data.moves.map((m: any) => m.move.name))).sort() as string[];
  }, [pokemonQ.data]);

  // Map: moveName → best learn method label
  const moveSourceMap = useMemo<Map<string, string>>(() => {
    if (!pokemonQ.data) return new Map();
    const map = new Map<string, string>();
    for (const m of pokemonQ.data.moves as any[]) {
      const methods: string[] = (m.version_group_details as any[]).map((d: any) => d.move_learn_method.name);
      let label = '';
      if (methods.includes('level-up')) label = 'Lvl';
      else if (methods.includes('machine')) label = 'TM';
      else if (methods.includes('egg')) label = 'Egg';
      else if (methods.includes('tutor')) label = 'Tutor';
      map.set(m.move.name, label);
    }
    return map;
  }, [pokemonQ.data]);

  // Pokémon types for STAB
  const pokemonTypes = useMemo<string[]>(
    () => pokemonQ.data?.types.map((t: any) => t.type.name) ?? [],
    [pokemonQ.data],
  );

  // Available abilities
  const abilities = useMemo<{ name: string; isHidden: boolean }[]>(
    () => (pokemonQ.data?.abilities ?? []).map((a: any) => ({
      name: a.ability.name,
      isHidden: a.is_hidden,
    })),
    [pokemonQ.data],
  );

  const itemIndexQ = useQuery({
    queryKey: ['item-index-v2-holdable'],
    queryFn: api.itemIndex,
    staleTime: 1000 * 60 * 60 * 24 * 30,
  });

  function patch(p: Partial<TeamSlot>) {
    Teams.updateSlot(team.id, slotIndex, p);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div className="card w-full max-w-3xl my-auto" onClick={(e) => e.stopPropagation()}>
        {/* Modal header */}
        <div className="flex items-start gap-3 p-5 border-b border-line">
          <div className="w-16 h-16 bg-bg-elev/50 rounded-lg shrink-0 relative">
            <Sprite id={slot.pokemonId} name={slot.pokemonName} size={64} className="w-full h-full object-contain p-1" />
            {slot.shiny && <span className="absolute -top-1 -left-1 text-sm" title="Shiny">✨</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-mono text-muted">{padId(slot.pokemonId)}</div>
            <div className="text-xl font-bold">{prettyName(slot.pokemonName)}</div>
            <div className="text-xs text-muted">{rules.label} · {rules.hint}</div>
          </div>
          <button type="button" className="btn text-sm shrink-0" onClick={onClose} aria-label="Close">
            ✕ Close
          </button>
        </div>

        <div className="p-5 space-y-6 max-h-[75vh] overflow-y-auto scroll-thin">

          {/* ── Identity (nickname, shiny, gender) ── */}
          <section>
            <SectionTitle>Identity</SectionTitle>
            <div className="flex flex-wrap gap-3 items-center">
              <input
                className="input flex-1 min-w-[140px] text-sm"
                placeholder={`Nickname (${prettyName(slot.pokemonName)})`}
                value={slot.nickname ?? ''}
                onChange={(e) => patch({ nickname: e.target.value || undefined })}
              />
              <button
                type="button"
                title="Toggle shiny"
                onClick={() => patch({ shiny: !slot.shiny })}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                  slot.shiny
                    ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
                    : 'bg-bg-elev border-line text-muted hover:text-text',
                )}
              >
                ✨ Shiny
              </button>
              <div className="flex gap-1 bg-bg-elev rounded-lg p-0.5 border border-line">
                {(['M', 'F', null] as const).map((g) => (
                  <button
                    key={String(g)}
                    type="button"
                    onClick={() => patch({ gender: g })}
                    className={clsx(
                      'px-2.5 py-1 rounded-md text-xs transition-colors',
                      slot.gender === g ? 'bg-bg text-text shadow-card' : 'text-muted hover:text-text',
                    )}
                  >
                    {g === 'M' ? '♂' : g === 'F' ? '♀' : '—'}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ── Ability ── */}
          {abilities.length > 0 && (
            <section>
              <SectionTitle>Ability</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {abilities.map((a) => (
                  <button
                    key={a.name}
                    type="button"
                    onClick={() => patch({ ability: a.name })}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                      slot.ability === a.name
                        ? 'bg-accent/20 border-accent/50 text-accent'
                        : 'bg-bg-elev border-line text-muted hover:text-text',
                    )}
                  >
                    {prettyName(a.name)}
                    {a.isHidden && (
                      <span className="ml-1.5 text-[10px] text-muted uppercase tracking-wide">HA</span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── Tera Type ── */}
          <section>
            <SectionTitle>Tera Type</SectionTitle>
            <div className="flex flex-wrap gap-1">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => patch({ teraType: slot.teraType === t ? null : t })}
                  className={clsx(
                    'rounded-md transition-all',
                    slot.teraType === t ? 'ring-2 ring-white/50 scale-110' : 'opacity-60 hover:opacity-100',
                  )}
                  title={t}
                >
                  <TypeBadge type={t} size="sm" />
                </button>
              ))}
              {slot.teraType && (
                <button
                  type="button"
                  className="px-2 py-0.5 rounded text-xs text-muted hover:text-red-400 transition-colors"
                  onClick={() => patch({ teraType: null })}
                >
                  ✕ clear
                </button>
              )}
            </div>
          </section>

          {/* ── Held Item ── */}
          <section>
            <SectionTitle>Held Item</SectionTitle>
            <ItemPicker
              all={itemIndexQ.data ?? []}
              loading={itemIndexQ.isLoading}
              value={slot.item}
              onChange={(item) => patch({ item })}
            />
          </section>

          {/* ── Moves ── */}
          <section>
            <SectionTitle>Moves (up to 4)</SectionTitle>
            {pokemonQ.isLoading ? (
              <div className="text-muted text-sm">Loading move pool…</div>
            ) : (
              <MoveSlots
                pool={movePool}
                value={slot.moves}
                onChange={(moves) => patch({ moves })}
                pokemonTypes={pokemonTypes}
                moveSourceMap={moveSourceMap}
              />
            )}
          </section>

          {/* ── EV Spread ── */}
          <section>
            <SectionTitle>EV Spread</SectionTitle>
            <EVEditor
              format={team.format}
              evs={slot.evs}
              baseStats={pokemonQ.data?.stats}
              onChange={(evs) => patch({ evs })}
            />
          </section>

          {/* ── IVs / Level / Nature ── */}
          <section>
            <IVEditor
              slot={slot}
              baseStats={pokemonQ.data?.stats}
              onChange={(p) => patch(p)}
            />
          </section>

        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2.5">
      {children}
    </h2>
  );
}

// ---------------------------------------------------------------------------
// Item picker
// ---------------------------------------------------------------------------

function ItemPicker({
  all, loading, value, onChange,
}: {
  all: { name: string }[];
  loading: boolean;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return all.slice(0, 30);
    return all.filter((i: { name: string }) => i.name.includes(ql)).slice(0, 30);
  }, [all, q]);

  if (value) {
    return (
      <div className="input flex items-center justify-between">
        <span className="font-semibold">{prettyName(value)}</span>
        <button type="button" className="text-muted hover:text-accent text-xs" onClick={() => onChange(null)}>
          ✕ remove
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        className="input w-full"
        placeholder={loading ? 'Loading items…' : 'Search for a held item…'}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        disabled={loading}
      />
      {open && matches.length > 0 && (
        <div className="absolute z-20 mt-1 left-0 right-0 card max-h-64 overflow-y-auto scroll-thin">
          {matches.map((m) => (
            <button
              key={m.name}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-bg-hover"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(m.name); setQ(''); setOpen(false); }}
            >
              {prettyName(m.name)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Move slots — 4 combobox slots with type/power display
// ---------------------------------------------------------------------------

function MoveSlots({
  pool, value, onChange, pokemonTypes, moveSourceMap,
}: {
  pool: string[];
  value: string[];
  onChange: (v: string[]) => void;
  pokemonTypes: string[];
  moveSourceMap: Map<string, string>;
}) {
  // Fetch move data for the 4 selected moves
  const moveDataQueries = useQueries({
    queries: [0, 1, 2, 3].map((i) => {
      const name = value[i] ?? '';
      return {
        queryKey: ['move', name],
        queryFn: () => api.move(name),
        enabled: Boolean(name),
        staleTime: Infinity,
      };
    }),
  });

  const setAt = (i: number, name: string | null) => {
    const next = [...value];
    while (next.length < 4) next.push('');
    next[i] = name ?? '';
    onChange(next.filter((_, idx) => idx < 4));
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {[0, 1, 2, 3].map((i) => (
        <MoveSlotPicker
          key={i}
          slotIndex={i}
          pool={pool}
          value={value[i] ?? ''}
          existing={value}
          moveData={(moveDataQueries[i]?.data ?? null) as MoveData | null}
          pokemonTypes={pokemonTypes}
          moveSourceMap={moveSourceMap}
          onChange={(name) => setAt(i, name)}
        />
      ))}
    </div>
  );
}

function MoveSlotPicker({
  slotIndex, pool, value, existing, moveData, pokemonTypes, moveSourceMap, onChange,
}: {
  slotIndex: number;
  pool: string[];
  value: string;
  existing: string[];
  moveData: MoveData | null;
  pokemonTypes: string[];
  moveSourceMap: Map<string, string>;
  onChange: (name: string | null) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const isStab = moveData?.type?.name ? pokemonTypes.includes(moveData.type.name) : false;

  const matches = useMemo(() => {
    const taken = new Set(existing.filter((n: string, i: number) => n && i !== slotIndex));
    const ql = q.trim().toLowerCase();
    return pool
      .filter((n: string) => !taken.has(n))
      .filter((n: string) => (ql ? n.includes(ql) : true))
      .slice(0, 40);
  }, [pool, q, existing, slotIndex]);

  if (value) {
    const cat = moveData?.damage_class?.name;
    const mt = moveData?.type?.name;
    return (
      <div className="input flex items-center gap-2 min-w-0">
        {mt && isValidType(mt as TypeName) && (
          <TypeBadge type={mt} size="sm" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-muted text-[10px] uppercase tracking-wide">M{slotIndex + 1}</span>
            <span className="font-medium text-sm truncate">{prettyName(value)}</span>
            {isStab && <span className="text-[10px] text-yellow-400 font-bold">STAB</span>}
          </div>
          {moveData && (
            <div className="flex items-center gap-2 text-[10px] text-muted leading-none">
              {cat && (
                <span className={CATEGORY_COLOR[cat]}>
                  {CATEGORY_ICON[cat]} {cat}
                </span>
              )}
              {moveData.power != null && <span className="font-mono">{moveData.power} BP</span>}
              {moveData.accuracy != null && <span>{moveData.accuracy}%</span>}
            </div>
          )}
        </div>
        <button
          type="button"
          className="text-muted hover:text-accent text-xs shrink-0"
          onClick={() => onChange(null)}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        className="input w-full"
        placeholder={`Move ${slotIndex + 1}…`}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {open && matches.length > 0 && (
        <div className="absolute z-20 mt-1 left-0 right-0 card max-h-56 overflow-y-auto scroll-thin">
          {matches.map((m) => {
            const src = moveSourceMap.get(m);
            return (
              <button
                key={m}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-bg-hover flex items-center justify-between gap-2"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(m); setQ(''); setOpen(false); }}
              >
                <span>{prettyName(m)}</span>
                {src && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elev text-muted shrink-0">
                    {src}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EV editor — sliders + numeric inputs with +4/+8/Max/0 quick buttons
// ---------------------------------------------------------------------------

function EVEditor({
  format, evs, baseStats, onChange,
}: {
  format: TeamFormat;
  evs: EVSpread;
  baseStats?: { base_stat: number; stat: { name: string } }[];
  onChange: (next: EVSpread) => void;
}) {
  const rules = FORMATS[format];
  const total = STAT_KEYS.reduce((sum, k) => sum + (evs[k] ?? 0), 0);
  const remaining = rules.totalCap - total;
  const over = total > rules.totalCap;

  function setStat(key: StatKey, raw: number) {
    const value = Math.max(0, Math.min(rules.perStatCap, Math.floor(raw)));
    onChange({ ...evs, [key]: value });
  }

  function applyPreset(spread: Partial<EVSpread>) {
    onChange({ ...EMPTY_EVS, ...spread });
  }

  const presets =
    format === 'standard'
      ? [
          { label: 'Atk/Spe', spread: { attack: 252, speed: 252, hp: 4 } },
          { label: 'SpA/Spe', spread: { 'special-attack': 252, speed: 252, hp: 4 } },
          { label: 'HP/Def', spread: { hp: 252, defense: 252, 'special-defense': 4 } },
          { label: 'HP/SpD', spread: { hp: 252, 'special-defense': 252, defense: 4 } },
        ]
      : [
          { label: 'Atk/Spe', spread: { attack: 32, speed: 32, hp: 2 } },
          { label: 'SpA/Spe', spread: { 'special-attack': 32, speed: 32, hp: 2 } },
          { label: 'HP/Def', spread: { hp: 32, defense: 32, 'special-defense': 2 } },
          { label: 'HP/SpD', spread: { hp: 32, 'special-defense': 32, defense: 2 } },
        ];

  return (
    <div className="space-y-3">
      {/* Presets + total */}
      <div className="flex items-center gap-2 flex-wrap">
        {presets.map((p) => (
          <button key={p.label} type="button" className="btn text-xs" onClick={() => applyPreset(p.spread as Partial<EVSpread>)}>
            {p.label}
          </button>
        ))}
        <button type="button" className="btn text-xs text-red-400" onClick={() => onChange({ ...EMPTY_EVS })}>
          Clear
        </button>
        <div className="ml-auto text-sm font-mono tabular-nums">
          <span className={clsx('font-bold', over ? 'text-red-400' : 'text-emerald-400')}>{total}</span>
          <span className="text-muted">/{rules.totalCap}</span>
          {!over && remaining > 0 && (
            <span className="text-muted text-xs ml-1">({remaining} left)</span>
          )}
        </div>
      </div>

      {/* Per-stat rows */}
      <div className="space-y-2.5">
        {STAT_KEYS.map((k) => {
          const base = baseStats?.find((b) => b.stat.name === k)?.base_stat;
          const cur = evs[k] ?? 0;
          return (
            <div key={k} className="space-y-0.5">
              <div className="grid grid-cols-[90px,1fr,72px] gap-2 items-center">
                <label className="text-xs text-muted">
                  {STAT_LABELS[k] ?? k}
                  {base != null && <span className="block text-[10px] opacity-70">base {base}</span>}
                </label>
                <input
                  type="range"
                  min={0}
                  max={rules.perStatCap}
                  step={rules.perStatCap >= 100 ? 4 : 1}
                  value={cur}
                  onChange={(e) => setStat(k, Number(e.target.value))}
                  className="accent-accent min-w-0"
                />
                <input
                  type="number"
                  min={0}
                  max={rules.perStatCap}
                  value={cur}
                  onChange={(e) => setStat(k, Number(e.target.value))}
                  className="input text-right tabular-nums py-1 text-sm w-full"
                />
              </div>
              {/* Quick buttons */}
              <div className="grid grid-cols-[90px,1fr] gap-2">
                <div />
                <div className="flex gap-1">
                  <QuickBtn onClick={() => setStat(k, cur + 4)}>+4</QuickBtn>
                  <QuickBtn onClick={() => setStat(k, cur + 8)}>+8</QuickBtn>
                  <QuickBtn onClick={() => setStat(k, rules.perStatCap)}>Max</QuickBtn>
                  <QuickBtn onClick={() => setStat(k, 0)}>0</QuickBtn>
                  <span className="ml-auto text-[10px] text-muted self-center">/{rules.perStatCap}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {over && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          Over the {rules.totalCap}-point cap by {total - rules.totalCap}. The team is illegal in {rules.label} until fixed.
        </div>
      )}
    </div>
  );
}

function QuickBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[10px] px-1.5 py-0.5 rounded bg-bg-elev text-muted hover:bg-bg-hover hover:text-text transition-colors"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// IV / Level / Nature editor + stat preview with nature coloring
// ---------------------------------------------------------------------------

function IVEditor({
  slot, baseStats, onChange,
}: {
  slot: TeamSlot;
  baseStats?: { base_stat: number; stat: { name: string } }[];
  onChange: (patch: Partial<TeamSlot>) => void;
}) {
  const ivs = slot.ivs ?? { hp: 31, attack: 31, defense: 31, 'special-attack': 31, 'special-defense': 31, speed: 31 };
  const level = slot.level ?? 50;
  const nature = slot.nature ?? 'docile';

  const natureData = NATURES.find((n) => n.id === nature) ?? null;
  const stats = baseStats ? calculateStats(baseStats, level, ivs as Record<string, number>, slot.evs, nature) : null;

  function setIV(k: string, v: number) {
    onChange({ ivs: { ...(slot.ivs ?? {}), [k]: Math.max(0, Math.min(31, v)) } });
  }

  function applyIVPreset(preset: Partial<Record<string, number>>) {
    const base = { hp: 31, attack: 31, defense: 31, 'special-attack': 31, 'special-defense': 31, speed: 31 };
    onChange({ ivs: { ...base, ...preset } as Record<string, number> });
  }

  const IV_PRESETS = [
    { label: '31 All', ivs: {} },
    { label: '0 Atk', ivs: { attack: 0 } },
    { label: '0 Spe', ivs: { speed: 0 } },
    { label: '0 Atk/Spe', ivs: { attack: 0, speed: 0 } },
    { label: '0 SpA', ivs: { 'special-attack': 0 } },
  ];

  return (
    <div>
      <SectionTitle>Level / IVs / Nature</SectionTitle>

      {/* Level + Nature */}
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <label className="text-xs text-muted">Level</label>
        <input
          type="number"
          min={1}
          max={100}
          value={level}
          onChange={(e) => onChange({ level: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })}
          className="input w-20 text-sm"
        />
        <label className="text-xs text-muted">Nature</label>
        <select
          className="input w-44 text-sm"
          value={nature}
          onChange={(e) => onChange({ nature: e.target.value })}
        >
          {NATURES.map((n) => (
            <option key={n.id} value={n.id}>{n.label}</option>
          ))}
        </select>
        {natureData && natureData.plus && (
          <span className="text-xs">
            <span className="text-emerald-400">+{STAT_LABELS[natureData.plus]}</span>
            {natureData.minus && (
              <span className="text-red-400 ml-1.5">−{STAT_LABELS[natureData.minus]}</span>
            )}
          </span>
        )}
      </div>

      {/* IV presets */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {IV_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="btn text-xs"
            onClick={() => applyIVPreset(p.ivs)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* IV sliders */}
      <div className="space-y-2">
        {STAT_KEYS.map((k) => {
          const iv = (ivs as any)[k] ?? 31;
          return (
            <div key={k} className="grid grid-cols-[90px,1fr,72px] gap-2 items-center">
              <label className={clsx(
                'text-xs',
                natureData?.plus === k ? 'text-emerald-400 font-semibold' : natureData?.minus === k ? 'text-red-400 font-semibold' : 'text-muted',
              )}>
                {STAT_LABELS[k]}
                {natureData?.plus === k && <span className="ml-0.5">▲</span>}
                {natureData?.minus === k && <span className="ml-0.5">▼</span>}
              </label>
              <input
                type="range"
                min={0}
                max={31}
                step={1}
                value={iv}
                onChange={(e) => setIV(k, Number(e.target.value))}
                className="accent-accent min-w-0"
              />
              <input
                type="number"
                min={0}
                max={31}
                value={iv}
                onChange={(e) => setIV(k, Number(e.target.value))}
                className="input text-right tabular-nums py-1 text-sm w-full"
              />
            </div>
          );
        })}
      </div>

      {/* Stat preview */}
      {stats && (
        <div className="card p-3 mt-4 bg-bg-elev/50">
          <div className="text-xs text-muted mb-2 font-semibold uppercase tracking-wide">
            Stat Preview — Lv{level}
          </div>
          <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
            {STAT_KEYS.map((k) => (
              <div key={k} className="flex items-center justify-between">
                <span className={clsx(
                  'text-xs',
                  natureData?.plus === k ? 'text-emerald-400' : natureData?.minus === k ? 'text-red-400' : 'text-muted',
                )}>
                  {STAT_LABELS[k]}
                  {natureData?.plus === k && '▲'}
                  {natureData?.minus === k && '▼'}
                </span>
                <span className={clsx(
                  'font-mono font-bold text-sm tabular-nums',
                  natureData?.plus === k ? 'text-emerald-400' : natureData?.minus === k ? 'text-red-400' : 'text-text',
                )}>
                  {stats[k]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team analysis panel
// ---------------------------------------------------------------------------

function TeamAnalysisPanel({ team }: { team: Team }) {
  const [tab, setTab] = useState<'defense' | 'offense' | 'speed'>('defense');

  const slotQueries = useQueries({
    queries: team.slots.map((s) => ({
      queryKey: ['pokemon', String(s.pokemonId)],
      queryFn: () => api.pokemon(s.pokemonId),
    })),
  });

  const pokemonTypes = slotQueries
    .map((q) => (q.data as any)?.types?.map((t: any) => t.type.name) ?? [])
    .filter((arr) => arr.length > 0);

  const tabs = [
    { id: 'defense', label: 'Defense' },
    { id: 'offense', label: 'Offense' },
    { id: 'speed', label: 'Speed Tiers' },
  ] as const;

  return (
    <div className="card overflow-hidden">
      <div className="flex border-b border-line/50">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={clsx(
              'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors',
              tab === t.id ? 'text-accent border-b-2 border-accent' : 'text-muted hover:text-text',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-5">
        {tab === 'defense' && <CoverageAnalysis pokemonTypes={pokemonTypes} />}
        {tab === 'offense' && <OffensiveCoverage team={team} slotQueries={slotQueries} />}
        {tab === 'speed' && <SpeedTiers team={team} slotQueries={slotQueries} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coverage analysis
// ---------------------------------------------------------------------------

function CoverageAnalysis({ pokemonTypes }: { pokemonTypes: string[][] }) {
  const summary = useMemo(() => {
    const result: Record<TypeName, { weak: number; resist: number; immune: number }> = {} as any;
    for (const atk of TYPES) result[atk] = { weak: 0, resist: 0, immune: 0 };
    for (const types of pokemonTypes) {
      const valid = types.filter((t: string): t is TypeName => isValidType(t));
      if (valid.length === 0) continue;
      const mults = defenderMultipliers(valid);
      for (const atk of TYPES) {
        const m = mults[atk];
        if (m === 0) result[atk].immune++;
        else if (m >= 2) result[atk].weak++;
        else if (m <= 0.5) result[atk].resist++;
      }
    }
    return result;
  }, [pokemonTypes]);

  if (pokemonTypes.length === 0) {
    return <p className="text-muted text-sm">Add Pokémon to your team to see coverage analysis.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        For each attack type, how many team members are weak (×2+), resist (×½−), or immune.
      </p>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-xs uppercase tracking-wide">
              <th className="py-2 pr-4 text-left">Attack Type</th>
              <th className="py-2 px-2 text-center">Weak</th>
              <th className="py-2 px-2 text-center">Resist</th>
              <th className="py-2 px-2 text-center">Immune</th>
              <th className="py-2 pl-2 text-left w-40">Net</th>
            </tr>
          </thead>
          <tbody>
            {TYPES.map((t) => {
              const s = summary[t];
              const net = s.resist + s.immune - s.weak;
              return (
                <tr key={t} className="border-t border-line/50">
                  <td className="py-2 pr-4"><TypeBadge type={t} size="sm" /></td>
                  <td className={clsx('py-2 px-2 text-center font-mono tabular-nums', s.weak > 0 && 'text-red-400')}>{s.weak || ''}</td>
                  <td className={clsx('py-2 px-2 text-center font-mono tabular-nums', s.resist > 0 && 'text-emerald-400')}>{s.resist || ''}</td>
                  <td className={clsx('py-2 px-2 text-center font-mono tabular-nums', s.immune > 0 && 'text-sky-400')}>{s.immune || ''}</td>
                  <td className="py-2 pl-2"><NetIndicator net={net} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Offensive coverage
// ---------------------------------------------------------------------------

function OffensiveCoverage({
  team, slotQueries,
}: {
  team: Team;
  slotQueries: ReturnType<typeof useQueries>;
}) {
  const allMoveNames = useMemo(() => {
    const names = new Set<string>();
    for (const slot of team.slots) {
      for (const move of slot.moves) { if (move) names.add(move); }
    }
    return [...names];
  }, [team.slots]);

  const moveQueries = useQueries({
    queries: allMoveNames.map((name) => ({
      queryKey: ['move', name],
      queryFn: () => api.move(name),
      staleTime: Infinity,
    })),
  });

  const moveTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    allMoveNames.forEach((name: string, i: number) => {
      const data = moveQueries[i]?.data as any;
      if (data?.type?.name) map.set(name, data.type.name);
    });
    return map;
  }, [allMoveNames, moveQueries]);

  const pokemonTypesMap = useMemo(() => {
    const map = new Map<number, Set<string>>();
    team.slots.forEach((slot: TeamSlot, i: number) => {
      const query = (slotQueries as any)[i];
      if (!query) return;
      const types = new Set<string>(
        (query.data as any)?.types?.map((t: any) => t.type.name) ?? [],
      );
      map.set(slot.pokemonId, types);
    });
    return map;
  }, [team.slots, slotQueries]);

  const coverage = useMemo(() => {
    const result: Record<string, 'stab' | 'hit' | 'none'> = {};
    for (const defType of TYPES) {
      const mults = defenderMultipliers([defType]);
      let best: 'stab' | 'hit' | 'none' = 'none';
      outer: for (const slot of team.slots) {
        const pokemonTypes = pokemonTypesMap.get(slot.pokemonId) ?? new Set<string>();
        for (const moveName of slot.moves) {
          if (!moveName) continue;
          const moveType = moveTypeMap.get(moveName);
          if (!moveType || !isValidType(moveType as TypeName)) continue;
          const mult = mults[moveType as TypeName] ?? 1;
          if (mult >= 2) {
            if (pokemonTypes.has(moveType)) { best = 'stab'; break outer; }
            best = 'hit';
          }
        }
      }
      result[defType] = best;
    }
    return result;
  }, [team.slots, moveTypeMap, pokemonTypesMap]);

  const loading = moveQueries.some((q) => (q as any).isLoading) && allMoveNames.length > 0;
  const covered = TYPES.filter((t) => coverage[t] !== 'none');
  const uncovered = TYPES.filter((t) => coverage[t] === 'none');

  if (allMoveNames.length === 0) {
    return <p className="text-muted text-sm">Add moves to see offensive coverage.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Which single types your moves can hit super-effectively.{' '}
        {loading && <span className="italic">Loading move data…</span>}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {TYPES.map((t) => {
          const cv = coverage[t];
          return (
            <div
              key={t}
              className={clsx('relative', cv === 'none' && 'opacity-30')}
              title={cv === 'stab' ? 'STAB super-effective' : cv === 'hit' ? 'Super-effective' : 'No coverage'}
            >
              <TypeBadge type={t} size="sm" />
              {cv === 'stab' && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full border border-bg" />
              )}
            </div>
          );
        })}
      </div>
      <div className="text-xs text-muted space-y-1">
        <div>
          <span className="font-medium text-text">{covered.length}/18</span> types covered
          {covered.some((t) => coverage[t] === 'stab') && (
            <span className="ml-3">
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1 align-middle" />
              = STAB super-effective
            </span>
          )}
        </div>
        {uncovered.length > 0 && (
          <div className="text-orange-400/80">
            Gaps: {uncovered.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Speed Tiers
// ---------------------------------------------------------------------------

interface SpeedRow {
  pokemonId: number; pokemonName: string;
  spd0: number; spd252: number; spdCur: number; speedEv: number;
}

function SpeedTiers({ team, slotQueries }: { team: Team; slotQueries: ReturnType<typeof useQueries> }) {
  const rows = useMemo<SpeedRow[]>(() => {
    const result: SpeedRow[] = [];
    team.slots.forEach((slot: TeamSlot, i: number) => {
      const query = (slotQueries as any)[i];
      if (!query) return;
      const poke = query.data as any;
      if (!poke?.stats) return;
      const level = slot.level ?? 50;
      const nature = slot.nature ?? 'docile';
      const ivs = slot.ivs ?? {};
      const evs = slot.evs;

      const spd0 = calculateStats(poke.stats, level, ivs, { ...evs, speed: 0 }, nature)['speed'] ?? 0;
      const spd252 = calculateStats(poke.stats, level, ivs, { ...evs, speed: 252 }, nature)['speed'] ?? 0;
      const spdCur = calculateStats(poke.stats, level, ivs, evs, nature)['speed'] ?? 0;

      result.push({ pokemonId: slot.pokemonId, pokemonName: slot.pokemonName, spd0, spd252, spdCur, speedEv: evs['speed'] ?? 0 });
    });
    return result.sort((a: SpeedRow, b: SpeedRow) => b.spdCur - a.spdCur);
  }, [team.slots, slotQueries]);

  if (rows.length === 0) {
    return <p className="text-muted text-sm">Add Pokémon to see speed tiers.</p>;
  }

  const maxSpd = Math.max(...rows.map((r) => r.spd252), 1);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Speed at each Pokémon's set level — bar shows 0 EV to 252 EV range, fill is current EVs.
      </p>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.pokemonId} className="flex items-center gap-3">
            <div className="shrink-0"><Sprite id={r.pokemonId} name={r.pokemonName} size={28} /></div>
            <div className="w-24 text-xs truncate shrink-0">{prettyName(r.pokemonName)}</div>
            <div className="flex-1 relative h-4 rounded overflow-hidden bg-bg-elev">
              <div className="absolute inset-y-0 left-0 bg-sky-500/20 rounded" style={{ width: `${(r.spd252 / maxSpd) * 100}%` }} />
              <div className="absolute inset-y-0 left-0 bg-sky-500 rounded" style={{ width: `${(r.spdCur / maxSpd) * 100}%` }} />
            </div>
            <div className="text-xs tabular-nums font-mono shrink-0 w-20 text-right">
              <span className="font-bold text-sky-300">{r.spdCur}</span>
              {r.speedEv === 0 ? (
                <span className="text-muted"> (–{r.spd252 - r.spd0} w/ EVs)</span>
              ) : r.speedEv < 252 ? (
                <span className="text-muted"> /{r.spd252}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NetIndicator({ net }: { net: number }) {
  const color = net > 0 ? 'bg-emerald-500' : net < 0 ? 'bg-red-500' : 'bg-bg-elev';
  const width = Math.min(100, Math.abs(net) * 25);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-bg-elev overflow-hidden relative">
        <div
          className={clsx('h-full absolute top-0', color)}
          style={{ width: `${width}%`, left: net >= 0 ? '50%' : `${50 - width}%` }}
        />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-line" />
      </div>
      <span className="text-xs font-mono tabular-nums text-muted w-6 text-right">
        {net > 0 ? `+${net}` : net}
      </span>
    </div>
  );
}
