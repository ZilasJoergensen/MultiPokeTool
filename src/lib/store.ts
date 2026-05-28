/**
 * IndexedDB-backed personal-data store.
 *
 * Why IndexedDB and not localStorage?
 *  - localStorage caps at ~5MB and is synchronous.
 *  - Catch trackers + shiny hunt logs + collection records can easily grow
 *    past that, and we don't want UI jank from sync reads.
 *  - IndexedDB gives us per-feature object stores and clean migration hooks
 *    when we add new sections later.
 *
 * What we DO NOT store here:
 *  - PokéAPI reference data (immutable, cached by React Query + Workbox).
 *  - The Teams list (still in localStorage). It moves here in a later phase;
 *    for now `getEverythingForBackup` reads localStorage too so backups are
 *    complete.
 *
 * Migration strategy: bump `DB_VERSION` and add a case to the upgrade handler.
 * Never reuse a store name with a different shape.
 */

import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

const DB_NAME = 'pokedex-userdata';
const DB_VERSION = 5;

/** Singleton key for "the only row in this store". */
const SINGLETON = '_';

export interface UserPrefs {
  /** Which mainline games / version-groups the user owns. PokéAPI version slugs. */
  ownedVersions: string[];
  /** Last-known release version of the app — useful for migrations later. */
  appVersion: string;

  // Collection tracking modes
  /** Whether to track Pokémon forms separately (e.g., Alola Raichu vs Kanto Raichu). */
  trackFormsSeparately?: boolean;
  /** Whether to track shinies separately from regular Pokémon. */
  trackShiniesSeparately?: boolean;
  /** Whether to track living dex slots per game vs globally. */
  trackLivingSlotsPerGame?: boolean;

  // Shiny hunting defaults
  /** Default shiny hunting method for new hunts. */
  defaultShinyMethod?: 'encounters' | 'rest' | 'soft-reset';
  /** Whether to use shiny charm by default. */
  defaultShinyCharm?: boolean;
  /** Auto-track encountered Pokémon in active shiny hunts. */
  autoTrackShinyHunts?: boolean;

  // Team builder rules
  /** Competitive ruleset for teams: standard (510 cap) or Pokémon Champions (66 cap). */
  competitiveRuleset?: 'standard' | 'champions';

  // Appearance / UI
  /** App theme: dark or light. Currently only dark is implemented. */
  theme?: 'dark' | 'light';
  /** Enable compact UI mode (reduced spacing/font sizes). */
  compactMode?: boolean;

  // Data & Privacy
  /** Enable automatic backups of all user data. */
  autoBackupEnabled?: boolean;
  /** Timestamp of last automatic backup. */
  lastBackupTime?: number | null;
}

export interface Favorite {
  pokemonId: number;
  pokemonName: string;
  addedAt: number;
}

export interface RecentView {
  pokemonId: number;
  pokemonName: string;
  viewedAt: number;
}

export type GameDexStatus = 'missing' | 'registered' | 'in_game' | 'moved_to_storage';

// --- Shiny hunt types -------------------------------------------------------

export type HuntStatus = 'active' | 'paused' | 'completed';

export interface ShinyHunt {
  id: string;
  targetPokemonId: number;
  targetPokemonName: string;
  gameId: string;
  method: string;
  shinyCharm: boolean;
  encounters: number;
  phases: number;
  status: HuntStatus;
  startedAt: number;
  updatedAt: number;
  /** Total ms elapsed while paused (so timer is accurate). */
  totalPausedMs: number;
  pausedAt?: number;
  // Completion details
  completedAt?: number;
  ball?: string;
  nature?: string;
  notes?: string;
}

export interface GameDexRecord {
  /** Composite key: `${gameGroupId}:${pokemonId}` */
  id: string;
  gameGroupId: string;
  pokemonId: number;
  pokemonName: string;
  status: GameDexStatus;
  updatedAt: number;
}

export interface StoredPokemon {
  id: string;
  pokemonId: number;
  pokemonName: string;
  nickname?: string;
  shiny: boolean;
  nature?: string;
  ball?: string;
  originGame?: string;
  currentLocation?: string;
  notes?: string;
  addedAt: number;
  updatedAt: number;
}

