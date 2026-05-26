import { QueryClient } from '@tanstack/react-query';

/**
 * Maps game group IDs to their regional Pokédex numeric IDs on PokeAPI.
 * Some games have multiple sub-dexes (e.g. Kalos has Central/Coastal/Mountain).
 * In those cases the value is an array — all sub-dexes are fetched and merged.
 *
 * Numeric IDs: kanto=2, johto=3, hoenn=4, sinnoh=5, unova=8,
 *              kalos-central=12, kalos-coastal=13, kalos-mountain=14,
 *              alola=16, galar=27, paldea=31
 */
export const GAME_TO_REGIONAL_DEX: Record<string, number | number[]> = {
  rby:  2,           // Kanto
  gsc:  3,           // Johto
  rse:  4,           // Hoenn
  frlg: 2,           // FireRed/LeafGreen — Kanto dex
  dppt: 5,           // Sinnoh
  hgss: 3,           // HeartGold/SoulSilver — Johto dex
  bw:   8,           // Unova
  b2w2: 8,           // Black 2/White 2 — Unova dex
  xy:   [12, 13, 14], // Kalos: Central + Coastal + Mountain (merged)
  oras: 4,           // Omega Ruby/Alpha Sapphire — Hoenn dex
  sm:   16,          // Alola
  usum: 16,          // Ultra Sun/Ultra Moon — Alola dex
  lgpe: 2,           // Let's Go — Kanto dex
  swsh: 27,          // Galar
  bdsp: 5,           // Brilliant Diamond/Shining Pearl — Sinnoh dex
  pla:  5,           // Legends: Arceus — Sinnoh dex
  sv:   31,          // Paldea
};

/** Returns the dex IDs for a game as a sorted array (single or multi). */
export function getDexIds(gameId: string): number[] {
  const entry = GAME_TO_REGIONAL_DEX[gameId];
  if (!entry) return [];
  return Array.isArray(entry) ? [...entry].sort((a, b) => a - b) : [entry];
}

/**
 * Stable React Query key for a game's combined regional dex.
 * For single-dex games: ['regional-dex', '5']
 * For multi-dex games:  ['regional-dex', '12+13+14']
 */
export const regionalDexQueryKey = (gameId: string) => {
  const ids = getDexIds(gameId);
  return ['regional-dex', ids.join('+')];
};

/**
 * Fetch all Pokémon IDs in a single PokeAPI Pokédex endpoint.
 */
async function fetchOneDex(dexId: number): Promise<number[]> {
  const url = `https://pokeapi.co/api/v2/pokedex/${dexId}/`;
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) {
    console.warn(`PokeAPI returned ${response.status} for ${url}`);
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return (data.pokemon_entries || [])
    .map((entry: { pokemon_species: { url: string } }) => {
      const match = entry.pokemon_species.url.match(/\/pokemon-species\/(\d+)\//);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter((id: number | null): id is number => id !== null);
}

/**
 * Fetch and merge all Pokémon IDs for a game's regional dex.
 * Handles multi-dex games (e.g. X/Y) by merging sub-dexes into a unique sorted set.
 */
export async function fetchGameDex(gameId: string): Promise<number[]> {
  const ids = getDexIds(gameId);
  if (ids.length === 0) return [];

  const results = await Promise.all(ids.map(fetchOneDex));
  const merged = new Set(results.flat());
  return Array.from(merged).sort((a, b) => a - b);
}

/**
 * Compatibility alias — fetch all Pokémon IDs for a game's regional dex.
 * @deprecated Prefer fetchGameDex for new code.
 */
export const getGameDexPokemon = fetchGameDex;

/**
 * Preload regional dexes for a set of game IDs at app startup.
 * Populates the React Query cache so Catch Tracker opens instantly.
 */
export async function preloadDexes(queryClient: QueryClient, gameIds: string[]): Promise<void> {
  // Deduplicate games that share the same dex (e.g. rby + frlg both use kanto)
  const seen = new Set<string>();
  const unique = gameIds.filter((id) => {
    const key = getDexIds(id).join('+');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await Promise.all(
    unique.map((gameId) =>
      queryClient.prefetchQuery({
        queryKey: regionalDexQueryKey(gameId),
        queryFn: () => fetchGameDex(gameId),
        staleTime: 1000 * 60 * 60 * 24 * 30, // 30 days
      }),
    ),
  );
}
