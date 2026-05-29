import { useState, useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, type Pokemon, type PokemonListItem } from '../lib/api';
import { Teams, type TeamSlot, type Team } from '../lib/teams';
import { defenderMultipliers, TYPES, type TypeName } from '../lib/types-chart';
import { TypeBadge } from '../components/TypeBadge';
import { Sprite } from '../components/Sprite';
import { prettyName, typeBg } from '../lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = 'singles' | 'doubles';
type View = 'matchup' | 'type-check' | 'team-overview';
type Confidence = 'observed' | 'assumed';

interface ObservedMove {
  name: string;
  conf: Confidence;
}

interface OpponentNotes {
  ability: string;
  abilityConf: Confidence;
  item: string;
  teraType: string;
  moves: ObservedMove[];
  newMove: string;
}

interface OpponentSlot {
  pokemonName: string;
  pokemonId: number;
  notes: OpponentNotes;
}

function emptyOpponent(): OpponentSlot {
  return {
    pokemonName: '',
    pokemonId: 0,
    notes: { ability: '', abilityConf: 'observed', item: '', teraType: '', moves: [], newMove: '' },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function multLabel(mult: number): string {
  if (mult === 0) return '×0';
  if (mult === 0.25) return '×¼';
  if (mult === 0.5) return '×½';
  if (mult === 2) return '×2';
  if (mult === 4) return '×4';
  return '×1';
}

function multColor(mult: number): string {
  if (mult === 0) return 'text-blue-300';
  if (mult <= 0.25) return 'text-teal-200 font-bold';
  if (mult <= 0.5) return 'text-teal-300';
  if (mult >= 4) return 'text-red-400 font-bold';
  if (mult >= 2) return 'text-orange-400';
  return 'text-text/60';
}

function pokeTypes(pokemon: Pokemon | null): TypeName[] {
  if (!pokemon) return [];
  return pokemon.types.map((t) => t.type.name as TypeName);
}

// Separate defender weaknesses/resists/immunities
function categorize(mults: Record<TypeName, number>) {
  const weaknesses4: TypeName[] = [];
  const weaknesses2: TypeName[] = [];
  const resists2: TypeName[] = [];
  const resists4: TypeName[] = [];
  const immunities: TypeName[] = [];
  for (const [type, mult] of Object.entries(mults) as [TypeName, number][]) {
    if (mult === 4) weaknesses4.push(type);
    else if (mult === 2) weaknesses2.push(type);
    else if (mult === 0.5) resists2.push(type);
    else if (mult === 0.25) resists4.push(type);
    else if (mult === 0) immunities.push(type);
  }
  return { weaknesses4, weaknesses2, resists2, resists4, immunities };
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function BattlePlannerPage() {
  const teams = useMemo(() => Teams.list(), []);

  const [view, setView] = useState<View>('matchup');
  const [mode, setMode] = useState<Mode>('singles');
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id ?? '');

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  );

  // My active slots (index into selectedTeam.slots, null = nothing selected)
  const [myActiveIdx, setMyActiveIdx] = useState<[number | null, number | null]>([null, null]);

  // Opponents
  const [opponents, setOpponents] = useState<[OpponentSlot, OpponentSlot]>([
    emptyOpponent(),
    emptyOpponent(),
  ]);
  const [oppSearch, setOppSearch] = useState<[string, string]>(['', '']);
  const [oppNotesOpen, setOppNotesOpen] = useState<[boolean, boolean]>([false, false]);

  // Type check state — up to 2 selected types
  const [tcSelectedTypes, setTcSelectedTypes] = useState<TypeName[]>([]);

  const handleTcToggle = (type: TypeName) => {
    setTcSelectedTypes((prev) => {
      if (prev.includes(type)) return prev.filter((t) => t !== type);
      if (prev.length < 2) return [...prev, type];
      // Already 2 selected — drop oldest, add new
      return [prev[1], type];
    });
  };

  // Pokémon index for opponent search
  const { data: pokemonIndex } = useQuery({
    queryKey: ['pokemon-index'],
    queryFn: api.pokemonIndex,
    staleTime: Infinity,
  });

  const mySlot1 = selectedTeam?.slots[myActiveIdx[0] ?? -1] ?? null;
  const mySlot2 = selectedTeam?.slots[myActiveIdx[1] ?? -1] ?? null;

  // API data for my active Pokémon
  const myPoke1Q = useQuery({
    queryKey: ['pokemon', mySlot1?.pokemonName ?? ''],
    queryFn: () => api.pokemon(mySlot1!.pokemonName),
    enabled: !!mySlot1,
    staleTime: Infinity,
  });
  const myPoke2Q = useQuery({
    queryKey: ['pokemon', mySlot2?.pokemonName ?? ''],
    queryFn: () => api.pokemon(mySlot2!.pokemonName),
    enabled: !!mySlot2 && mode === 'doubles',
    staleTime: Infinity,
  });

  // API data for opponents
  const opp1Q = useQuery({
    queryKey: ['pokemon', opponents[0].pokemonName],
    queryFn: () => api.pokemon(opponents[0].pokemonName),
    enabled: !!opponents[0].pokemonName,
    staleTime: Infinity,
  });
  const opp2Q = useQuery({
    queryKey: ['pokemon', opponents[1].pokemonName],
    queryFn: () => api.pokemon(opponents[1].pokemonName),
    enabled: !!opponents[1].pokemonName && mode === 'doubles',
    staleTime: Infinity,
  });

  // All team member API data (for switch recommendations and overview)
  const teamMemberQs = useQueries({
    queries: (selectedTeam?.slots ?? []).map((slot) => ({
      queryKey: ['pokemon', slot.pokemonName],
      queryFn: () => api.pokemon(slot.pokemonName),
      staleTime: Infinity,
    })),
  });
  const teamMemberData = teamMemberQs.map((q) => q.data ?? null);

  // Move types for my active Pokémon's moves
  const allMoveSlugs = useMemo(() => {
    const moves = [
      ...(mySlot1?.moves ?? []),
      ...(mode === 'doubles' ? (mySlot2?.moves ?? []) : []),
    ].filter(Boolean);
    return [...new Set(moves)];
  }, [mySlot1, mySlot2, mode]);

  const moveQs = useQueries({
    queries: allMoveSlugs.map((slug) => ({
      queryKey: ['move', slug],
      queryFn: () => api.move(slug),
      staleTime: Infinity,
    })),
  });
  const moveTypeMap = useMemo(() => {
    const map = new Map<string, TypeName>();
    allMoveSlugs.forEach((slug, i) => {
      const typeName = moveQs[i]?.data?.type?.name;
      if (typeName) map.set(slug, typeName as TypeName);
    });
    return map;
  }, [allMoveSlugs, moveQs]);

  // Opponent search handlers
  const handleOppSearch = (idx: 0 | 1, val: string) => {
    setOppSearch((prev) => {
      const next = [...prev] as [string, string];
      next[idx] = val;
      return next;
    });
  };

  const handleSelectOpp = (idx: 0 | 1, item: PokemonListItem) => {
    const id = Number(item.url.match(/\/(\d+)\/?$/)?.[1] ?? 0);
    setOpponents((prev) => {
      const next = [...prev] as [OpponentSlot, OpponentSlot];
      next[idx] = { ...next[idx], pokemonName: item.name, pokemonId: id };
      return next;
    });
    setOppSearch((prev) => {
      const next = [...prev] as [string, string];
      next[idx] = '';
      return next;
    });
  };

  const handleClearOpp = (idx: 0 | 1) => {
    setOpponents((prev) => {
      const next = [...prev] as [OpponentSlot, OpponentSlot];
      next[idx] = emptyOpponent();
      return next;
    });
    setOppNotesOpen((prev) => {
      const next = [...prev] as [boolean, boolean];
      next[idx] = false;
      return next;
    });
  };

  const updateNotes = (idx: 0 | 1, patch: Partial<OpponentNotes>) => {
    setOpponents((prev) => {
      const next = [...prev] as [OpponentSlot, OpponentSlot];
      next[idx] = { ...next[idx], notes: { ...next[idx].notes, ...patch } };
      return next;
    });
  };

  const addOppMove = (idx: 0 | 1, name: string, conf: Confidence) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateNotes(idx, {
      moves: [...opponents[idx].notes.moves, { name: trimmed, conf }],
      newMove: '',
    });
  };

  const removeOppMove = (idx: 0 | 1, moveIdx: number) => {
    const moves = opponents[idx].notes.moves.filter((_, i) => i !== moveIdx);
    updateNotes(idx, { moves });
  };

  // ---------------------------------------------------------------------------
  // Computed data for matchup analysis
  // ---------------------------------------------------------------------------
  const myPoke1 = myPoke1Q.data ?? null;
  const myPoke2 = myPoke2Q.data ?? null;
  const opp1Data = opp1Q.data ?? null;
  const opp2Data = opp2Q.data ?? null;


  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Page header + view tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <h1 className="text-2xl font-bold">Battle Planner</h1>
        <div className="sm:ml-auto flex gap-1 bg-bg-elev rounded-lg p-1">
          {(['matchup', 'type-check', 'team-overview'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={clsx(
                'px-3 py-1 rounded-md text-sm transition-colors',
                view === v ? 'bg-bg text-text shadow-card' : 'text-muted hover:text-text',
              )}
            >
              {v === 'matchup' ? 'Matchup' : v === 'type-check' ? 'Type Check' : 'Team Overview'}
            </button>
          ))}
        </div>
      </div>

      {/* ── MATCHUP VIEW ── */}
      {view === 'matchup' && (
        <div className="space-y-4">
          {/* Team + mode selector */}
          <div className="card p-4 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm text-muted whitespace-nowrap">Team:</span>
              {teams.length === 0 ? (
                <span className="text-sm text-muted italic">No saved teams — build one in Team Builder first.</span>
              ) : (
                <select
                  className="input text-sm flex-1 min-w-0"
                  value={selectedTeamId}
                  onChange={(e) => {
                    setSelectedTeamId(e.target.value);
                    setMyActiveIdx([null, null]);
                  }}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex gap-1 bg-bg-hover rounded-lg p-1">
              {(['singles', 'doubles'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setMyActiveIdx((prev) => [prev[0], null]);
                    setOpponents((prev) => [prev[0], emptyOpponent()]);
                  }}
                  className={clsx(
                    'px-3 py-1 rounded-md text-sm capitalize transition-colors',
                    mode === m ? 'bg-bg text-text shadow-card' : 'text-muted hover:text-text',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* My side + Opponent side */}
          <div className={clsx('grid gap-4', mode === 'doubles' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 md:grid-cols-2')}>
            {/* MY SIDE */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">My Pokémon</h2>
              {([0, 1] as const).filter((i) => i === 0 || mode === 'doubles').map((slotIdx) => {
                const activeIdx = myActiveIdx[slotIdx];
                const mySlot = activeIdx !== null ? (selectedTeam?.slots[activeIdx] ?? null) : null;
                const myPokeData = slotIdx === 0 ? myPoke1 : myPoke2;
                return (
                  <MySlotCard
                    key={slotIdx}
                    slotIdx={slotIdx}
                    team={selectedTeam}
                    activeIdx={activeIdx}
                    mySlot={mySlot}
                    myPokeData={myPokeData}
                    opponents={[opp1Data, opp2Data]}
                    moveTypeMap={moveTypeMap}
                    onSelectIdx={(idx) =>
                      setMyActiveIdx((prev) => {
                        const next = [...prev] as [number | null, number | null];
                        next[slotIdx] = idx;
                        return next;
                      })
                    }
                  />
                );
              })}
            </div>

            {/* OPPONENT SIDE */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
                {mode === 'doubles' ? 'Opponents' : 'Opponent'}
              </h2>
              {([0, 1] as const).filter((i) => i === 0 || mode === 'doubles').map((oppIdx) => (
                <OpponentSlotCard
                  key={oppIdx}
                  oppIdx={oppIdx}
                  opp={opponents[oppIdx]}
                  oppData={oppIdx === 0 ? opp1Data : opp2Data}
                  search={oppSearch[oppIdx]}
                  pokemonIndex={pokemonIndex ?? []}
                  notesOpen={oppNotesOpen[oppIdx]}
                  myPokemon={[myPoke1, myPoke2].filter((p): p is Pokemon => !!p)}
                  onSearch={(v) => handleOppSearch(oppIdx, v)}
                  onSelect={(item) => handleSelectOpp(oppIdx, item)}
                  onClear={() => handleClearOpp(oppIdx)}
                  onToggleNotes={() =>
                    setOppNotesOpen((prev) => {
                      const next = [...prev] as [boolean, boolean];
                      next[oppIdx] = !next[oppIdx];
                      return next;
                    })
                  }
                  onUpdateNotes={(patch) => updateNotes(oppIdx, patch)}
                  onAddMove={(name, conf) => addOppMove(oppIdx, name, conf)}
                  onRemoveMove={(moveIdx) => removeOppMove(oppIdx, moveIdx)}
                />
              ))}
            </div>
          </div>

          {/* Analysis panel — shown when at least one of each side is selected */}
          {(myPoke1 || myPoke2) && (opp1Data || opp2Data) && (
            <MatchupAnalysis
              myPokemon={[
                mySlot1 ? { slot: mySlot1, data: myPoke1 } : null,
                mySlot2 ? { slot: mySlot2, data: myPoke2 } : null,
              ].filter((x): x is { slot: TeamSlot; data: Pokemon | null } => !!x)}
              opponents={[opp1Data, opp2Data].filter((p): p is Pokemon => !!p)}
              teamSlots={selectedTeam?.slots ?? []}
              teamData={teamMemberData}
              moveTypeMap={moveTypeMap}
              myActiveIdx={myActiveIdx}
            />
          )}
        </div>
      )}

      {/* ── TYPE CHECK VIEW ── */}
      {view === 'type-check' && (
        <TypeCheckView
          selectedTypes={tcSelectedTypes}
          onToggle={handleTcToggle}
          onClear={() => setTcSelectedTypes([])}
          onSetTypes={setTcSelectedTypes}
          selectedTeam={selectedTeam}
          teamMemberData={teamMemberData}
        />
      )}

      {/* ── TEAM OVERVIEW VIEW ── */}
      {view === 'team-overview' && (
        <TeamOverviewView
          teams={teams}
          selectedTeamId={selectedTeamId}
          setSelectedTeamId={setSelectedTeamId}
          selectedTeam={selectedTeam}
          teamMemberData={teamMemberData}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MySlotCard — selects one of my team Pokémon and shows defensive analysis
// ---------------------------------------------------------------------------

interface MySlotCardProps {
  slotIdx: 0 | 1;
  team: Team | null;
  activeIdx: number | null;
  mySlot: TeamSlot | null;
  myPokeData: Pokemon | null;
  opponents: [Pokemon | null, Pokemon | null];
  moveTypeMap: Map<string, TypeName>;
  onSelectIdx: (idx: number | null) => void;
}

function MySlotCard({ slotIdx, team, activeIdx, mySlot, myPokeData, opponents, moveTypeMap, onSelectIdx }: MySlotCardProps) {
  const myTypes = pokeTypes(myPokeData);
  const defMults = myTypes.length > 0 ? defenderMultipliers(myTypes) : null;
  const { weaknesses4, weaknesses2, resists2, resists4, immunities } = defMults ? categorize(defMults) : { weaknesses4: [], weaknesses2: [], resists2: [], resists4: [], immunities: [] };

  return (
    <div className="card p-4 space-y-3">
      {/* Selector */}
      <div className="flex items-center gap-2">
        {myPokeData ? (
          <Sprite id={myPokeData.id} name={myPokeData.name} size={40} />
        ) : (
          <div className="w-10 h-10 rounded-full bg-bg-hover flex items-center justify-center text-muted text-lg">?</div>
        )}
        <select
          className="input text-sm flex-1"
          value={activeIdx ?? ''}
          onChange={(e) => onSelectIdx(e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">
            {slotIdx === 0 ? 'Select active Pokémon…' : 'Select partner Pokémon…'}
          </option>
          {(team?.slots ?? []).map((slot, i) => (
            <option key={i} value={i}>{prettyName(slot.pokemonName)}</option>
          ))}
        </select>
        {activeIdx !== null && (
          <button type="button" className="text-muted hover:text-text text-sm" onClick={() => onSelectIdx(null)}>✕</button>
        )}
      </div>

      {mySlot && myPokeData && (
        <>
          {/* Types */}
          <div className="flex gap-1.5 flex-wrap">
            {myTypes.map((t) => <TypeBadge key={t} type={t} size="sm" />)}
            {mySlot.teraType && (
              <span className="chip text-xs bg-bg-hover text-muted border border-line/40">
                Tera: {prettyName(mySlot.teraType)}
              </span>
            )}
          </div>

          {/* Defensive matchup */}
          <div className="space-y-1 text-xs">
            {weaknesses4.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-red-400 font-bold w-7 shrink-0">×4</span>
                <div className="flex flex-wrap gap-1">{weaknesses4.map((t) => <TypeBadge key={t} type={t} size="sm" />)}</div>
              </div>
            )}
            {weaknesses2.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-orange-400 font-semibold w-7 shrink-0">×2</span>
                <div className="flex flex-wrap gap-1">{weaknesses2.map((t) => <TypeBadge key={t} type={t} size="sm" />)}</div>
              </div>
            )}
            {resists2.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-teal-300 w-7 shrink-0">×½</span>
                <div className="flex flex-wrap gap-1">{resists2.map((t) => <TypeBadge key={t} type={t} size="sm" />)}</div>
              </div>
            )}
            {resists4.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-teal-200 font-bold w-7 shrink-0">×¼</span>
                <div className="flex flex-wrap gap-1">{resists4.map((t) => <TypeBadge key={t} type={t} size="sm" />)}</div>
              </div>
            )}
            {immunities.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-blue-300 w-7 shrink-0">×0</span>
                <div className="flex flex-wrap gap-1">{immunities.map((t) => <TypeBadge key={t} type={t} size="sm" />)}</div>
              </div>
            )}
          </div>

          {/* Move coverage vs first active opponent */}
          {opponents[0] && mySlot.moves.some(Boolean) && (
            <div className="border-t border-line/30 pt-2 space-y-1">
              <p className="text-xs text-muted">Coverage vs {prettyName(opponents[0].name)}:</p>
              {mySlot.moves.filter(Boolean).map((moveSlug) => {
                const moveType = moveTypeMap.get(moveSlug);
                const oppTypes = pokeTypes(opponents[0]);
                if (!moveType || oppTypes.length === 0) {
                  return (
                    <div key={moveSlug} className="flex items-center gap-2 text-xs">
                      <span className="text-muted/60 truncate">{prettyName(moveSlug)}</span>
                      <span className="text-muted/40 text-[10px]">loading…</span>
                    </div>
                  );
                }
                const eff = defenderMultipliers(oppTypes)[moveType];
                return (
                  <div key={moveSlug} className="flex items-center gap-2 text-xs">
                    <TypeBadge type={moveType} size="sm" className="shrink-0" />
                    <span className="truncate flex-1">{prettyName(moveSlug)}</span>
                    <span className={clsx('shrink-0', multColor(eff))}>{multLabel(eff)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Item + ability */}
          {(mySlot.item || mySlot.ability) && (
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted pt-1">
              {mySlot.ability && <span>Ability: {prettyName(mySlot.ability)}</span>}
              {mySlot.item && <span>Item: {prettyName(mySlot.item)}</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OpponentSlotCard — search + select opponent + optional notes
// ---------------------------------------------------------------------------

interface OpponentSlotCardProps {
  oppIdx: 0 | 1;
  opp: OpponentSlot;
  oppData: Pokemon | null;
  search: string;
  pokemonIndex: PokemonListItem[];
  notesOpen: boolean;
  myPokemon: Pokemon[];
  onSearch: (v: string) => void;
  onSelect: (item: PokemonListItem) => void;
  onClear: () => void;
  onToggleNotes: () => void;
  onUpdateNotes: (patch: Partial<OpponentNotes>) => void;
  onAddMove: (name: string, conf: Confidence) => void;
  onRemoveMove: (moveIdx: number) => void;
}

function OpponentSlotCard({
  oppIdx, opp, oppData, search, pokemonIndex, notesOpen, myPokemon,
  onSearch, onSelect, onClear, onToggleNotes, onUpdateNotes, onAddMove, onRemoveMove,
}: OpponentSlotCardProps) {
  const oppTypes = pokeTypes(oppData);
  const [newMoveConf, setNewMoveConf] = useState<Confidence>('observed');

  const suggestions = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    return pokemonIndex.filter((p) => p.name.includes(q)).slice(0, 8);
  }, [search, pokemonIndex]);

  // What threats does this opponent pose to each of my Pokémon?
  const threats = useMemo(() => {
    if (!oppData || myPokemon.length === 0) return [];
    return myPokemon.map((myP) => {
      const myTypes = pokeTypes(myP);
      const defMults = defenderMultipliers(myTypes);
      const stabs = oppTypes.filter((t) => defMults[t] >= 2);
      return { pokemon: myP, stabs };
    });
  }, [oppData, myPokemon, oppTypes]);

  return (
    <div className="card p-4 space-y-3">
      {/* Search / selected */}
      {!opp.pokemonName ? (
        <div className="relative">
          <input
            type="text"
            className="input w-full text-sm"
            placeholder={`Search opponent ${oppIdx + 1}…`}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
          {suggestions.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 card shadow-xl overflow-hidden max-h-48 overflow-y-auto">
              {suggestions.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-bg-hover transition-colors text-left"
                  onClick={() => onSelect(item)}
                >
                  <span>{prettyName(item.name)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {oppData && <Sprite id={oppData.id} name={oppData.name} size={40} />}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{prettyName(opp.pokemonName)}</p>
              <div className="flex gap-1 mt-0.5 flex-wrap">
                {oppTypes.map((t) => <TypeBadge key={t} type={t} size="sm" />)}
              </div>
            </div>
            <button type="button" className="text-muted hover:text-text text-sm shrink-0" onClick={onClear}>✕</button>
          </div>

          {/* Threats this opponent poses to my Pokémon */}
          {threats.map(({ pokemon, stabs }) => stabs.length > 0 && (
            <div key={pokemon.id} className="text-xs bg-orange-500/10 border border-orange-500/20 rounded px-2 py-1.5">
              <span className="text-orange-400 font-semibold">⚠ </span>
              <span className="text-muted">{prettyName(oppData!.name)}'s </span>
              <span className="text-text">{stabs.map((t) => prettyName(t)).join(', ')}</span>
              <span className="text-muted"> super effective vs {prettyName(pokemon.name)}</span>
            </div>
          ))}

          {/* Notes toggle */}
          <button
            type="button"
            className="text-xs text-accent hover:text-accent/80 flex items-center gap-1.5 transition-colors"
            onClick={onToggleNotes}
          >
            <span className={clsx('transition-transform', notesOpen && 'rotate-90')}>▶</span>
            Notes {opp.notes.moves.length > 0 ? `(${opp.notes.moves.length} moves)` : ''}
          </button>

          {notesOpen && (
            <div className="space-y-2 text-xs pt-1 border-t border-line/30">
              {/* Ability */}
              <div className="flex items-center gap-2">
                <span className="text-muted w-14 shrink-0">Ability</span>
                <input
                  type="text"
                  className="input flex-1 text-xs h-7"
                  placeholder="Unknown"
                  value={opp.notes.ability}
                  onChange={(e) => onUpdateNotes({ ability: e.target.value })}
                />
                {opp.notes.ability && (
                  <ConfBadge
                    conf={opp.notes.abilityConf}
                    onChange={(c) => onUpdateNotes({ abilityConf: c })}
                  />
                )}
              </div>

              {/* Item */}
              <div className="flex items-center gap-2">
                <span className="text-muted w-14 shrink-0">Item</span>
                <input
                  type="text"
                  className="input flex-1 text-xs h-7"
                  placeholder="Unknown"
                  value={opp.notes.item}
                  onChange={(e) => onUpdateNotes({ item: e.target.value })}
                />
              </div>

              {/* Tera type */}
              <div className="flex items-center gap-2">
                <span className="text-muted w-14 shrink-0">Tera</span>
                <input
                  type="text"
                  className="input flex-1 text-xs h-7"
                  placeholder="Unknown"
                  value={opp.notes.teraType}
                  onChange={(e) => onUpdateNotes({ teraType: e.target.value })}
                />
              </div>

              {/* Observed/assumed moves */}
              <div className="space-y-1">
                <span className="text-muted block">Moves seen/suspected:</span>
                {opp.notes.moves.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className={clsx(
                        'text-[10px] px-1.5 py-0.5 rounded border shrink-0',
                        m.conf === 'observed'
                          ? 'bg-green-500/10 border-green-500/30 text-green-400'
                          : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
                      )}
                    >
                      {m.conf === 'observed' ? '✓' : '?'}
                    </span>
                    <span className="flex-1 truncate">{prettyName(m.name)}</span>
                    <button type="button" className="text-muted hover:text-red-400" onClick={() => onRemoveMove(i)}>✕</button>
                  </div>
                ))}
                <div className="flex gap-1 pt-1">
                  <input
                    type="text"
                    className="input flex-1 text-xs h-7"
                    placeholder="Add move…"
                    value={opp.notes.newMove}
                    onChange={(e) => onUpdateNotes({ newMove: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onAddMove(opp.notes.newMove, newMoveConf);
                    }}
                  />
                  <button
                    type="button"
                    className={clsx(
                      'px-2 py-1 rounded text-[10px] border transition-colors',
                      newMoveConf === 'observed'
                        ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                        : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20',
                    )}
                    onClick={() => setNewMoveConf((c) => (c === 'observed' ? 'assumed' : 'observed'))}
                  >
                    {newMoveConf === 'observed' ? '✓ Seen' : '? Assumed'}
                  </button>
                  <button
                    type="button"
                    className="btn text-xs px-2 h-7"
                    onClick={() => onAddMove(opp.notes.newMove, newMoveConf)}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MatchupAnalysis — the main analysis panel
// ---------------------------------------------------------------------------

interface MatchupAnalysisProps {
  myPokemon: { slot: TeamSlot; data: Pokemon | null }[];
  opponents: Pokemon[];
  teamSlots: TeamSlot[];
  teamData: (Pokemon | null)[];
  moveTypeMap: Map<string, TypeName>;
  myActiveIdx: [number | null, number | null];
}

function MatchupAnalysis({ myPokemon, opponents, teamSlots, teamData, moveTypeMap, myActiveIdx }: MatchupAnalysisProps) {
  const allOppTypes = useMemo(
    () => [...new Set(opponents.flatMap((p) => pokeTypes(p)))],
    [opponents],
  );

  // Switch recommendations: team members (not currently active) that resist all opponent STAB types
  const switchRecs = useMemo(() => {
    const activeIndices = new Set([myActiveIdx[0], myActiveIdx[1]].filter((i) => i !== null));
    return teamSlots
      .map((slot, i) => ({ slot, data: teamData[i] ?? null, idx: i }))
      .filter(({ idx, data }) => !activeIndices.has(idx) && !!data)
      .map(({ slot, data }) => {
        const types = pokeTypes(data!);
        const defMults = defenderMultipliers(types);
        const resists = allOppTypes.filter((t) => defMults[t] < 1);
        const vulnerable = allOppTypes.filter((t) => defMults[t] > 1);
        return { slot, data: data!, resists, vulnerable };
      })
      .filter(({ resists }) => resists.length > 0)
      .sort((a, b) => b.resists.length - a.resists.length);
  }, [teamSlots, teamData, allOppTypes, myActiveIdx]);

  if (myPokemon.length === 0 || opponents.length === 0) return null;

  return (
    <div className="card p-4 space-y-4">
      <h2 className="text-sm font-semibold">Matchup Analysis</h2>

      {/* My Pokémon vs Opponent — one block per pair */}
      {myPokemon.map(({ slot: mySlot, data: myData }, myIdx) =>
        opponents.map((oppData, oppIdx) => {
          const myTypes = myData ? pokeTypes(myData) : [];
          const oppTypes = pokeTypes(oppData);
          if (myTypes.length === 0 || oppTypes.length === 0) return null;

          const defMults = defenderMultipliers(myTypes);
          const oppStabThreats = oppTypes.filter((t) => defMults[t] >= 2);
          const oppImmunities = oppTypes.filter((t) => defMults[t] === 0);

          const myDefVsOpp = defenderMultipliers(oppTypes);
          const moveCoverage = mySlot.moves.filter(Boolean).map((slug) => {
            const mt = moveTypeMap.get(slug);
            const eff = mt ? myDefVsOpp[mt] : 1;
            return { slug, moveType: mt ?? null, eff };
          });
          const bestMoves = moveCoverage.filter((m) => m.eff >= 2);

          const key = `${myIdx}-${oppIdx}`;

          return (
            <div key={key} className="bg-bg-hover rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold">
                {prettyName(myData?.name ?? mySlot.pokemonName)}
                <span className="text-muted font-normal"> vs </span>
                {prettyName(oppData.name)}
              </p>

              {oppStabThreats.length > 0 && (
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-orange-400 shrink-0">⚠ Danger</span>
                  <div className="flex flex-wrap gap-1">
                    {oppStabThreats.map((t) => (
                      <TypeBadge key={t} type={t} size="sm" />
                    ))}
                    <span className="text-muted">attacks hit hard</span>
                  </div>
                </div>
              )}

              {oppStabThreats.length === 0 && (
                <p className="text-xs text-teal-300">✓ No immediate STAB threat from this matchup</p>
              )}

              {bestMoves.length > 0 && (
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-green-400 shrink-0">✓ Best moves</span>
                  <div className="flex flex-wrap gap-1">
                    {bestMoves.map((m) => (
                      <span key={m.slug} className="chip bg-green-500/10 border border-green-500/20 text-green-300 text-[10px]">
                        {prettyName(m.slug)} <span className={multColor(m.eff)}>{multLabel(m.eff)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {oppImmunities.length > 0 && (
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-blue-300 shrink-0">Immune to</span>
                  <div className="flex flex-wrap gap-1">
                    {oppImmunities.map((t) => <TypeBadge key={t} type={t} size="sm" />)}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Safe switch-ins */}
      {switchRecs.length > 0 && (
        <div className="border-t border-line/30 pt-3 space-y-2">
          <p className="text-xs text-muted font-semibold">Safer switches from your team:</p>
          {switchRecs.slice(0, 4).map(({ slot, data, resists, vulnerable }) => (
            <div key={slot.pokemonName} className="flex items-center gap-2 text-xs">
              <Sprite id={data.id} name={data.name} size={28} />
              <div className="flex-1 min-w-0">
                <span className="font-semibold">{prettyName(slot.pokemonName)}</span>
                {resists.length > 0 && (
                  <span className="text-muted ml-1">
                    — resists <span className="text-teal-300">{resists.map(prettyName).join(', ')}</span>
                  </span>
                )}
                {vulnerable.length > 0 && (
                  <span className="text-muted ml-1">
                    · weak to <span className="text-orange-400">{vulnerable.map(prettyName).join(', ')}</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TypeCheckView — visual type selector
// ---------------------------------------------------------------------------

interface TypeCheckViewProps {
  selectedTypes: TypeName[];
  onToggle: (t: TypeName) => void;
  onClear: () => void;
  onSetTypes: (types: TypeName[]) => void;
  selectedTeam: Team | null;
  teamMemberData: (Pokemon | null)[];
}

function TypeCheckView({ selectedTypes, onToggle, onClear, onSetTypes, selectedTeam, teamMemberData }: TypeCheckViewProps) {
  const mults = selectedTypes.length > 0 ? defenderMultipliers(selectedTypes) : null;
  const { weaknesses4, weaknesses2, resists2, resists4, immunities } = mults
    ? categorize(mults)
    : { weaknesses4: [], weaknesses2: [], resists2: [], resists4: [], immunities: [] };

  return (
    <div className="space-y-4">
      {/* Type grid */}
      <div className="card p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            {selectedTypes.length === 0
              ? 'Pick up to 2 types'
              : selectedTypes.length === 1
              ? 'One type selected — pick a second for dual typing'
              : 'Dual type selected'}
          </p>
          {selectedTypes.length > 0 && (
            <button
              type="button"
              className="text-xs text-muted hover:text-text transition-colors"
              onClick={onClear}
            >
              Clear
            </button>
          )}
        </div>

        {/* All 18 types as clickable tiles */}
        <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
          {TYPES.map((t) => {
            const selIdx = selectedTypes.indexOf(t);
            const isSelected = selIdx !== -1;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onToggle(t)}
                className={clsx(
                  'relative rounded-md py-2 px-1 text-white text-[11px] font-semibold text-center leading-tight transition-all duration-150 select-none',
                  typeBg(t),
                  isSelected
                    ? 'ring-2 ring-white/90 shadow-lg scale-105 z-10'
                    : 'opacity-60 hover:opacity-90 hover:scale-105',
                )}
              >
                {/* Selection order badge */}
                {isSelected && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white text-bg text-[9px] font-bold flex items-center justify-center shadow">
                    {selIdx + 1}
                  </span>
                )}
                {prettyName(t)}
              </button>
            );
          })}
        </div>

        {/* Quick-fill from saved team */}
        {selectedTeam && teamMemberData.some(Boolean) && (
          <div className="flex flex-wrap gap-1.5 border-t border-line/30 pt-3">
            <span className="text-xs text-muted self-center mr-1">From team:</span>
            {selectedTeam.slots.map((slot, i) => {
              const data = teamMemberData[i];
              if (!data) return null;
              const types = pokeTypes(data);
              const isActive =
                types.length === selectedTypes.length &&
                types.every((t) => selectedTypes.includes(t));
              return (
                <button
                  key={slot.pokemonName}
                  type="button"
                  className={clsx(
                    'flex items-center gap-1 chip text-xs transition-colors',
                    isActive ? 'bg-bg-elev ring-1 ring-accent/60' : 'bg-bg-hover hover:bg-bg-elev',
                  )}
                  onClick={() => onSetTypes(types)}
                >
                  <Sprite id={data.id} name={data.name} size={18} />
                  {prettyName(slot.pokemonName)}
                  <span className="flex gap-0.5">
                    {types.map((t) => (
                      <span key={t} className={clsx('w-2 h-2 rounded-full', typeBg(t))} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Results */}
      {selectedTypes.length > 0 && mults && (
        <div className="card p-4 space-y-4">
          {/* Selected types header */}
          <div className="flex items-center gap-2">
            {selectedTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onToggle(t)}
                title={`Deselect ${t}`}
                className={clsx(
                  'chip text-white text-sm px-3 py-1 font-semibold transition-all hover:opacity-80 hover:line-through',
                  typeBg(t),
                )}
              >
                {prettyName(t)}
              </button>
            ))}
            <span className="text-muted text-xs">(click to deselect)</span>
          </div>

          {/* Matchup rows */}
          <div className="space-y-3">
            {weaknesses4.length > 0 && (
              <MatchupRow label="Quad weak" mult="×4" color="text-red-400" types={weaknesses4} />
            )}
            {weaknesses2.length > 0 && (
              <MatchupRow label="Weak" mult="×2" color="text-orange-400" types={weaknesses2} />
            )}
            {immunities.length > 0 && (
              <MatchupRow label="Immune" mult="×0" color="text-blue-300" types={immunities} />
            )}
            {resists4.length > 0 && (
              <MatchupRow label="Quad resist" mult="×¼" color="text-teal-200" types={resists4} />
            )}
            {resists2.length > 0 && (
              <MatchupRow label="Resists" mult="×½" color="text-teal-300" types={resists2} />
            )}
            {weaknesses4.length === 0 && weaknesses2.length === 0 && immunities.length === 0 &&
              resists2.length === 0 && resists4.length === 0 && (
              <p className="text-sm text-muted">All types deal neutral (×1) damage.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MatchupRow({ label, mult, color, types }: { label: string; mult: string; color: string; types: TypeName[] }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-24 shrink-0 text-right">
        <span className="text-xs text-muted">{label} </span>
        <span className={clsx('text-sm font-bold', color)}>{mult}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {types.map((t) => <TypeBadge key={t} type={t} />)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TeamOverviewView
// ---------------------------------------------------------------------------

interface TeamOverviewViewProps {
  teams: Team[];
  selectedTeamId: string;
  setSelectedTeamId: (id: string) => void;
  selectedTeam: Team | null;
  teamMemberData: (Pokemon | null)[];
}

function TeamOverviewView({ teams, selectedTeamId, setSelectedTeamId, selectedTeam, teamMemberData }: TeamOverviewViewProps) {
  // Shared weaknesses across the whole team
  const sharedWeaknesses = useMemo(() => {
    const pokemonList = teamMemberData.filter(Boolean) as Pokemon[];
    if (pokemonList.length === 0) return { x4: [], x2: [], immune: [] };

    const weakCounts: Partial<Record<TypeName, number>> = {};
    for (const poke of pokemonList) {
      const types = pokeTypes(poke);
      const mults = defenderMultipliers(types);
      for (const [t, m] of Object.entries(mults) as [TypeName, number][]) {
        if (m >= 2) weakCounts[t] = (weakCounts[t] ?? 0) + 1;
      }
    }
    const sorted = (Object.entries(weakCounts) as [TypeName, number][])
      .sort((a, b) => b[1] - a[1]);
    return sorted;
  }, [teamMemberData]);

  const pokemonList = (teamMemberData.filter(Boolean) as Pokemon[]);

  return (
    <div className="space-y-4">
      {/* Team selector */}
      <div className="card p-4 flex items-center gap-3">
        <span className="text-sm text-muted">Team:</span>
        {teams.length === 0 ? (
          <span className="text-sm text-muted italic">No saved teams.</span>
        ) : (
          <select
            className="input text-sm flex-1"
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
          >
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      {selectedTeam && pokemonList.length > 0 && (
        <>
          {/* Team type matrix */}
          <div className="card p-4 space-y-3">
            <h2 className="text-sm font-semibold">Team Defensive Coverage</h2>
            <div className="grid gap-3">
              {selectedTeam.slots.map((slot, i) => {
                const data = teamMemberData[i];
                if (!data) return null;
                const types = pokeTypes(data);
                const mults = defenderMultipliers(types);
                const { weaknesses4, weaknesses2, immunities } = categorize(mults);
                return (
                  <div key={slot.pokemonName} className="flex items-start gap-3">
                    <Sprite id={data.id} name={data.name} size={36} />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold">{prettyName(slot.pokemonName)}</span>
                        {types.map((t) => <TypeBadge key={t} type={t} size="sm" />)}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                        {weaknesses4.length > 0 && (
                          <span>
                            <span className="text-red-400 font-bold">×4 </span>
                            <span className="text-muted">{weaknesses4.join(', ')}</span>
                          </span>
                        )}
                        {weaknesses2.length > 0 && (
                          <span>
                            <span className="text-orange-400">×2 </span>
                            <span className="text-muted">{weaknesses2.join(', ')}</span>
                          </span>
                        )}
                        {immunities.length > 0 && (
                          <span>
                            <span className="text-blue-300">Immune </span>
                            <span className="text-muted">{immunities.join(', ')}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shared weakness warnings */}
          {Array.isArray(sharedWeaknesses) && sharedWeaknesses.length > 0 && (
            <div className="card p-4 space-y-2">
              <h2 className="text-sm font-semibold">Team Weakness Warnings</h2>
              {(sharedWeaknesses as [TypeName, number][])
                .filter(([, count]) => count >= 2)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2 text-sm">
                    <TypeBadge type={type} size="sm" />
                    <span className={clsx('font-semibold', count >= 4 ? 'text-red-400' : count >= 3 ? 'text-orange-400' : 'text-yellow-400')}>
                      {count} {count === 1 ? 'member' : 'members'} weak
                    </span>
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      {selectedTeam && pokemonList.length === 0 && (
        <div className="card p-8 text-center text-muted">
          This team has no Pokémon yet. Add some in Team Builder.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small shared components
// ---------------------------------------------------------------------------


function ConfBadge({ conf, onChange }: { conf: Confidence; onChange: (c: Confidence) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(conf === 'observed' ? 'assumed' : 'observed')}
      className={clsx(
        'text-[10px] px-1.5 py-0.5 rounded border transition-colors shrink-0',
        conf === 'observed'
          ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
          : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20',
      )}
    >
      {conf === 'observed' ? '✓ Seen' : '? Assumed'}
    </button>
  );
}