interface PokedexDB extends DBSchema {
  prefs: {
    key: typeof SINGLETON;
    value: UserPrefs;
  };
  favorites: {
    key: number; // pokemon id
    value: Favorite;
    indexes: { 'by-added': number };
  };
  recent: {
    key: number; // pokemon id
    value: RecentView;
    indexes: { 'by-viewed': number };
  };
  gameDexes: {
    key: string; // `${gameGroupId}:${pokemonId}`
    value: GameDexRecord;
    indexes: { 'by-game': string };
  };
  shinyHunts: {
    key: string; // uuid
    value: ShinyHunt;
    indexes: { 'by-status': string; 'by-updated': number };
  };
  storage: {
    key: string; // uuid
    value: StoredPokemon;
    indexes: { 'by-pokemon': number; 'by-added': number };
  };
}

let _db: Promise<IDBPDatabase<PokedexDB>> | null = null;
function db() {
  if (!_db) {
    _db = openDB<PokedexDB>(DB_NAME, DB_VERSION, {
      upgrade(idb, oldVersion) {
        // v1 — initial stores
        if (oldVersion < 1) {
          idb.createObjectStore('prefs');
          const fav = idb.createObjectStore('favorites', { keyPath: 'pokemonId' });
          fav.createIndex('by-added', 'addedAt');
          const recent = idb.createObjectStore('recent', { keyPath: 'pokemonId' });
          recent.createIndex('by-viewed', 'viewedAt');
        }
        // v2 — game dexes (formerly catch tracker)
        if (oldVersion < 2) {
          const gameDexes = idb.createObjectStore('gameDexes', { keyPath: 'id' });
          gameDexes.createIndex('by-game', 'gameGroupId');
        }
        // v3 — shiny hunter
        if (oldVersion < 3) {
          const hunts = idb.createObjectStore('shinyHunts', { keyPath: 'id' });
          hunts.createIndex('by-status', 'status');
          hunts.createIndex('by-updated', 'updatedAt');
        }
        // v4 — personal storage (formerly collection)
        if (oldVersion < 4) {
          const stor = idb.createObjectStore('storage', { keyPath: 'id' });
          stor.createIndex('by-pokemon', 'pokemonId');
          stor.createIndex('by-added', 'addedAt');
        }
        // v5 — create gameDexes/storage for users upgrading from v4 that had catches/collection
        if (oldVersion < 5) {
          if (!idb.objectStoreNames.contains('gameDexes')) {
            const gameDexes = idb.createObjectStore('gameDexes', { keyPath: 'id' });
            gameDexes.createIndex('by-game', 'gameGroupId');
          }
          if (!idb.objectStoreNames.contains('storage')) {
            const stor = idb.createObjectStore('storage', { keyPath: 'id' });
            stor.createIndex('by-pokemon', 'pokemonId');
            stor.createIndex('by-added', 'addedAt');
          }
        }
      },
    });
  }
  return _db;
}

