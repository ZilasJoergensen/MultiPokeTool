import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, idFromUrl, type Pokemon, type MoveDetails, type PokemonListItem } from '../lib/api';
import { calculateStats, NATURES, titleCase, type StatKey } from '../lib/utils';
import { defenderMultipliers, type TypeName } from '../lib/types-chart';
import { TypeBadge } from '../components/TypeBadge';
import { Sprite } from '../components/Sprite';

interface SideState {
  pokemonId: number | null;
  level: number;
  natureId: string;
  ivs: Record<StatKey, number>;
  evs: Record<StatKey, number>;
}

interface DamageResult {
  rolls: number[];
  minDmg: number;
  maxDmg: number;
  minPct: number;
  maxPct: number;
  hp: number;
  hpStat: number;
  typeEff: number;
  stab: number;
  koLabel: string;
  koClass: string;
}

type Weather = 'none' | 'sun' | 'rain' | 'sand' | 'snow';

const ALL_STATS: StatKey[] = [
  'hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed',
];

const STAT_SHORT: Record<StatKey, string> = {
  hp: 'HP',
  attack: 'Atk',
  defense: 'Def',
  'special-attack': 'SpA',
  'special-defense': 'SpD',
  speed: 'Spe',
};

function defaultSide(): SideState {
  return {
    pokemonId: null,
    level: 50,
    natureId: 'docile',
    ivs: { hp: 31, attack: 31, defense: 31, 'special-attack': 31, 'special-defense': 31, speed: 31 },
    evs: { hp: 0, attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0 },
  };
}

