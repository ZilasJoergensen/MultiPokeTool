// Team Builder persistence — localStorage, no backend needed.

export const STAT_KEYS = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type EVSpread = Record<StatKey, number>;

export const EMPTY_EVS: EVSpread = {
  hp: 0, attack: 0, defense: 0,
  'special-attack': 0, 'special-defense': 0, speed: 0,
};

/**
 * Team formats — caps differ by ruleset.
 *  - standard: modern mainline games (508 / 252)
 *  - champions: Pokémon Champions (66 / 32)
 */
export type TeamFormat = 'standard' | 'champions';

export interface FormatRules {
  totalCap: number;
  perStatCap: number;
  label: string;
  hint: string;
}

export const FORMATS: Record<TeamFormat, FormatRules> = {
  standard: {
    totalCap: 510,
    perStatCap: 252,
    label: 'Standard (Mainline)',
    hint: '510 total · max 252 per stat (modern competitive cap)',
  },
  champions: {
    totalCap: 66,
    perStatCap: 32,
    label: 'Pokémon Champions',
    hint: '66 total · max 32 per stat',
  },
};

export interface TeamSlot {
  pokemonId: number;
  pokemonName: string;
  nickname?: string;
  /** Up to 4 move names (PokeAPI slug form, e.g. "dragon-dance"). Empty strings = unset. */
  moves: string[];
  item: string | null;
  evs: EVSpread;
  // Stat preview / competitive edits
  ivs?: Record<string, number>;
  level?: number;
  nature?: string;
  // Identity / meta
  ability?: string | null;
  shiny?: boolean;
  gender?: 'M' | 'F' | null;
  teraType?: string | null;
}

export function makeSlot(pokemonId: number, pokemonName: string): TeamSlot {
  return {
    pokemonId,
    pokemonName,
    moves: [],
    item: null,
    evs: { ...EMPTY_EVS },
    ivs: { hp: 31, attack: 31, defense: 31, 'special-attack': 31, 'special-defense': 31, speed: 31 },
    level: 50,
    nature: 'docile',
  };
}

export interface Team {
  id: string;
  name: string;
  format: TeamFormat;
  slots: TeamSlot[]; // up to 6
  createdAt: number;
  updatedAt: number;
}

const KEY = 'pokedex-teams-v1';

function read(): Team[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const teams = JSON.parse(raw) as Team[];
    // Backfill new fields on teams saved with the older schema
    return teams.map((t) => ({
      ...t,
      format: t.format ?? 'standard',
      slots: (t.slots ?? []).map((s) => ({
        ...s,
        moves: s.moves ?? [],
        item: s.item ?? null,
        evs: s.evs ?? { ...EMPTY_EVS },
        ivs: s.ivs ?? { hp: 31, attack: 31, defense: 31, 'special-attack': 31, 'special-defense': 31, speed: 31 },
        level: s.level ?? 50,
        nature: s.nature ?? 'docile',
        ability: s.ability ?? null,
        shiny: s.shiny ?? false,
        gender: s.gender ?? null,
        teraType: s.teraType ?? null,
      })),
    }));
  } catch {
    return [];
  }
}

function write(teams: Team[]) {
  localStorage.setItem(KEY, JSON.stringify(teams));
  window.dispatchEvent(new CustomEvent('teams-changed'));
}

// ---------------------------------------------------------------------------
// Pokémon Showdown export / import
// ---------------------------------------------------------------------------

/** Converts a stat key to Showdown's abbreviated form (e.g. "special-attack" → "SpA"). */
function statAbbr(key: StatKey): string {
  const map: Record<StatKey, string> = {
    hp: 'HP', attack: 'Atk', defense: 'Def',
    'special-attack': 'SpA', 'special-defense': 'SpD', speed: 'Spe',
  };
  return map[key] ?? key;
}

function prettyNameSimple(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function exportTeamShowdown(team: Team): string {
  return team.slots.map((slot) => {
    const lines: string[] = [];
    const name = prettyNameSimple(slot.pokemonName);
    const nickname = slot.nickname ? `${slot.nickname} (${name})` : name;
    const item = slot.item ? ` @ ${prettyNameSimple(slot.item)}` : '';
    lines.push(`${nickname}${item}`);
    if (slot.ability) lines.push(`Ability: ${prettyNameSimple(slot.ability)}`);
    if (slot.shiny) lines.push('Shiny: Yes');
    if (slot.gender === 'M') lines.push('Gender: M');
    if (slot.gender === 'F') lines.push('Gender: F');
    if (slot.teraType) lines.push(`Tera Type: ${prettyNameSimple(slot.teraType)}`);
    const level = slot.level ?? 50;
    if (level !== 100) lines.push(`Level: ${level}`);

    // EVs — only non-zero stats
    const evParts = STAT_KEYS
      .filter((k) => (slot.evs[k] ?? 0) > 0)
      .map((k) => `${slot.evs[k]} ${statAbbr(k)}`);
    if (evParts.length > 0) lines.push(`EVs: ${evParts.join(' / ')}`);

    // Nature
    if (slot.nature && slot.nature !== 'docile') {
      lines.push(`${prettyNameSimple(slot.nature)} Nature`);
    }

    // IVs — only if not all 31
    const ivParts = STAT_KEYS
      .filter((k) => ((slot.ivs ?? {})[k] ?? 31) !== 31)
      .map((k) => `${(slot.ivs ?? {})[k] ?? 31} ${statAbbr(k)}`);
    if (ivParts.length > 0) lines.push(`IVs: ${ivParts.join(' / ')}`);

    // Moves
    for (const move of slot.moves) {
      if (move) lines.push(`- ${prettyNameSimple(move)}`);
    }

    return lines.join('\n');
  }).join('\n\n');
}

export const Teams = {
  list: read,
  get(id: string): Team | undefined {
    return read().find((t) => t.id === id);
  },
  create(name = 'New Team', format: TeamFormat = 'standard'): Team {
    const team: Team = {
      id: crypto.randomUUID(),
      name,
      format,
      slots: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    write([...read(), team]);
    return team;
  },
  update(id: string, patch: Partial<Omit<Team, 'id' | 'createdAt'>>) {
    const teams = read().map((t) =>
      t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t,
    );
    write(teams);
  },
  delete(id: string) {
    write(read().filter((t) => t.id !== id));
  },
  addSlot(id: string, slot: TeamSlot) {
    const t = read().find((x) => x.id === id);
    if (!t) return;
    if (t.slots.length >= 6) return;
    this.update(id, { slots: [...t.slots, slot] });
  },
  removeSlot(id: string, index: number) {
    const t = read().find((x) => x.id === id);
    if (!t) return;
    this.update(id, { slots: t.slots.filter((_, i) => i !== index) });
  },
  updateSlot(id: string, index: number, patch: Partial<TeamSlot>) {
    const t = read().find((x) => x.id === id);
    if (!t) return;
    this.update(id, {
      slots: t.slots.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    });
  },
};