// Simple pub/sub so React components can re-render when this store changes
// without coupling every page to a shared context.
type StoreEvent = 'prefs' | 'favorites' | 'recent' | 'gameDexes' | 'shinyHunts' | 'storage';
const listeners = new Set<(evt: StoreEvent) => void>();
export function subscribeStore(cb: (evt: StoreEvent) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emit(evt: StoreEvent) {
  for (const l of listeners) l(evt);
}

// --- Prefs ------------------------------------------------------------------

const DEFAULT_PREFS: UserPrefs = {
  ownedVersions: [],
  appVersion: '0.1.0',
  // Collection
  trackFormsSeparately: false,
  trackShiniesSeparately: false,
  trackLivingSlotsPerGame: false,
  // Shiny hunting
  defaultShinyMethod: 'encounters',
  defaultShinyCharm: false,
  autoTrackShinyHunts: false,
  // Team builder
  competitiveRuleset: 'standard',
  // Appearance
  theme: 'dark',
  compactMode: false,
  // Data
  autoBackupEnabled: false,
  lastBackupTime: null,
};

export async function getPrefs(): Promise<UserPrefs> {
  const idb = await db();
  return (await idb.get('prefs', SINGLETON)) ?? DEFAULT_PREFS;
}

export async function updatePrefs(patch: Partial<UserPrefs>): Promise<UserPrefs> {
  const idb = await db();
  const current = (await idb.get('prefs', SINGLETON)) ?? DEFAULT_PREFS;
  const next = { ...current, ...patch };
  await idb.put('prefs', next, SINGLETON);
  emit('prefs');
  return next;
}

// --- Favorites --------------------------------------------------------------

export async function listFavorites(): Promise<Favorite[]> {
  const idb = await db();
  const all = await idb.getAllFromIndex('favorites', 'by-added');
  return all.sort((a, b) => b.addedAt - a.addedAt);
}

export async function isFavorite(pokemonId: number): Promise<boolean> {
  const idb = await db();
  return (await idb.get('favorites', pokemonId)) != null;
}

export async function addFavorite(pokemonId: number, pokemonName: string) {
  const idb = await db();
  await idb.put('favorites', {
    pokemonId,
    pokemonName,
    addedAt: Date.now(),
  });
  emit('favorites');
}

export async function removeFavorite(pokemonId: number) {
  const idb = await db();
  await idb.delete('favorites', pokemonId);
  emit('favorites');
}

export async function toggleFavorite(pokemonId: number, pokemonName: string) {
  if (await isFavorite(pokemonId)) {
    await removeFavorite(pokemonId);
  } else {
    await addFavorite(pokemonId, pokemonName);
  }
}

// --- Recently viewed (capped at 50, newest first) --------------------------

const RECENT_CAP = 50;

export async function recordView(pokemonId: number, pokemonName: string) {
  const idb = await db();
  await idb.put('recent', {
    pokemonId,
    pokemonName,
    viewedAt: Date.now(),
  });
  // Prune to the most recent N
  const all = await idb.getAllFromIndex('recent', 'by-viewed');
  if (all.length > RECENT_CAP) {
    const sorted = all.sort((a, b) => a.viewedAt - b.viewedAt);
    const stale = sorted.slice(0, all.length - RECENT_CAP);
    const tx = idb.transaction('recent', 'readwrite');
    await Promise.all(stale.map((r) => tx.store.delete(r.pokemonId)));
    await tx.done;
  }
  emit('recent');
}

export async function listRecent(): Promise<RecentView[]> {
  const idb = await db();
  const all = await idb.getAllFromIndex('recent', 'by-viewed');
  return all.sort((a, b) => b.viewedAt - a.viewedAt);
}

export async function clearRecent() {
  const idb = await db();
  await idb.clear('recent');
  emit('recent');
}

// --- Game Dexes (game-specific Pokédex registration) --------------------------------

export async function listGameDexForGame(gameGroupId: string): Promise<GameDexRecord[]> {
  const idb = await db();
  return idb.getAllFromIndex('gameDexes', 'by-game', gameGroupId);
}

export async function setGameDexStatus(
  gameGroupId: string,
  pokemonId: number,
  pokemonName: string,
  status: GameDexStatus,
): Promise<void> {
  const idb = await db();
  await idb.put('gameDexes', {
    id: `${gameGroupId}:${pokemonId}`,
    gameGroupId,
    pokemonId,
    pokemonName,
    status,
    updatedAt: Date.now(),
  });
  emit('gameDexes');
}

export async function clearGameDex(gameGroupId: string, pokemonId: number): Promise<void> {
  const idb = await db();
  await idb.delete('gameDexes', `${gameGroupId}:${pokemonId}`);
  emit('gameDexes');
}

export async function listAllGameDexRecords(): Promise<GameDexRecord[]> {
  const idb = await db();
  return idb.getAll('gameDexes');
}

// --- Shiny hunts ------------------------------------------------------------

function huntId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createHunt(
  draft: Omit<ShinyHunt, 'id' | 'encounters' | 'phases' | 'status' | 'startedAt' | 'updatedAt' | 'totalPausedMs'>,
): Promise<ShinyHunt> {
  const idb = await db();
  const now = Date.now();
  const hunt: ShinyHunt = {
    ...draft,
    id: huntId(),
    encounters: 0,
    phases: 0,
    status: 'active',
    startedAt: now,
    updatedAt: now,
    totalPausedMs: 0,
  };
  await idb.put('shinyHunts', hunt);
  emit('shinyHunts');
  return hunt;
}

export async function updateHunt(id: string, patch: Partial<ShinyHunt>): Promise<void> {
  const idb = await db();
  const existing = await idb.get('shinyHunts', id);
  if (!existing) return;
  await idb.put('shinyHunts', { ...existing, ...patch, updatedAt: Date.now() });
  emit('shinyHunts');
}

export async function incrementEncounters(id: string, by = 1): Promise<void> {
  const idb = await db();
  const existing = await idb.get('shinyHunts', id);
  if (!existing || existing.status !== 'active') return;
  await idb.put('shinyHunts', {
    ...existing,
    encounters: existing.encounters + by,
    updatedAt: Date.now(),
  });
  emit('shinyHunts');
}

export async function togglePauseHunt(id: string): Promise<void> {
  const idb = await db();
  const existing = await idb.get('shinyHunts', id);
  if (!existing || existing.status === 'completed') return;
  const now = Date.now();
  if (existing.status === 'paused') {
    const pausedMs = existing.pausedAt ? now - existing.pausedAt : 0;
    await idb.put('shinyHunts', {
      ...existing,
      status: 'active',
      pausedAt: undefined,
      totalPausedMs: (existing.totalPausedMs ?? 0) + pausedMs,
      updatedAt: now,
    });
  } else {
    await idb.put('shinyHunts', {
      ...existing,
      status: 'paused',
      pausedAt: now,
      updatedAt: now,
    });
  }
  emit('shinyHunts');
}

export async function completeHunt(
  id: string,
  details: { ball?: string; nature?: string; notes?: string },
): Promise<void> {
  const idb = await db();
  const existing = await idb.get('shinyHunts', id);
  if (!existing) return;
  await idb.put('shinyHunts', {
    ...existing,
    ...details,
    status: 'completed',
    completedAt: Date.now(),
    updatedAt: Date.now(),
  });
  emit('shinyHunts');
}

export async function deleteHunt(id: string): Promise<void> {
  const idb = await db();
  await idb.delete('shinyHunts', id);
  emit('shinyHunts');
}

export async function listHunts(): Promise<ShinyHunt[]> {
  const idb = await db();
  const all = await idb.getAll('shinyHunts');
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listActiveHunts(): Promise<ShinyHunt[]> {
  const idb = await db();
  const active = await idb.getAllFromIndex('shinyHunts', 'by-status', 'active');
  const paused = await idb.getAllFromIndex('shinyHunts', 'by-status', 'paused');
  return [...active, ...paused].sort((a, b) => b.updatedAt - a.updatedAt);
}

// --- Personal Storage (owned Pokémon) -----------------------------------------------

function storageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listStorage(): Promise<StoredPokemon[]> {
  const idb = await db();
  const all = await idb.getAllFromIndex('storage', 'by-added');
  return all.sort((a, b) => b.addedAt - a.addedAt);
}

export async function addToStorage(
  draft: Omit<StoredPokemon, 'id' | 'addedAt' | 'updatedAt'>,
): Promise<StoredPokemon> {
  const idb = await db();
  const now = Date.now();
  const entry: StoredPokemon = { ...draft, id: storageId(), addedAt: now, updatedAt: now };
  await idb.put('storage', entry);
  emit('storage');
  return entry;
}

export async function updateStored(id: string, patch: Partial<StoredPokemon>): Promise<void> {
  const idb = await db();
  const existing = await idb.get('storage', id);
  if (!existing) return;
  await idb.put('storage', { ...existing, ...patch, updatedAt: Date.now() });
  emit('storage');
}

export async function removeFromStorage(id: string): Promise<void> {
  const idb = await db();
  await idb.delete('storage', id);
  emit('storage');
}

/** All storage entries for a specific Pokémon (uses the by-pokemon index). */
export async function listStorageForPokemon(pokemonId: number): Promise<StoredPokemon[]> {
  const idb = await db();
  return idb.getAllFromIndex('storage', 'by-pokemon', pokemonId);
}

/**
 * Fast game dex status lookup for one Pokémon across a list of game groups.
 * Uses composite key lookups rather than a full table scan.
 */
export async function listGameDexStatusForPokemon(
  pokemonId: number,
  gameGroupIds: string[],
): Promise<GameDexRecord[]> {
  if (gameGroupIds.length === 0) return [];
  const idb = await db();
  const results = await Promise.all(
    gameGroupIds.map((gId) => idb.get('gameDexes', `${gId}:${pokemonId}`)),
  );
  return results.filter((r): r is GameDexRecord => r != null);
}

// --- Backup / restore ------------------------------------------------------

export interface BackupBundle {
  /** Versioned envelope so future imports can migrate older backups. */
  schemaVersion: 1;
  exportedAt: string;
  appVersion: string;
  prefs: UserPrefs;
  favorites: Favorite[];
  recent: RecentView[];
  /** Teams currently live in localStorage; we include them here so backups are
   *  complete. They'll move into IndexedDB in a future phase. */
  teamsLocalStorage?: string;
  gameDexes?: GameDexRecord[];
  shinyHunts?: ShinyHunt[];
  storage?: StoredPokemon[];
}

export async function exportEverything(): Promise<BackupBundle> {
  const idb = await db();
  const [prefs, favorites, recent, gameDexes, shinyHunts, storage] = await Promise.all([
    idb.get('prefs', SINGLETON),
    listFavorites(),
    listRecent(),
    listAllGameDexRecords(),
    listHunts(),
    listStorage(),
  ]);
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: (prefs ?? DEFAULT_PREFS).appVersion,
    prefs: prefs ?? DEFAULT_PREFS,
    favorites,
    recent,
    teamsLocalStorage: localStorage.getItem('pokedex-teams-v1') ?? undefined,
    gameDexes,
    shinyHunts,
    storage,
  };
}

export interface ImportResult {
  prefs: boolean;
  favorites: number;
  recent: number;
  teams: boolean;
  gameDexes: number;
  shinyHunts: number;
  storage: number;
}

export async function importEverything(
  bundle: BackupBundle,
  opts: { merge: boolean } = { merge: true },
): Promise<ImportResult> {
  if (bundle.schemaVersion !== 1) {
    throw new Error(
      `Unsupported backup schema version: ${bundle.schemaVersion}. ` +
        `This app supports up to schema version 1.`,
    );
  }
  const idb = await db();
  const result: ImportResult = { prefs: false, favorites: 0, recent: 0, teams: false, gameDexes: 0, shinyHunts: 0, storage: 0 };

  if (!opts.merge) {
    await Promise.all([
      idb.clear('prefs'),
      idb.clear('favorites'),
      idb.clear('recent'),
      idb.clear('gameDexes'),
      idb.clear('shinyHunts'),
      idb.clear('storage'),
    ]);
  }

  if (bundle.prefs) {
    await idb.put('prefs', bundle.prefs, SINGLETON);
    result.prefs = true;
  }

  if (bundle.favorites?.length) {
    const tx = idb.transaction('favorites', 'readwrite');
    await Promise.all(bundle.favorites.map((f) => tx.store.put(f)));
    await tx.done;
    result.favorites = bundle.favorites.length;
  }

  if (bundle.recent?.length) {
    const tx = idb.transaction('recent', 'readwrite');
    await Promise.all(bundle.recent.map((r) => tx.store.put(r)));
    await tx.done;
    result.recent = bundle.recent.length;
  }

  if (bundle.teamsLocalStorage) {
    localStorage.setItem('pokedex-teams-v1', bundle.teamsLocalStorage);
    window.dispatchEvent(new CustomEvent('teams-changed'));
    result.teams = true;
  }

  if (bundle.gameDexes?.length) {
    const tx = idb.transaction('gameDexes', 'readwrite');
    await Promise.all(bundle.gameDexes.map((g) => tx.store.put(g)));
    await tx.done;
    result.gameDexes = bundle.gameDexes.length;
  }

  if (bundle.shinyHunts?.length) {
    const tx = idb.transaction('shinyHunts', 'readwrite');
    await Promise.all(bundle.shinyHunts.map((h) => tx.store.put(h)));
    await tx.done;
    result.shinyHunts = bundle.shinyHunts.length;
  }

  if (bundle.storage?.length) {
    const tx = idb.transaction('storage', 'readwrite');
    await Promise.all(bundle.storage.map((s) => tx.store.put(s)));
    await tx.done;
    result.storage = bundle.storage.length;
  }

  emit('prefs');
  emit('favorites');
  emit('recent');
  emit('gameDexes');
  emit('shinyHunts');
  emit('storage');

  return result;
}