export function DamageCalcPage() {
  const [atk, setAtk] = useState<SideState>(defaultSide);
  const [def, setDef] = useState<SideState>(defaultSide);
  const [atkSearch, setAtkSearch] = useState('');
  const [defSearch, setDefSearch] = useState('');
  const [atkOpen, setAtkOpen] = useState(false);
  const [defOpen, setDefOpen] = useState(false);
  const [moveName, setMoveName] = useState('');
  const [moveSearch, setMoveSearch] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);
  const [weather, setWeather] = useState<Weather>('none');
  const [reflect, setReflect] = useState(false);
  const [lightScreen, setLightScreen] = useState(false);
  const [crit, setCrit] = useState(false);
  const [burn, setBurn] = useState(false);
  const [defCurrentHp, setDefCurrentHp] = useState('');

  const { data: pokemonIndex } = useQuery({
    queryKey: ['pokemon-index'],
    queryFn: api.pokemonIndex,
    staleTime: Infinity,
  });

  const { data: atkPokemon } = useQuery({
    queryKey: ['pokemon', atk.pokemonId],
    queryFn: () => api.pokemon(atk.pokemonId!),
    enabled: atk.pokemonId !== null,
    staleTime: Infinity,
  });

  const { data: defPokemon } = useQuery({
    queryKey: ['pokemon', def.pokemonId],
    queryFn: () => api.pokemon(def.pokemonId!),
    enabled: def.pokemonId !== null,
    staleTime: Infinity,
  });

  const { data: moveData, isLoading: moveLoading } = useQuery({
    queryKey: ['move', moveName],
    queryFn: () => api.move(moveName),
    enabled: !!moveName,
    staleTime: Infinity,
  });

  const atkStats = useMemo(() => {
    if (!atkPokemon) return null;
    return calculateStats(atkPokemon.stats, atk.level, atk.ivs, atk.evs, atk.natureId);
  }, [atkPokemon, atk.level, atk.ivs, atk.evs, atk.natureId]);

  const defStats = useMemo(() => {
    if (!defPokemon) return null;
    return calculateStats(defPokemon.stats, def.level, def.ivs, def.evs, def.natureId);
  }, [defPokemon, def.level, def.ivs, def.evs, def.natureId]);

  const atkMoveNames = useMemo(() => {
    if (!atkPokemon) return [];
    return atkPokemon.moves.map((m) => m.move.name).sort();
  }, [atkPokemon]);

  const filteredAtkPoke = useMemo(() => {
    if (!pokemonIndex || !atkSearch) return [];
    const q = atkSearch.toLowerCase();
    return pokemonIndex.filter((p) => p.name.includes(q)).slice(0, 20);
  }, [pokemonIndex, atkSearch]);

  const filteredDefPoke = useMemo(() => {
    if (!pokemonIndex || !defSearch) return [];
    const q = defSearch.toLowerCase();
    return pokemonIndex.filter((p) => p.name.includes(q)).slice(0, 20);
  }, [pokemonIndex, defSearch]);

  const filteredMoves = useMemo(() => {
    if (!atkMoveNames.length) return [];
    if (!moveSearch) return atkMoveNames.slice(0, 50);
    const q = moveSearch.toLowerCase();
    return atkMoveNames.filter((m) => m.includes(q)).slice(0, 50);
  }, [atkMoveNames, moveSearch]);

  const damageResult = useMemo((): DamageResult | null => {
    if (!atkStats || !defStats || !moveData) return null;
    if (!moveData.power || moveData.damage_class.name === 'status') return null;

    const power = moveData.power;
    const isPhysical = moveData.damage_class.name === 'physical';
    const moveType = moveData.type.name as TypeName;

    const atkVal = isPhysical ? atkStats['attack'] : atkStats['special-attack'];
    const defVal = isPhysical ? defStats['defense'] : defStats['special-defense'];
    const hpStat = defStats['hp'];

    const atkTypes = atkPokemon!.types.map((t) => t.type.name as TypeName);
    const defTypes = defPokemon!.types.map((t) => t.type.name as TypeName);

    const typeEff = defenderMultipliers(defTypes)[moveType];
    const stab = atkTypes.includes(moveType) ? 1.5 : 1;

    let weatherMod = 1;
    if (weather === 'sun') {
      weatherMod = moveType === 'fire' ? 1.5 : moveType === 'water' ? 0.5 : 1;
    } else if (weather === 'rain') {
      weatherMod = moveType === 'water' ? 1.5 : moveType === 'fire' ? 0.5 : 1;
    }

    const critMod = crit ? 1.5 : 1;
    const screenMod =
      !crit && ((isPhysical && reflect) || (!isPhysical && lightScreen)) ? 0.5 : 1;
    const burnMod = isPhysical && burn ? 0.5 : 1;

    // Gen VI+ base damage formula
    const base =
      Math.floor(
        Math.floor((Math.floor((2 * atk.level) / 5 + 2) * power * atkVal) / defVal) / 50,
      ) + 2;

    const rolls: number[] = [];
    for (let r = 85; r <= 100; r++) {
      let d = Math.floor(base * critMod);
      d = Math.floor(d * weatherMod);
      d = Math.floor((d * r) / 100);
      d = Math.floor(d * stab);
      d = Math.floor(d * typeEff);
      d = Math.floor(d * burnMod);
      d = Math.floor(d * screenMod);
      rolls.push(Math.max(1, d));
    }

    const minDmg = rolls[0];
    const maxDmg = rolls[15];
    const hp =
      Number(defCurrentHp) > 0 ? Math.min(Number(defCurrentHp), hpStat) : hpStat;

    const ohkoCount = rolls.filter((r) => r >= hp).length;
    const twoHkoCount = rolls.filter((r) => 2 * r >= hp).length;

    let koLabel: string;
    let koClass: string;
    if (minDmg >= hp) {
      koLabel = 'Guaranteed OHKO';
      koClass = 'text-green-400';
    } else if (ohkoCount > 0) {
      koLabel = `Possible OHKO (${Math.round((ohkoCount / 16) * 100)}% chance)`;
      koClass = 'text-yellow-400';
    } else if (2 * minDmg >= hp) {
      koLabel = 'Guaranteed 2HKO';
      koClass = 'text-yellow-400';
    } else if (twoHkoCount > 0) {
      koLabel = `Possible 2HKO (${Math.round((twoHkoCount / 16) * 100)}% chance)`;
      koClass = 'text-muted';
    } else {
      koLabel = '3HKO or worse';
      koClass = 'text-muted';
    }

    return {
      rolls,
      minDmg,
      maxDmg,
      minPct: (minDmg / hp) * 100,
      maxPct: (maxDmg / hp) * 100,
      hp,
      hpStat,
      typeEff,
      stab,
      koLabel,
      koClass,
    };
  }, [
    atkStats, defStats, moveData, atkPokemon, defPokemon,
    atk.level, weather, crit, reflect, lightScreen, burn, defCurrentHp,
  ]);

  function selectAtk(id: number) {
    setAtk((p) => ({ ...p, pokemonId: id }));
    setAtkSearch('');
    setAtkOpen(false);
    setMoveName('');
    setMoveSearch('');
  }

  function selectDef(id: number) {
    setDef((p) => ({ ...p, pokemonId: id }));
    setDefSearch('');
    setDefOpen(false);
    setDefCurrentHp('');
  }

  const modifiers = [
    { label: 'Reflect', val: reflect, set: setReflect },
    { label: 'Light Screen', val: lightScreen, set: setLightScreen },
    { label: 'Critical Hit', val: crit, set: setCrit },
    { label: 'Burned', val: burn, set: setBurn },
  ];

  const emptyMessage =
    !atk.pokemonId || !def.pokemonId
      ? 'Select an attacker and a defender to begin'
      : !moveName
        ? "Select a move from the attacker's move list"
        : moveData?.damage_class.name === 'status' || !moveData?.power
          ? 'Selected move deals no damage — choose a damaging move'
          : 'Loading…';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Damage Calculator</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attacker */}
        <div className="card p-4 space-y-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Attacker</p>
          <PokemonPicker
            pokemon={atkPokemon}
            search={atkSearch}
            setSearch={setAtkSearch}
            open={atkOpen}
            setOpen={setAtkOpen}
            filtered={filteredAtkPoke}
            onSelect={selectAtk}
          />
          {atkPokemon && atkStats && (
            <>
              <LevelNature side={atk} setSide={setAtk} />
              <StatGrid stats={atkStats} side={atk} setSide={setAtk} />
              <MovePicker
                moves={filteredMoves}
                selected={moveName}
                search={moveSearch}
                setSearch={setMoveSearch}
                open={moveOpen}
                setOpen={setMoveOpen}
                onSelect={(m) => { setMoveName(m); setMoveSearch(''); setMoveOpen(false); }}
                moveData={moveData}
                moveLoading={moveLoading}
              />
            </>
          )}
        </div>

        {/* Defender */}
        <div className="card p-4 space-y-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Defender</p>
          <PokemonPicker
            pokemon={defPokemon}
            search={defSearch}
            setSearch={setDefSearch}
            open={defOpen}
            setOpen={setDefOpen}
            filtered={filteredDefPoke}
            onSelect={selectDef}
          />
          {defPokemon && defStats && (
            <>
              <LevelNature side={def} setSide={setDef} />
              <StatGrid stats={defStats} side={def} setSide={setDef} />
              <div>
                <label className="text-xs text-muted font-medium">Current HP</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    className="input w-24 text-sm"
                    min={1}
                    max={defStats['hp']}
                    placeholder={String(defStats['hp'])}
                    value={defCurrentHp}
                    onChange={(e) => setDefCurrentHp(e.target.value)}
                  />
                  <span className="text-sm text-muted">/ {defStats['hp']}</span>
                  {defCurrentHp && (
                    <button
                      className="text-xs text-accent hover:underline"
                      onClick={() => setDefCurrentHp('')}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modifiers row */}
      <div className="card p-4 flex flex-wrap gap-x-6 gap-y-3 items-end">
        <div>
          <label className="text-xs text-muted font-medium block mb-1">Weather</label>
          <select
            className="input text-sm"
            value={weather}
            onChange={(e) => setWeather(e.target.value as Weather)}
          >
            <option value="none">None</option>
            <option value="sun">Harsh Sun</option>
            <option value="rain">Rain</option>
            <option value="sand">Sandstorm</option>
            <option value="snow">Snow</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          {modifiers.map(({ label, val, set }) => (
            <label key={label} className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded"
                checked={val}
                onChange={(e) => set(e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Result */}
      {damageResult ? (
        <ResultPanel
          result={damageResult}
          atkPokemon={atkPokemon!}
          defPokemon={defPokemon!}
          moveData={moveData!}
        />
      ) : (
        <div className="card p-10 text-center text-muted text-sm">{emptyMessage}</div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PokemonPicker({
  pokemon,
  search,
  setSearch,
  open,
  setOpen,
  filtered,
  onSelect,
}: {
  pokemon: Pokemon | undefined;
  search: string;
  setSearch: (v: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  filtered: PokemonListItem[];
  onSelect: (id: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          className="input w-full text-sm"
          placeholder="Search Pokémon…"
          value={pokemon && !search ? titleCase(pokemon.name) : search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => { if (!search) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && filtered.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-line bg-bg-elev shadow-lg">
            {filtered.map((p) => (
              <li key={p.name}>
                <button
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-elev/80"
                  onMouseDown={() => onSelect(idFromUrl(p.url))}
                >
                  {titleCase(p.name)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {pokemon && (
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <Sprite id={pokemon.id} name={pokemon.name} size={56} />
          </div>
          <div>
            <p className="font-semibold">{titleCase(pokemon.name)}</p>
            <div className="flex gap-1 mt-0.5">
              {pokemon.types.map((t) => (
                <TypeBadge key={t.type.name} type={t.type.name} size="sm" />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LevelNature({
  side,
  setSide,
}: {
  side: SideState;
  setSide: React.Dispatch<React.SetStateAction<SideState>>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs text-muted font-medium block mb-1">Level</label>
        <input
          type="number"
          className="input w-full text-sm"
          min={1}
          max={100}
          value={side.level}
          onChange={(e) =>
            setSide((p) => ({
              ...p,
              level: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
            }))
          }
        />
      </div>
      <div>
        <label className="text-xs text-muted font-medium block mb-1">Nature</label>
        <select
          className="input w-full text-sm"
          value={side.natureId}
          onChange={(e) => setSide((p) => ({ ...p, natureId: e.target.value }))}
        >
          {NATURES.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function StatGrid({
  stats,
  side,
  setSide,
}: {
  stats: Record<string, number>;
  side: SideState;
  setSide: React.Dispatch<React.SetStateAction<SideState>>;
}) {
  return (
    <div>
      <div className="grid grid-cols-[2.5rem_1fr_1fr_2rem] gap-x-2 mb-1 text-xs text-muted font-medium">
        <span />
        <span className="text-center">IV</span>
        <span className="text-center">EV</span>
        <span className="text-right">Val</span>
      </div>
      <div className="space-y-1">
        {ALL_STATS.map((key) => (
          <div key={key} className="grid grid-cols-[2.5rem_1fr_1fr_2rem] gap-x-2 items-center text-xs">
            <span className="text-muted font-medium">{STAT_SHORT[key]}</span>
            <input
              type="number"
              className="input text-xs text-center px-1 py-0.5 w-full"
              min={0}
              max={31}
              value={side.ivs[key]}
              onChange={(e) =>
                setSide((p) => ({
                  ...p,
                  ivs: { ...p.ivs, [key]: Math.max(0, Math.min(31, Number(e.target.value))) },
                }))
              }
            />
            <input
              type="number"
              className="input text-xs text-center px-1 py-0.5 w-full"
              min={0}
              max={252}
              value={side.evs[key]}
              onChange={(e) =>
                setSide((p) => ({
                  ...p,
                  evs: { ...p.evs, [key]: Math.max(0, Math.min(252, Number(e.target.value))) },
                }))
              }
            />
            <span className="text-right font-mono font-semibold tabular-nums">{stats[key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MovePicker({
  moves,
  selected,
  search,
  setSearch,
  open,
  setOpen,
  onSelect,
  moveData,
  moveLoading,
}: {
  moves: string[];
  selected: string;
  search: string;
  setSearch: (v: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSelect: (m: string) => void;
  moveData: MoveDetails | undefined;
  moveLoading: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-muted font-medium block">Move</label>
      <div className="relative">
        <input
          className="input w-full text-sm"
          placeholder="Search moves…"
          value={selected && !search ? titleCase(selected) : search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && moves.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-line bg-bg-elev shadow-lg">
            {moves.map((m) => (
              <li key={m}>
                <button
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-elev/80"
                  onMouseDown={() => onSelect(m)}
                >
                  {titleCase(m)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {moveLoading && <p className="text-xs text-muted">Loading…</p>}
      {moveData && (
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <TypeBadge type={moveData.type.name} size="sm" />
          <span className="text-muted capitalize">{moveData.damage_class.name}</span>
          {moveData.power != null ? (
            <span className="font-medium">BP {moveData.power}</span>
          ) : (
            <span className="text-muted">—</span>
          )}
          {moveData.accuracy != null && (
            <span className="text-muted">{moveData.accuracy}% acc</span>
          )}
        </div>
      )}
    </div>
  );
}

function ResultPanel({
  result,
  atkPokemon,
  defPokemon,
  moveData,
}: {
  result: DamageResult;
  atkPokemon: Pokemon;
  defPokemon: Pokemon;
  moveData: MoveDetails;
}) {
  const { rolls, minDmg, maxDmg, minPct, maxPct, hp, hpStat, typeEff, stab, koLabel, koClass } =
    result;

  const typeEffLabel =
    typeEff === 0
      ? 'Immune (0×)'
      : typeEff === 0.25
        ? '¼× not very effective'
        : typeEff === 0.5
          ? '½× not very effective'
          : typeEff === 1
            ? '1× neutral'
            : typeEff === 2
              ? '2× super effective!'
              : typeEff === 4
                ? '4× doubly super effective!'
                : `${typeEff}×`;

  const typeEffClass =
    typeEff === 0
      ? 'text-muted'
      : typeEff < 1
        ? 'text-red-400'
        : typeEff > 1
          ? 'text-green-400'
          : 'text-text';

  return (
    <div className="card p-5 space-y-5">
      {/* Move info */}
      <div className="flex items-center gap-3 flex-wrap">
        <TypeBadge type={moveData.type.name} />
        <span className="text-sm text-muted capitalize">{moveData.damage_class.name}</span>
        <span className="font-semibold">BP {moveData.power}</span>
        <span className={`text-sm ${typeEffClass}`}>{typeEffLabel}</span>
        {stab > 1 && (
          <span className="text-xs bg-bg-elev border border-line px-2 py-0.5 rounded font-semibold">
            STAB
          </span>
        )}
      </div>

      {/* Damage numbers */}
      <div>
        <p className="text-3xl font-bold tabular-nums">
          {minDmg}–{maxDmg}{' '}
          <span className="text-base font-normal text-muted">
            ({minPct.toFixed(1)}%–{maxPct.toFixed(1)}%)
          </span>
        </p>
        <p className="text-sm text-muted mt-1">
          {titleCase(atkPokemon.name)} → {titleCase(defPokemon.name)}{' '}
          {hp < hpStat ? `(${hp}/${hpStat} HP)` : `(${hpStat} HP)`}
        </p>
      </div>

      {/* Roll visualization */}
      <div>
        <p className="text-xs text-muted mb-1.5">Damage rolls (16 random rolls, 85–100%)</p>
        <div className="flex gap-0.5 items-end h-10">
          {rolls.map((dmg, i) => {
            const heightPct = (dmg / rolls[15]) * 100;
            const isKo = dmg >= hp;
            return (
              <div
                key={i}
                title={`${dmg} (${((dmg / hp) * 100).toFixed(1)}%)`}
                style={{ height: `${Math.max(heightPct, 10)}%` }}
                className={`flex-1 rounded-sm transition-colors ${isKo ? 'bg-green-500' : 'bg-accent/70'}`}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-muted mt-1">
          <span>Min: {minDmg}</span>
          <span className="text-xs">
            {rolls.filter((r) => r >= hp).length} / 16 rolls KO
          </span>
          <span>Max: {maxDmg}</span>
        </div>
      </div>

      {/* KO verdict */}
      <p className={`text-xl font-bold ${koClass}`}>{koLabel}</p>
    </div>
  );
}
