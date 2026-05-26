// Thin client over PokeAPI. Pokemon data is immutable, so we cache aggressively
// via React Query + localStorage persistence (see main.tsx).

const BASE = 'https://pokeapi.co/api/v2';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`PokeAPI ${res.status}: ${path}`);
  return res.json();
}

// --- Shared shapes (only the fields we actually use) -------------------------

export interface NamedRef {
  name: string;
  url: string;
}

export interface PokemonListItem extends NamedRef {}

export interface PokemonStat {
  base_stat: number;
  effort: number; // EV yield when defeated
  stat: NamedRef;
}

export interface PokemonType {
  slot: number;
  type: NamedRef;
}

export interface PokemonAbility {
  is_hidden: boolean;
  slot: number;
  ability: NamedRef;
}

export interface VersionGroupDetail {
  level_learned_at: number;
  move_learn_method: NamedRef;
  version_group: NamedRef;
}

export interface PokemonMove {
  move: NamedRef;
  version_group_details: VersionGroupDetail[];
}

export interface Sprites {
  front_default: string | null;
  front_shiny: string | null;
  other?: {
    'official-artwork'?: { front_default: string | null; front_shiny: string | null };
    home?: { front_default: string | null; front_shiny: string | null };
    showdown?: { front_default: string | null; front_shiny: string | null };
  };
}

export interface Pokemon {
  id: number;
  name: string;
  height: number; // decimetres
  weight: number; // hectograms
  base_experience: number | null;
  abilities: PokemonAbility[];
  stats: PokemonStat[];
  types: PokemonType[];
  moves: PokemonMove[];
  sprites: Sprites;
  cries?: { latest?: string; legacy?: string };
  species: NamedRef;
  held_items: { item: NamedRef; version_details: { rarity: number; version: NamedRef }[] }[];
  game_indices: { game_index: number; version: NamedRef }[];
}

export interface AbilityDetails {
  id: number;
  name: string;
  is_main_series: boolean;
  generation: NamedRef;
  effect_entries: { effect: string; short_effect: string; language: NamedRef }[];
  flavor_text_entries: { flavor_text: string; language: NamedRef; version_group: NamedRef }[];
  pokemon: { is_hidden: boolean; pokemon: NamedRef }[];
}

export interface FlavorTextEntry {
  flavor_text: string;
  language: NamedRef;
  version: NamedRef;
}

export interface Genus {
  genus: string;
  language: NamedRef;
}

export interface EvolutionDetail {
  trigger: NamedRef;
  min_level: number | null;
  item: NamedRef | null;
  held_item: NamedRef | null;
  known_move: NamedRef | null;
  known_move_type: NamedRef | null;
  location: NamedRef | null;
  min_affection: number | null;
  min_beauty: number | null;
  min_happiness: number | null;
  needs_overworld_rain: boolean;
  party_species: NamedRef | null;
  party_type: NamedRef | null;
  relative_physical_stats: number | null;
  time_of_day: '' | 'day' | 'night' | 'dusk';
  trade_species: NamedRef | null;
  turn_upside_down: boolean;
  gender: number | null;
}

export interface EvolutionLink {
  species: NamedRef;
  evolution_details: EvolutionDetail[];
  evolves_to: EvolutionLink[];
  is_baby: boolean;
}

export interface EvolutionChain {
  id: number;
  baby_trigger_item: NamedRef | null;
  chain: EvolutionLink;
}

export interface PokemonSpecies {
  id: number;
  name: string;
  order: number;
  capture_rate: number;
  base_happiness: number | null;
  is_baby: boolean;
  is_legendary: boolean;
  is_mythical: boolean;
  hatch_counter: number | null;
  gender_rate: number; // -1 = genderless, otherwise eighths female
  egg_groups: NamedRef[];
  flavor_text_entries: FlavorTextEntry[];
  genera: Genus[];
  generation: NamedRef;
  evolution_chain: { url: string };
  varieties: { is_default: boolean; pokemon: NamedRef }[];
  habitat: NamedRef | null;
  growth_rate: NamedRef;
  pokedex_numbers: { entry_number: number; pokedex: NamedRef }[];
}

export interface EncounterVersionDetail {
  version: NamedRef;
  max_chance: number;
  encounter_details: {
    chance: number;
    max_level: number;
    min_level: number;
    method: NamedRef;
    condition_values: NamedRef[];
  }[];
}

export interface LocationEncounter {
  location_area: NamedRef;
  version_details: EncounterVersionDetail[];
}

export interface MoveDamageClass {
  name: 'physical' | 'special' | 'status';
}

export interface MoveDetails {
  id: number;
  name: string;
  accuracy: number | null;
  power: number | null;
  pp: number | null;
  priority: number;
  type: NamedRef;
  damage_class: MoveDamageClass;
  effect_entries: { short_effect: string; language: NamedRef }[];
  learned_by_pokemon: NamedRef[];
}

// --- Fetchers ---------------------------------------------------------------

export const api = {
  async pokemonIndex(): Promise<PokemonListItem[]> {
    // Pull the full list once. Indigo Disk takes us to ~1025.
    const data = await get<{ results: PokemonListItem[] }>('/pokemon?limit=2000');
    return data.results;
  },
  pokemon: (idOrName: string | number) => get<Pokemon>(`/pokemon/${idOrName}`),
  species: (idOrName: string | number) => get<PokemonSpecies>(`/pokemon-species/${idOrName}`),
  evolutionChain: (id: number | string) => get<EvolutionChain>(`/evolution-chain/${id}`),
  encounters: (idOrName: string | number) =>
    get<LocationEncounter[]>(`/pokemon/${idOrName}/encounters`),
  move: (idOrName: string | number) => get<MoveDetails>(`/move/${idOrName}`),
  type: (name: string) =>
    get<{ pokemon: { pokemon: NamedRef }[] }>(`/type/${name}`),
  ability: (idOrName: string | number) => get<AbilityDetails>(`/ability/${idOrName}`),
  abilityIndex: () =>
    get<{ results: NamedRef[] }>(`/ability?limit=400`).then((d) => d.results),
  moveIndex: () =>
    get<{ results: NamedRef[] }>(`/move?limit=1000`).then((d) => d.results),
  /**
   * Competitive held items only (~141 entries). PokeAPI's `holdable-active`
   * attribute is exactly the set we want: Leftovers, Choice Band, Life Orb,
   * berries, type plates, etc. The broader `holdable` attribute also includes
   * Poké Balls and consumables (Potions), which aren't competitive held items.
   * The `holdable-passive` attribute is empty in PokeAPI's current data.
   */
  async itemIndex(): Promise<NamedRef[]> {
    const data = await get<{ items: NamedRef[] }>(`/item-attribute/holdable-active`);
    return [...data.items].sort((a, b) => a.name.localeCompare(b.name));
  },
};

// Helper: pull the numeric id out of a PokeAPI url like ".../evolution-chain/42/"
export function idFromUrl(url: string): number {
  const m = url.match(/\/(\d+)\/?$/);
  return m ? Number(m[1]) : 0;
}
