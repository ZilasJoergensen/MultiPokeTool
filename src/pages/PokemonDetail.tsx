import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, idFromUrl, type EvolutionLink, type EvolutionDetail } from '../lib/api';
import { Sprite, spriteUrl } from '../components/Sprite';
import { TypeBadge } from '../components/TypeBadge';
import { StatBar } from '../components/StatBar';
import { MoveToStorageModal } from '../components/MoveToStorageModal';
import { EvolutionChainModal } from '../components/EvolutionChainModal';
import {
  STAT_LABELS,
  bestFlavorText,
  formatHeight,
  formatWeight,
  genderRatio,
  hatchSteps,
  isValidType,
  padId,
  pickEnglish,
  prettyName,
  titleCase,
} from '../lib/utils';
import { defenderMultipliers, TYPES, type TypeName } from '../lib/types-chart';
import { Teams, makeSlot } from '../lib/teams';
import { InfoTip } from '../components/InfoTip';
import { FadeIn } from '../components/FadeIn';
import {
  isFavorite, recordView, toggleFavorite,
  getPrefs, addToStorage, setGameDexStatus, clearGameDex, createHunt,
  listStorageForPokemon, listGameDexStatusForPokemon, listActiveHunts,
  type GameDexStatus,
} from '../lib/store';
import { useStoreValue } from '../lib/use-store';
import { GAME_GROUPS } from '../lib/games';
import { prefetchPokemonDetail, preloadSprite } from '../lib/prefetch';

type Tab = 'overview' | 'stats' | 'moves' | 'evolution' | 'locations' | 'breeding' | 'matchups';

export function PokemonDetailPage() {
  const { idOrName } = useParams<{ idOrName: string }>();
  const key = idOrName ?? '';
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [shiny, setShiny] = useState(false);
  const [prefs] = useStoreValue(getPrefs, ['prefs']);
  const ownedGameGroupIds = useMemo(() => {
    if (!prefs) return [];
    const owned = new Set(prefs.ownedVersions);
    return GAME_GROUPS.filter((g) => g.versions.some((v) => owned.has(v))).map((g) => g.id);
  }, [prefs]);

  const warmDetail = (idOrName: string | number) => {
    prefetchPokemonDetail(qc, idOrName);
    if (typeof idOrName === 'number') preloadSprite(idOrName);
  };

  const pokemonQ = useQuery({
    queryKey: ['pokemon', key],
    queryFn: () => api.pokemon(key),
    staleTime: 1000 * 60 * 60 * 24 * 30,
    placeholderData: (prev) => prev,
  });
  // Species fires in parallel (not gated by pokemonQ) — they're independent
  // endpoints and the prefetch helper warms both at once. Avoiding a waterfall
  // here removes a visible delay on the detail page hero.
  const speciesQ = useQuery({
    queryKey: ['species', key],
    queryFn: () => api.species(key),
    staleTime: 1000 * 60 * 60 * 24 * 30,
    placeholderData: (prev) => prev,
  });

  // Record that we visited this Pokémon — used by the Recently Viewed rail.
  // We only record once the Pokémon data lands so we have its canonical name.
  useEffect(() => {
    if (pokemonQ.data) {
      void recordView(pokemonQ.data.id, pokemonQ.data.name);
    }
  }, [pokemonQ.data?.id]);

  // Only surface a hard error when the query has definitively failed AND we
  // have nothing cached to show — a network blip on a warm-cache visit won't
  // cause this branch to trigger.
  if (pokemonQ.isError && !pokemonQ.data) {
    return (
      <div className="card p-8 text-center">
        <div className="text-lg font-semibold">Couldn't load that Pokémon.</div>
        <Link to="/pokedex" className="btn mt-4 inline-flex">Back to Pokedex</Link>
      </div>
    );
  }

  // p/s may be undefined on the very first render of a cold (un-prefetched)
  // visit. We render the complete page shell immediately and fade each piece
  // in as its query resolves — no skeleton swap, no layout jump.
  const p = pokemonQ.data;
  const s = speciesQ.data;
  const types = p?.types.map((t) => t.type.name) ?? [];
  const primary = types[0] as string | undefined;

  // Parse a numeric ID directly from the URL so the sprite starts loading on
  // frame 0 — before the API response lands. /pokemon/25 → sprite immediately;
  // /pokemon/pikachu → we wait for the pokemon query to resolve the id.
  const urlId = /^\d+$/.test(key) ? parseInt(key, 10) : 0;
  const spriteId = p?.id ?? urlId;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 text-sm text-muted">
        <Link to="/pokedex" className="hover:text-text">← Pokedex</Link>
        {p && p.id > 1 && (
          <Link
            to={`/pokemon/${p.id - 1}`}
            className="hover:text-text"
            onMouseEnter={() => warmDetail(p.id - 1)}
            onFocus={() => warmDetail(p.id - 1)}
            onTouchStart={() => warmDetail(p.id - 1)}
            onPointerDown={() => warmDetail(p.id - 1)}
          >
            ‹ Prev
          </Link>
        )}
        {p && p.id < 1025 && (
          <Link
            to={`/pokemon/${p.id + 1}`}
            className="hover:text-text"
            onMouseEnter={() => warmDetail(p.id + 1)}
            onFocus={() => warmDetail(p.id + 1)}
            onTouchStart={() => warmDetail(p.id + 1)}
            onPointerDown={() => warmDetail(p.id + 1)}
          >
            Next ›
          </Link>
        )}
      </div>

      {/* Hero — card shell is always visible from frame 0. Each content
          piece fades / slides in as its query resolves so there are no
          skeleton bars and no abrupt DOM swaps. */}
      <div
        className={clsx(
          'card overflow-hidden relative',
          primary && isValidType(primary) && `before:absolute before:inset-0 before:opacity-20 before:bg-type-${primary}`,
        )}
      >
        <div className="relative grid md:grid-cols-[260px,1fr] gap-4 p-4 sm:p-6">
          <div className="flex flex-col items-center gap-2">
            {/* Sprite container is always present; HeroSprite fades the <img>
                in once the image has loaded (or instantly if already cached). */}
            <div className="w-full aspect-square bg-bg-elev/60 rounded-xl grid place-items-center p-2 sm:p-3">
              {spriteId > 0 && (
                <HeroSprite id={spriteId} name={p?.name ?? key} shiny={shiny} size={96} />
              )}
            </div>
            {p && (
              <button
                type="button"
                onClick={() => setShiny((x) => !x)}
                className={clsx('btn text-xs', shiny && 'btn-primary')}
              >
                ✨ {shiny ? 'Shiny on' : 'Show Shiny'}
              </button>
            )}
            {p?.cries?.latest && (
              <button
                type="button"
                onClick={() => new Audio(p.cries!.latest!).play().catch(() => {})}
                className="btn text-xs"
              >
                🔊 Play Cry
              </button>
            )}
          </div>

          <div className="space-y-3 min-w-0">
            {/* ID / genus / generation row — reserve the line height so the
                name below doesn't shift when these appear. */}
            <div className="flex items-baseline gap-3 flex-wrap min-h-[1.25rem]">
              {p && <div className="text-xs font-mono text-muted">{padId(p.id)}</div>}
              {s && (
                <div className="text-xs text-muted">
                  {pickEnglish(s.genera)?.genus ?? ''} · {prettyName(s.generation.name)}
                </div>
              )}
            </div>
            {/* Name — reserve heading height so content below doesn't jump. */}
            <div className="min-h-[2.25rem] sm:min-h-[3rem]">
              {p && (
                <h1 className="text-4xl font-extrabold tracking-tight">{prettyName(p.name)}</h1>
              )}
            </div>
            {/* Type badges — reserve badge-row height. */}
            <div className="flex gap-2 flex-wrap min-h-[1.4rem] sm:min-h-[2rem]">
              {types.map((t) => (
                <TypeBadge key={t} type={t} size="lg" />
              ))}
              {s?.is_legendary && (
                <span className="chip bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 normal-case">
                  Legendary
                </span>
              )}
              {s?.is_mythical && (
                <span className="chip bg-pink-500/20 text-pink-300 border border-pink-500/40 normal-case">
                  Mythical
                </span>
              )}
            </div>
            {/* Flavor text — outer min-h keeps the card tall while the text
                fades in; prevents the buttons below from jumping up. */}
            <div className="min-h-[4.5em] max-w-2xl">
              <FadeIn shown={!!s}>
                <p className="text-sm text-muted leading-relaxed">
                  {s ? bestFlavorText(s.flavor_text_entries) : ''}
                </p>
              </FadeIn>
            </div>
            {/* Personal status — owned/caught/hunt/team chips */}
            <div className="min-h-[1.5rem]">
              {p && prefs && (
                <PersonalStatusBar
                  key={p.id}
                  pokemonId={p.id}
                  ownedGameGroupIds={ownedGameGroupIds}
                />
              )}
            </div>
            {/* Action row */}
            <div className="min-h-[2.25rem] flex flex-wrap gap-1.5">
              {p && prefs && (
                <QuickActions
                  key={p.id}
                  pokemon={p}
                  ownedGameGroupIds={ownedGameGroupIds}
                />
              )}
            </div>
            {/* Game appearances — reserve ~2 chip-rows so the section height
                is stable whether there are 5 chips or 20. */}
            <div className="min-h-[80px]">
              <FadeIn shown={!!s}>
                {s && p && (
                  <GameAppearances
                    fromIndices={p.game_indices.map((g) => g.version.name)}
                    fromFlavor={s.flavor_text_entries
                      .filter((e) => e.language.name === 'en')
                      .map((e) => e.version.name)}
                    fromDexes={s.pokedex_numbers.map((d) => d.pokedex.name)}
                    ownedVersions={prefs ? new Set(prefs.ownedVersions) : new Set()}
                    onClickGame={() => setTab('locations')}
                  />
                )}
              </FadeIn>
            </div>
          </div>
        </div>
      </div>

      {/* Evolution strip — rendered once both queries resolve. On prefetched
          visits the data is already in cache so this is frame-0 content. */}
      <div className={(!p || !s) ? 'min-h-[170px]' : undefined}>
        {s && p && (
          <EvolutionStrip speciesUrl={s.evolution_chain.url} currentId={p.id} />
        )}
      </div>
      {s && p && <AlternateFormsStrip key={p.id} species={s} currentId={p.id} />}

      {/* Tabs — always rendered so their position is stable. Content area
          gets a min-height to prevent the page from collapsing on cold visits
          while the pokemon query is in-flight. */}
      <div className="border-b border-line flex gap-1 overflow-x-auto scroll-thin">
        {(['overview', 'stats', 'moves', 'evolution', 'locations', 'breeding', 'matchups'] as Tab[]).map(
          (t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={clsx('tab-btn whitespace-nowrap', tab === t && 'active')}
            >
              {titleCase(t)}
            </button>
          ),
        )}
      </div>

      <div className="min-h-[200px]">
        {p && tab === 'overview' && <OverviewTab pokemon={p} species={s} />}
        {p && tab === 'stats' && <StatsTab pokemon={p} />}
        {p && tab === 'moves' && <MovesTab pokemon={p} ownedGameGroupIds={ownedGameGroupIds} />}
        {p && tab === 'evolution' && s && <EvolutionTab speciesUrl={s.evolution_chain.url} currentId={p.id} />}
        {p && tab === 'locations' && (
          <LocationsTab
            idOrName={key}
            ownedVersions={prefs ? new Set(prefs.ownedVersions) : new Set()}
          />
        )}
        {p && tab === 'breeding' && s && <BreedingTab species={s} />}
        {p && tab === 'matchups' && <MatchupsTab types={types as TypeName[]} />}
      </div>
    </div>
  );
}

/**
 * Pretty-prints the games this Pokemon appears in. PokeAPI's `game_indices`
 * field lists every game version where this dex entry exists. We collapse
 * matched version-pairs (red+blue, sword+shield...) to a single chip when both
 * are present, since they're effectively the same release.
 */
/**
 * Maps PokeAPI regional pokedex slugs to the version slugs that use them.
 * `pokedex_numbers` on species is the most authoritative source for "what games
 * is this Pokémon in?" — if a Pokémon has a regional dex entry, it's obtainable
 * in that pokedex's games. Flavor entries and game_indices alone miss many
 * games (e.g. Sword/Shield expansions, S/V DLC).
 */
const POKEDEX_TO_VERSIONS: Record<string, string[]> = {
  kanto: ['red', 'blue', 'yellow', 'firered', 'leafgreen'],
  'original-johto': ['gold', 'silver', 'crystal'],
  'original-hoenn': ['ruby', 'sapphire', 'emerald'],
  'original-sinnoh': ['diamond', 'pearl'],
  'extended-sinnoh': ['platinum'],
  'updated-johto': ['heartgold', 'soulsilver'],
  'original-unova': ['black', 'white'],
  'updated-unova': ['black-2', 'white-2'],
  'kalos-central': ['x', 'y'],
  'kalos-coastal': ['x', 'y'],
  'kalos-mountain': ['x', 'y'],
  'updated-hoenn': ['omega-ruby', 'alpha-sapphire'],
  'original-alola': ['sun', 'moon'],
  'original-melemele': ['sun', 'moon'],
  'original-akala': ['sun', 'moon'],
  'original-ulaula': ['sun', 'moon'],
  'original-poni': ['sun', 'moon'],
  'updated-alola': ['ultra-sun', 'ultra-moon'],
  'updated-melemele': ['ultra-sun', 'ultra-moon'],
  'updated-akala': ['ultra-sun', 'ultra-moon'],
  'updated-ulaula': ['ultra-sun', 'ultra-moon'],
  'updated-poni': ['ultra-sun', 'ultra-moon'],
  'letsgo-kanto': ['lets-go-pikachu', 'lets-go-eevee'],
  galar: ['sword', 'shield'],
  'isle-of-armor': ['sword', 'shield'],
  'crown-tundra': ['sword', 'shield'],
  hisui: ['legends-arceus'],
  paldea: ['scarlet', 'violet'],
  kitakami: ['scarlet', 'violet'],
  blueberry: ['scarlet', 'violet'],
  // Special non-mainline / unreleased dexes — we surface them as labels
  // rather than version tags. See SPECIAL_DEXES below.
};

/**
 * Pokedexes that don't cleanly map to released mainline versions. Rendered
 * as their own chip in the "Available in" list.
 */
const SPECIAL_DEXES: Record<string, string> = {
  champions: 'Pokémon Champions',
  'lumiose-city': 'Legends: Z-A',
};

const VERSION_GROUPS: { label: string; versions: string[] }[] = [
  { label: 'Red / Blue', versions: ['red', 'blue'] },
  { label: 'Yellow', versions: ['yellow'] },
  { label: 'Gold / Silver', versions: ['gold', 'silver'] },
  { label: 'Crystal', versions: ['crystal'] },
  { label: 'Ruby / Sapphire', versions: ['ruby', 'sapphire'] },
  { label: 'Emerald', versions: ['emerald'] },
  { label: 'FireRed / LeafGreen', versions: ['firered', 'leafgreen'] },
  { label: 'Diamond / Pearl', versions: ['diamond', 'pearl'] },
  { label: 'Platinum', versions: ['platinum'] },
  { label: 'HeartGold / SoulSilver', versions: ['heartgold', 'soulsilver'] },
  { label: 'Black / White', versions: ['black', 'white'] },
  { label: 'Black 2 / White 2', versions: ['black-2', 'white-2'] },
  { label: 'X / Y', versions: ['x', 'y'] },
  { label: 'Omega Ruby / Alpha Sapphire', versions: ['omega-ruby', 'alpha-sapphire'] },
  { label: 'Sun / Moon', versions: ['sun', 'moon'] },
  { label: 'Ultra Sun / Ultra Moon', versions: ['ultra-sun', 'ultra-moon'] },
  { label: "Let's Go Pikachu / Eevee", versions: ['lets-go-pikachu', 'lets-go-eevee'] },
  { label: 'Sword / Shield', versions: ['sword', 'shield'] },
  { label: 'BD / SP', versions: ['brilliant-diamond', 'shining-pearl'] },
  { label: 'Legends: Arceus', versions: ['legends-arceus'] },
  { label: 'Scarlet / Violet', versions: ['scarlet', 'violet'] },
];

/**
 * `game_indices` on Pokemon is only populated for older games — it's empty
 * for most Gen 6+ Pokémon. The species' `flavor_text_entries` cover more
 * games (one entry per dex-supporting version). We union both sources for
 * the most complete picture available from PokeAPI without extra requests.
 */
function GameAppearances({
  fromIndices,
  fromFlavor,
  fromDexes,
  ownedVersions,
  onClickGame,
}: {
  fromIndices: string[];
  fromFlavor?: string[];
  fromDexes?: string[];
  ownedVersions?: Set<string>;
  onClickGame?: () => void;
}) {
  // Three sources of game-availability data, in order of completeness:
  //  1. fromIndices (Pokemon.game_indices) — Gen 1-5 mostly; empty for Gen 6+
  //  2. fromFlavor (Species.flavor_text_entries[].version) — wherever the
  //     Pokémon has a unique pokedex entry text
  //  3. fromDexes (Species.pokedex_numbers[].pokedex.name) — regional dex
  //     membership, mapped to versions via POKEDEX_TO_VERSIONS. Most complete.
  // We union all three then dedupe.
  const versionSet = new Set<string>([...(fromIndices ?? []), ...(fromFlavor ?? [])]);
  const specialLabels = new Set<string>();
  for (const dex of fromDexes ?? []) {
    const versions = POKEDEX_TO_VERSIONS[dex];
    if (versions) {
      for (const v of versions) versionSet.add(v);
    } else if (SPECIAL_DEXES[dex]) {
      specialLabels.add(SPECIAL_DEXES[dex]);
    }
  }

  if (versionSet.size === 0 && specialLabels.size === 0) {
    return (
      <div className="text-xs text-muted">
        No mainline game appearances recorded — may be Pokémon GO / spin-off / Home only.
      </div>
    );
  }
  const matched = VERSION_GROUPS.filter((g) => g.versions.some((v) => versionSet.has(v)));
  const unmatched = Array.from(versionSet).filter(
    (v) => !VERSION_GROUPS.some((g) => g.versions.includes(v)),
  );

  const chipClass = onClickGame ? 'cursor-pointer hover:border-accent/50 transition-colors' : '';

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
        Available in
      </div>
      <div className="flex flex-wrap gap-1.5">
        {matched.map((g) => {
          const owned = ownedVersions ? g.versions.some((v) => ownedVersions.has(v)) : false;
          return (
            <button
              key={g.label}
              type="button"
              onClick={onClickGame}
              title={owned ? `You own this game — click to see locations` : g.label}
              className={clsx(
                'chip normal-case',
                chipClass,
                owned
                  ? 'bg-accent/15 border border-accent/40 text-text'
                  : 'bg-bg-elev border border-line text-muted',
              )}
            >
              {owned && <span className="text-accent mr-1">✓</span>}
              {g.label}
            </button>
          );
        })}
        {unmatched.map((v) => (
          <button
            key={v}
            type="button"
            onClick={onClickGame}
            className={clsx('chip bg-bg-elev border border-line text-muted normal-case', chipClass)}
          >
            {prettyName(v)}
          </button>
        ))}
        {Array.from(specialLabels).map((label) => (
          <span
            key={label}
            className="chip bg-purple-500/15 border border-purple-500/30 text-purple-300 normal-case"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Hero sprite with a fade-in on image load. If the sprite is already in the
 * browser cache (warmed by `preloadSprite` on hover), it appears instantly.
 *
 * We track the last *loaded* URL rather than a boolean flag so the check is
 * atomic — there is no useEffect that could race with onLoad and reset the
 * state after a cache-hit fires the event synchronously during React's commit.
 */
function HeroSprite({ id, name, shiny, size = 96 }: { id: number; name: string; shiny: boolean; size?: number }) {
  const url = spriteUrl(id, { shiny });
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  return (
    <img
      src={url}
      alt={name}
      width={size}
      height={size}
      onLoad={(e) => setLoadedUrl((e.currentTarget as HTMLImageElement).src)}
      className={clsx(
        'w-full h-full object-contain transition-opacity duration-300 ease-out',
        loadedUrl === url ? 'opacity-100' : 'opacity-0',
      )}
    />
  );
}

function AddToTeam({
  pokemonId,
  pokemonName,
  open: openProp,
  setOpen: setOpenProp,
}: {
  pokemonId: number;
  pokemonName: string;
  open?: boolean;
  setOpen?: (v: boolean) => void;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = openProp !== undefined ? openProp : localOpen;
  const setOpen = setOpenProp ?? setLocalOpen;
  const teams = Teams.list();
  return (
    <div className="relative inline-block">
      <button type="button" className="btn btn-primary" onClick={() => setOpen(!open)}>
        + Add to Team
      </button>
      {open && (
        <div className="absolute mt-2 z-20 w-64 card p-2 space-y-1">
          {teams.length === 0 && (
            <div className="text-xs text-muted px-2 py-1">No teams yet. Create one:</div>
          )}
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-bg-hover text-sm flex justify-between items-center"
              onClick={() => {
                Teams.addSlot(t.id, makeSlot(pokemonId, pokemonName));
                setOpen(false);
              }}
            >
              <span>{t.name}</span>
              <span className="text-xs text-muted">{t.slots.length}/6</span>
            </button>
          ))}
          <button
            type="button"
            className="w-full text-left px-3 py-2 rounded text-sm text-accent hover:bg-bg-hover"
            onClick={() => {
              const t = Teams.create(`Team with ${prettyName(pokemonName)}`);
              Teams.addSlot(t.id, makeSlot(pokemonId, pokemonName));
              setOpen(false);
            }}
          >
            + New team with this Pokémon
          </button>
        </div>
      )}
    </div>
  );
}

// --- Tabs --------------------------------------------------------------------

function OverviewTab({
  pokemon,
  species,
}: {
  pokemon: ReturnType<typeof Object> extends never ? never : any;
  species: any;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="card p-5 space-y-3">
        <SectionTitle>Profile</SectionTitle>
        <Row label="Height">{formatHeight(pokemon.height)}</Row>
        <Row label="Weight">{formatWeight(pokemon.weight)}</Row>
        <Row
          label="Base XP"
          tip="Experience points awarded when this Pokémon is defeated. Higher = your Pokémon levels up faster from this fight."
        >
          {pokemon.base_experience ?? '—'}
        </Row>
        {/* Always render species rows so the card height is stable; fade the
            values in once species data lands. */}
        <Row
          label="Capture Rate"
          tip={
            <>
              Out of 255. Higher = easier to catch in a Poké Ball.
              3 = legendary-tier (very hard); 255 = trivially easy (Caterpie,
              Magikarp). Catch chance is multiplied by ball type, status
              effect, and HP remaining.
            </>
          }
        >
          <FadeValue shown={!!species}>
            {species ? `${species.capture_rate} / 255` : '—'}
          </FadeValue>
        </Row>
        <Row
          label="Base Happiness"
          tip="Friendship value (0-255) this Pokémon starts at when caught. 0 = hostile (Type: Null); 70 = standard; 140+ = pre-bonded (most starters in some games). Affects moves like Return and friendship-evolution timing."
        >
          <FadeValue shown={!!species}>
            {species ? (species.base_happiness ?? '—') : '—'}
          </FadeValue>
        </Row>
        <Row
          label="Growth Rate"
          tip={
            <>
              The XP curve this Pokémon follows from Lv 1 to Lv 100.
              <br />
              <span className="text-muted">Fast = 800k total XP to Lv 100; Medium-Fast = 1M; Medium-Slow = 1.06M; Slow = 1.25M; Fluctuating / Erratic = uneven curves.</span>
            </>
          }
        >
          <FadeValue shown={!!species}>
            {species ? prettyName(species.growth_rate.name) : '—'}
          </FadeValue>
        </Row>
        <Row
          label="Habitat"
          tip="Pokédex-classification of where this species lives. Older-game flavor data; many Gen 6+ Pokémon have no habitat."
        >
          <FadeValue shown={!!species}>
            {species ? (species.habitat ? prettyName(species.habitat.name) : '—') : '—'}
          </FadeValue>
        </Row>
      </div>

      <div className="card p-5 space-y-3">
        <SectionTitle>Abilities</SectionTitle>
        <ul className="space-y-1.5">
          {pokemon.abilities.map((a: any) => (
            <AbilityRow key={a.ability.name} name={a.ability.name} hidden={a.is_hidden} />
          ))}
        </ul>

        <div className="pt-3 flex items-center gap-2">
          <SectionTitle className="!mb-0">EV Yield (when defeated)</SectionTitle>
          <InfoTip
            text={
              <>
                Effort Values (EVs) gained by your Pokémon for defeating this
                one. Max 252 per stat, 510 total. EVs add up to 63 points to a
                single stat at Lv 100, so they're the main way to specialize a
                Pokémon competitively.
              </>
            }
          />
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {pokemon.stats
            .filter((s: any) => s.effort > 0)
            .map((s: any) => (
              <li key={s.stat.name} className="flex justify-between">
                <span className="text-muted">{STAT_LABELS[s.stat.name] ?? s.stat.name}</span>
                <span className="font-semibold">+{s.effort}</span>
              </li>
            ))}
        </ul>

        {pokemon.held_items.length > 0 && (
          <>
            <SectionTitle className="pt-3">Wild Held Items</SectionTitle>
            <ul className="space-y-1 text-sm">
              {pokemon.held_items.map((h: any) => (
                <li key={h.item.name}>
                  <span className="font-medium">{prettyName(h.item.name)}</span>
                  <span className="text-muted">
                    {' '}
                    — {h.version_details.map((v: any) => `${v.rarity}% in ${prettyName(v.version.name)}`).join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Click-to-expand ability row. Lazy-fetches `/ability/{name}` on first open
 * so we don't pay the cost for abilities the user never inspects.
 */
function AbilityRow({ name, hidden }: { name: string; hidden: boolean }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['ability', name],
    queryFn: () => api.ability(name),
    enabled: open,
  });
  const effect = data && (pickEnglish(data.effect_entries)?.short_effect ?? pickEnglish(data.effect_entries)?.effect);
  return (
    <li className="rounded-lg border border-line/60 bg-bg-elev/40">
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-hover/40 rounded-lg"
      >
        <span className={clsx('inline-block transition-transform', open && 'rotate-90')}>▸</span>
        <span className="font-medium">{prettyName(name)}</span>
        {hidden && (
          <span className="chip bg-purple-500/20 text-purple-300 border border-purple-500/30 normal-case">
            Hidden
          </span>
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 text-sm text-muted leading-relaxed border-t border-line/60 pt-2">
          {isLoading ? 'Loading…' : effect ?? 'No effect description available.'}
        </div>
      )}
    </li>
  );
}

/** Min / max of a single stat at a given level. */
function statRange(base: number, statName: string, level: number) {
  function calc(iv: number, ev: number, natureMod: number) {
    if (statName === 'hp') {
      return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
    }
    const raw = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
    return Math.floor(raw * natureMod);
  }
  return {
    min: calc(0, 0, statName === 'hp' ? 1 : 0.9),
    max: calc(31, 252, statName === 'hp' ? 1 : 1.1),
  };
}

function StatsTab({ pokemon }: { pokemon: any }) {
  const [level, setLevel] = useState<50 | 100>(50);
  const total = pokemon.stats.reduce((sum: number, s: any) => sum + s.base_stat, 0);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <SectionTitle className="!mb-0">Base Stats</SectionTitle>
        <div className="flex gap-1 bg-bg-elev rounded-lg p-0.5 border border-line">
          {([50, 100] as const).map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => setLevel(lv)}
              className={clsx(
                'px-2.5 py-1 rounded-md text-xs transition-colors',
                level === lv ? 'bg-bg text-text shadow-card' : 'text-muted hover:text-text',
              )}
            >
              Lv {lv}
            </button>
          ))}
        </div>
        <div className="ml-auto text-[10px] text-muted">
          Min = 0 IV 0 EV −nature · Max = 31 IV 252 EV +nature
        </div>
      </div>

      <div className="space-y-2">
        {/* Header row */}
        <div className="grid grid-cols-[80px,40px,1fr,52px,52px] gap-2 items-center">
          <div />
          <div className="text-[10px] text-muted text-right uppercase tracking-wide">Base</div>
          <div />
          <div className="text-[10px] text-muted text-right uppercase tracking-wide">Min</div>
          <div className="text-[10px] text-muted text-right uppercase tracking-wide">Max</div>
        </div>
        {pokemon.stats.map((s: any) => {
          const { min, max } = statRange(s.base_stat, s.stat.name, level);
          return (
            <div key={s.stat.name} className="grid grid-cols-[80px,40px,1fr,52px,52px] gap-2 items-center">
              <div className="text-xs text-muted">{STAT_LABELS[s.stat.name] ?? s.stat.name}</div>
              <div className="text-sm font-mono font-bold tabular-nums text-right">{s.base_stat}</div>
              <StatBar name={s.stat.name} value={s.base_stat} />
              <div className="text-xs font-mono tabular-nums text-muted text-right">{min}</div>
              <div className="text-xs font-mono tabular-nums text-right font-semibold">{max}</div>
            </div>
          );
        })}
        <div className="grid grid-cols-[80px,40px,1fr,52px,52px] gap-2 items-center pt-2 border-t border-line">
          <div className="text-xs uppercase tracking-wide text-muted">Total</div>
          <div className="text-sm font-mono font-bold tabular-nums text-right text-accent">{total}</div>
          <div /><div /><div />
        </div>
      </div>
    </div>
  );
}

/** Maps PokeAPI version-group slugs to our game-group IDs (for owned-game defaulting). */
const VG_TO_GAME_GROUP: Record<string, string> = {
  'red-blue': 'rby', 'yellow': 'rby',
  'gold-silver': 'gsc', 'crystal': 'gsc',
  'ruby-sapphire': 'rse', 'emerald': 'rse',
  'firered-leafgreen': 'frlg',
  'diamond-pearl': 'dppt', 'platinum': 'dppt',
  'heartgold-soulsilver': 'hgss',
  'black-white': 'bw', 'black-2-white-2': 'b2w2',
  'x-y': 'xy', 'omega-ruby-alpha-sapphire': 'oras',
  'sun-moon': 'sm', 'ultra-sun-ultra-moon': 'usum',
  'lets-go-pikachu-lets-go-eevee': 'lgpe',
  'sword-shield': 'swsh', 'the-isle-of-armor': 'swsh', 'the-crown-tundra': 'swsh',
  'brilliant-diamond-and-shining-pearl': 'bdsp',
  'legends-arceus': 'pla',
  'scarlet-violet': 'sv', 'the-teal-mask': 'sv', 'the-indigo-disk': 'sv',
};

function MovesTab({ pokemon, ownedGameGroupIds }: { pokemon: any; ownedGameGroupIds?: string[] }) {
  const ownedSet = useMemo(() => new Set(ownedGameGroupIds ?? []), [ownedGameGroupIds]);

  // Collect unique version groups from this pokemon's moves, owned ones first
  const versionGroups = useMemo(() => {
    const set = new Set<string>();
    for (const m of pokemon.moves) {
      for (const d of m.version_group_details) set.add(d.version_group.name);
    }
    const all = Array.from(set);
    const owned = all.filter((vg) => ownedSet.has(VG_TO_GAME_GROUP[vg] ?? ''));
    const rest = all.filter((vg) => !ownedSet.has(VG_TO_GAME_GROUP[vg] ?? ''));
    // Within owned, sort latest first; within rest, sort alphabetically descending
    return [...owned.sort((a, b) => b.localeCompare(a)), ...rest.sort((a, b) => b.localeCompare(a))];
  }, [pokemon, ownedSet]);

  const [vg, setVg] = useState<string>(() => versionGroups[0] ?? '');
  const [method, setMethod] = useState<string>('level-up');

  const rows = useMemo(() => {
    const out: { name: string; level: number; method: string }[] = [];
    for (const m of pokemon.moves) {
      for (const d of m.version_group_details) {
        if (d.version_group.name !== vg) continue;
        if (d.move_learn_method.name !== method) continue;
        out.push({
          name: m.move.name,
          level: d.level_learned_at,
          method: d.move_learn_method.name,
        });
      }
    }
    return out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [pokemon, vg, method]);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <SectionTitle className="!mb-0 mr-auto">Learnset</SectionTitle>
        <select className="input" value={vg} onChange={(e) => setVg(e.target.value)}>
          {versionGroups.map((g) => {
            const isOwned = ownedSet.has(VG_TO_GAME_GROUP[g] ?? '');
            return (
              <option key={g} value={g}>{isOwned ? '✓ ' : ''}{prettyName(g)}</option>
            );
          })}
        </select>
        <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="level-up">Level Up</option>
          <option value="machine">TM/HM/TR</option>
          <option value="egg">Egg Moves</option>
          <option value="tutor">Tutor</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="text-muted text-sm">No moves learned by this method in this version.</div>
      ) : (
        <ul className="divide-y divide-line/50">
          {rows.map((r, i) => (
            <MoveRow key={i} name={r.name} level={r.level} showLevel={method === 'level-up'} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Expandable move row — clicking fetches the move's power/accuracy/PP/type/
 * damage class/effect. Lazy so we don't fire 100+ requests on tab open.
 */
function MoveRow({ name, level, showLevel }: { name: string; level: number; showLevel: boolean }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['move', name],
    queryFn: () => api.move(name),
    enabled: open,
  });
  const effect = data && pickEnglish(data.effect_entries)?.short_effect;
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="w-full grid grid-cols-[40px,1fr,auto] gap-3 items-center py-2.5 px-1 text-left hover:bg-bg-hover/40 rounded"
      >
        <span className="font-mono text-muted text-sm text-right">
          {showLevel && level > 0 ? level : '—'}
        </span>
        <span className="font-medium text-sm">{prettyName(name)}</span>
        <span className={clsx('text-muted text-xs transition-transform', open && 'rotate-90')}>▸</span>
      </button>
      {open && (
        <div className="ml-12 mb-3 px-3 py-3 rounded-lg border border-line/60 bg-bg-elev/40 text-sm">
          {isLoading || !data ? (
            <span className="text-muted">Loading…</span>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <TypeBadge type={data.type.name} size="sm" />
                <span
                  className={clsx(
                    'chip border normal-case',
                    data.damage_class.name === 'physical'
                      ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                      : data.damage_class.name === 'special'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                        : 'bg-bg-elev text-muted border-line',
                  )}
                >
                  {data.damage_class.name}
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 text-xs">
                <Stat label="Power" value={data.power ?? '—'} />
                <Stat label="Accuracy" value={data.accuracy != null ? `${data.accuracy}%` : '—'} />
                <Stat label="PP" value={data.pp ?? '—'} />
                <Stat label="Priority" value={data.priority} />
              </div>
              {effect && (
                <p className="text-muted text-xs leading-relaxed pt-1 border-t border-line/40">
                  {effect}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-mono font-bold">{value}</div>
    </div>
  );
}

/**
 * Compact Pokémon-Go style evolution row, always visible on the detail page.
 * Single-stage species (no evolution data) render nothing so we don't waste space.
 */
function EvolutionStrip({
  speciesUrl,
  currentId,
}: {
  speciesUrl: string;
  currentId: number;
}) {
  const chainId = idFromUrl(speciesUrl);
  const { data } = useQuery({
    queryKey: ['evolution-chain', chainId],
    queryFn: () => api.evolutionChain(chainId),
    enabled: chainId > 0,
  });
  if (!data) return null;
  const stages = flattenChain(data.chain);
  const rootBranches = data.chain.evolves_to;
  const useFanoutLayout = rootBranches.length >= 3;
  // Single-stage species — alternate forms are shown separately in AlternateFormsStrip
  if (stages.length < 2) return null;

  // Eevee-style families are hard to scan in a single horizontal chain. Use a
  // fan-out layout that keeps the base form fixed and shows each evolution
  // path as a compact tile with its condition.
  if (useFanoutLayout) {
    return (
      <div className="card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">
          Evolution Paths
        </h2>
        <div className="grid gap-4 lg:grid-cols-[110px,1fr] lg:items-start">
          <div className="flex justify-center lg:justify-start">
            <EvoStageMini
              speciesName={data.chain.species.name}
              highlight={idFromUrl(data.chain.species.url) === currentId}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {rootBranches.map((branch) => (
              <div
                key={branch.species.name}
                className="rounded-xl border border-line/70 bg-bg-elev/35 p-2.5 flex flex-col items-center gap-2"
              >
                <p className="text-[10px] text-muted/80 text-center leading-tight min-h-[1.8rem]">
                  {evoConditionsLabel(branch.evolution_details)}
                </p>
                <EvoStageMini
                  speciesName={branch.species.name}
                  highlight={idFromUrl(branch.species.url) === currentId}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">
        {stages.length > 1 ? 'Evolution Line' : 'Alternate Forms'}
      </h2>
      <div className="flex items-center flex-wrap gap-y-4">
        {stages.map((stage, idx) => (
          <div key={stage.species.name + idx} className="flex items-center">
            {idx > 0 && <EvoArrow label={evoConditionsLabel(stage.details)} />}
            <EvoStageMini speciesName={stage.species.name} highlight={stage.id === currentId} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Classify a PokeAPI variety slug. Mega/Primal/Gigantamax forms aren't part of
 * the standard evolution_chain — they're listed as `varieties` on the species.
 * Region-specific forms (alolan, galarian, hisuian, paldean) and trivial form
 * differences (gender, build, etc.) are NOT shown in the evo strip to avoid
 * clutter — those are visible from the detail page anyway.
 */
function classifyVariety(slug: string): { kind: string; label: string } | null {
  if (/-mega-x$/.test(slug)) return { kind: 'mega', label: 'Mega X' };
  if (/-mega-y$/.test(slug)) return { kind: 'mega', label: 'Mega Y' };
  if (/-mega$/.test(slug)) return { kind: 'mega', label: 'Mega' };
  if (/-gmax$/.test(slug)) return { kind: 'gmax', label: 'Gigantamax' };
  if (/-primal$/.test(slug)) return { kind: 'primal', label: 'Primal' };
  if (/-eternamax$/.test(slug)) return { kind: 'special', label: 'Eternamax' };
  if (/-origin$/.test(slug)) return { kind: 'origin', label: 'Origin Forme' };
  // Regional forms
  if (/-alola$/.test(slug)) return { kind: 'regional', label: 'Alolan Form' };
  if (/-galar$/.test(slug)) return { kind: 'regional', label: 'Galarian Form' };
  if (/-hisui$/.test(slug)) return { kind: 'regional', label: 'Hisuian Form' };
  if (/-paldea$/.test(slug)) return { kind: 'regional', label: 'Paldean Form' };
  return null;
}

/** Arrow connector between evolution stages — a line + arrowhead + condition label. */
function EvoArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center px-1 min-w-[72px] max-w-[100px]">
      <div className="flex items-center w-full text-line">
        <div className="flex-1 h-px bg-line" />
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none" className="shrink-0 text-muted/50">
          <path d="M0 6h14M10 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="text-[10px] text-muted/70 text-center leading-tight mt-1 px-1 max-w-full">
        {label}
      </p>
    </div>
  );
}

function EvoStageMini({
  speciesName,
  highlight,
}: {
  speciesName: string;
  highlight: boolean;
}) {
  const qc = useQueryClient();
  const { data: species } = useQuery({
    queryKey: ['species', speciesName],
    queryFn: () => api.species(speciesName),
  });
  const id = species?.id ?? 0;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <Link
        to={`/pokemon/${speciesName}`}
        onMouseEnter={() => prefetchPokemonDetail(qc, speciesName)}
        onFocus={() => prefetchPokemonDetail(qc, speciesName)}
        onTouchStart={() => prefetchPokemonDetail(qc, speciesName)}
        onPointerDown={() => prefetchPokemonDetail(qc, speciesName)}
        className={clsx(
          'group flex flex-col items-center gap-1.5 p-2.5 rounded-xl w-[90px] transition-colors',
          highlight
            ? 'bg-accent/25 ring-2 ring-accent/70 shadow-md shadow-accent/10'
            : 'hover:bg-bg-elev/70',
        )}
      >
        <div className="w-[72px] h-[72px] flex items-center justify-center">
          {id > 0 ? (
            <Sprite
              id={id}
              name={speciesName}
              size={72}
              className={clsx(
                'w-full h-full object-contain transition-transform duration-200',
                !highlight && 'group-hover:-translate-y-0.5',
              )}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-bg-elev animate-pulse" />
          )}
        </div>
        <span
          className={clsx(
            'text-[11px] font-semibold w-full text-center truncate transition-colors',
            highlight ? 'text-accent' : 'text-muted group-hover:text-text',
          )}
        >
          {prettyName(speciesName)}
        </span>
      </Link>

    </div>
  );
}

/** Per-kind colour tokens: idle border/bg, active ring/bg, label colour. */
const VARIETY_STYLES: Record<string, { idle: string; active: string; text: string }> = {
  mega:     { idle: 'border-purple-500/35 bg-purple-500/10', active: 'ring-2 ring-purple-400/70 border-purple-400/60 bg-purple-500/20 shadow-md shadow-purple-500/10', text: 'text-purple-200' },
  gmax:     { idle: 'border-pink-500/35   bg-pink-500/10',   active: 'ring-2 ring-pink-400/70   border-pink-400/60   bg-pink-500/20   shadow-md shadow-pink-500/10',   text: 'text-pink-200'   },
  primal:   { idle: 'border-orange-500/35 bg-orange-500/10', active: 'ring-2 ring-orange-400/70 border-orange-400/60 bg-orange-500/20 shadow-md shadow-orange-500/10', text: 'text-orange-200' },
  origin:   { idle: 'border-sky-500/35    bg-sky-500/10',    active: 'ring-2 ring-sky-400/70    border-sky-400/60    bg-sky-500/20    shadow-md shadow-sky-500/10',    text: 'text-sky-200'    },
  special:  { idle: 'border-yellow-500/35 bg-yellow-500/10', active: 'ring-2 ring-yellow-400/70 border-yellow-400/60 bg-yellow-500/20 shadow-md shadow-yellow-500/10', text: 'text-yellow-200' },
  regional: { idle: 'border-teal-500/35   bg-teal-500/10',   active: 'ring-2 ring-teal-400/70   border-teal-400/60   bg-teal-500/20   shadow-md shadow-teal-500/10',   text: 'text-teal-200'   },
};
const VARIETY_FALLBACK = {
  idle: 'border-line bg-bg-elev/60',
  active: 'ring-2 ring-accent/60 border-accent/40 bg-accent/15 shadow-md',
  text: 'text-text',
};

/**
 * Mini card for a notable alternate form (Mega, GMax, Primal…).
 * Stacked below the main stage card, same width, highlighted when the user
 * is currently viewing that form's detail page.
 */
function VarietyCard({
  slug,
  kind,
  label,
  currentId,
}: {
  slug: string;
  kind: string;
  label: string;
  currentId: number;
}) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['pokemon', slug],
    queryFn: () => api.pokemon(slug),
  });
  const sprite =
    data?.sprites.other?.['official-artwork']?.front_default ??
    data?.sprites.other?.home?.front_default ??
    data?.sprites.front_default;
  const isActive = !!data && data.id === currentId;
  const colors = VARIETY_STYLES[kind] ?? VARIETY_FALLBACK;

  return (
    <Link
      to={`/pokemon/${slug}`}
      onMouseEnter={() => prefetchPokemonDetail(qc, slug)}
      onFocus={() => prefetchPokemonDetail(qc, slug)}
      onTouchStart={() => prefetchPokemonDetail(qc, slug)}
      onPointerDown={() => prefetchPokemonDetail(qc, slug)}
      className={clsx(
        'flex flex-col items-center gap-1 p-2 rounded-xl w-[90px] border transition-all',
        isActive ? colors.active : `${colors.idle} hover:brightness-110`,
      )}
      title={prettyName(slug)}
    >
      <div className="w-12 h-12 flex items-center justify-center">
        {sprite ? (
          <img src={sprite} alt={slug} className="w-full h-full object-contain" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-current/10 animate-pulse" />
        )}
      </div>
      <span className={clsx('text-[10px] font-bold uppercase tracking-wide text-center leading-tight', colors.text)}>
        {label}
      </span>
    </Link>
  );
}

function EvolutionTab({ speciesUrl, currentId }: { speciesUrl: string; currentId: number }) {
  const chainId = idFromUrl(speciesUrl);
  const { data, isLoading } = useQuery({
    queryKey: ['evolution-chain', chainId],
    queryFn: () => api.evolutionChain(chainId),
    enabled: chainId > 0,
  });

  if (isLoading) return <div className="card p-5 text-sm text-muted">Loading evolution chain…</div>;
  if (!data) return <div className="card p-5 text-sm text-muted">No evolution info.</div>;

  const stages = flattenChain(data.chain);

  return (
    <div className="card p-5">
      <SectionTitle>Evolution Line</SectionTitle>
      <div className="flex flex-wrap items-center gap-3">
        {stages.map((stage, idx) => (
          <div key={stage.species.name} className="flex items-center gap-3">
            {idx > 0 && (
              <div className="flex flex-col items-center text-muted">
                <div className="text-xl">→</div>
                <div className="text-[10px] max-w-[120px] text-center leading-tight px-1">
                  {evoConditionsLabel(stage.details)}
                </div>
              </div>
            )}
            <EvoCard speciesName={stage.species.name} highlight={stage.id === currentId} />
          </div>
        ))}
      </div>
    </div>
  );
}

interface Stage {
  species: { name: string; url: string };
  details: EvolutionDetail[];
  id: number;
}

function flattenChain(link: EvolutionLink, acc: Stage[] = [], details: EvolutionDetail[] = []): Stage[] {
  acc.push({ species: link.species, details, id: idFromUrl(link.species.url) });
  for (const next of link.evolves_to) {
    flattenChain(next, acc, next.evolution_details);
  }
  return acc;
}

function evoConditionsLabel(details: EvolutionDetail[]): string {
  if (details.length === 0) return 'Base form';
  const d = details[0];
  const parts: string[] = [];
  if (d.min_level != null) parts.push(`Lv ${d.min_level}`);
  if (d.item) parts.push(`Use ${prettyName(d.item.name)}`);
  if (d.held_item) parts.push(`Hold ${prettyName(d.held_item.name)}`);
  if (d.known_move) parts.push(`Knows ${prettyName(d.known_move.name)}`);
  if (d.known_move_type) parts.push(`Knows ${prettyName(d.known_move_type.name)} move`);
  if (d.min_happiness != null) parts.push(`Happiness ${d.min_happiness}+`);
  if (d.min_affection != null) parts.push(`Affection ${d.min_affection}+`);
  if (d.min_beauty != null) parts.push(`Beauty ${d.min_beauty}+`);
  if (d.location) parts.push(`At ${prettyName(d.location.name)}`);
  if (d.time_of_day) parts.push(`${titleCase(d.time_of_day)}`);
  if (d.trade_species) parts.push(`Trade w/ ${prettyName(d.trade_species.name)}`);
  if (d.trigger?.name === 'trade' && !d.trade_species) parts.push('Trade');
  if (d.needs_overworld_rain) parts.push('In rain');
  if (d.turn_upside_down) parts.push('Console upside-down');
  if (d.gender === 1) parts.push('Female');
  if (d.gender === 2) parts.push('Male');
  return parts.join(' · ') || prettyName(d.trigger?.name ?? 'Evolve');
}

function EvoCard({ speciesName, highlight }: { speciesName: string; highlight: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['species', speciesName],
    queryFn: () => api.species(speciesName),
  });
  const id = data?.id ?? 0;
  return (
    <Link
      to={`/pokemon/${speciesName}`}
      onMouseEnter={() => prefetchPokemonDetail(qc, speciesName)}
      onFocus={() => prefetchPokemonDetail(qc, speciesName)}
      onTouchStart={() => prefetchPokemonDetail(qc, speciesName)}
      onPointerDown={() => prefetchPokemonDetail(qc, speciesName)}
      className={clsx(
        'card p-2 w-28 text-center hover:border-accent/40 transition-colors',
        highlight && 'border-accent ring-2 ring-accent/30',
      )}
    >
      <div className="aspect-square bg-bg-elev/50 rounded-md grid place-items-center">
        {id > 0 && <Sprite id={id} name={speciesName} size={80} className="w-full h-full object-contain p-1" />}
      </div>
      <div className="mt-1 text-xs font-semibold truncate">{prettyName(speciesName)}</div>
    </Link>
  );
}

function LocationsTab({ idOrName, ownedVersions }: { idOrName: string; ownedVersions?: Set<string> }) {
  const { data, isLoading } = useQuery({
    queryKey: ['encounters', idOrName],
    queryFn: () => api.encounters(idOrName),
  });

  if (isLoading) return <div className="card p-5 text-muted text-sm">Loading locations…</div>;
  if (!data || data.length === 0) {
    return (
      <div className="card p-5 text-muted text-sm">
        No wild encounter data — this Pokémon is likely gift-only, evolved, traded, or hatched.
      </div>
    );
  }

  // Group by version
  const byVersion = new Map<string, { area: string; methods: string; levels: string; chance: number }[]>();
  for (const enc of data) {
    for (const v of enc.version_details) {
      const key = v.version.name;
      const methods = Array.from(new Set(v.encounter_details.map((d: any) => d.method.name))).join(', ');
      const minLv = Math.min(...v.encounter_details.map((d: any) => d.min_level));
      const maxLv = Math.max(...v.encounter_details.map((d: any) => d.max_level));
      const list = byVersion.get(key) ?? [];
      list.push({
        area: enc.location_area.name,
        methods,
        levels: minLv === maxLv ? `Lv ${minLv}` : `Lv ${minLv}-${maxLv}`,
        chance: v.max_chance,
      });
      byVersion.set(key, list);
    }
  }

  // Sort: owned versions first, then alphabetical
  const sorted = Array.from(byVersion.entries()).sort(([a], [b]) => {
    const aOwned = ownedVersions?.has(a) ?? false;
    const bOwned = ownedVersions?.has(b) ?? false;
    if (aOwned && !bOwned) return -1;
    if (!aOwned && bOwned) return 1;
    return a.localeCompare(b);
  });

  const hasOwned = sorted.some(([v]) => ownedVersions?.has(v));

  return (
    <div className="space-y-4">
      {hasOwned && (
        <div className="text-xs text-muted">
          <span className="inline-block w-2 h-2 rounded-full bg-accent mr-1.5 align-middle" />
          Your games are shown first
        </div>
      )}
      {sorted.map(([version, rows]) => {
        const owned = ownedVersions?.has(version) ?? false;
        return (
          <div key={version} className={clsx('card p-5', owned && 'border-accent/30')}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                {prettyName(version)}
              </h3>
              {owned && (
                <span className="chip bg-accent/15 border border-accent/30 text-accent text-[10px] normal-case py-0">
                  ✓ Owned
                </span>
              )}
            </div>
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-sm">
                <thead className="text-left text-muted text-xs uppercase tracking-wide">
                  <tr>
                    <th className="py-2 pr-4">Area</th>
                    <th className="py-2 pr-4">Method</th>
                    <th className="py-2 pr-4">Levels</th>
                    <th className="py-2 pr-4">Chance</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-line/50">
                      <td className="py-2 pr-4">{prettyName(r.area)}</td>
                      <td className="py-2 pr-4 text-muted">{prettyName(r.methods)}</td>
                      <td className="py-2 pr-4 font-mono text-muted">{r.levels}</td>
                      <td className="py-2 pr-4">{r.chance}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BreedingTab({ species }: { species: any }) {
  return (
    <div className="card p-5 space-y-3 max-w-2xl">
      <SectionTitle>Breeding</SectionTitle>
      <Row label="Gender Ratio">{genderRatio(species.gender_rate)}</Row>
      <Row label="Egg Groups">
        {species.egg_groups.length === 0
          ? '—'
          : species.egg_groups.map((g: any) => prettyName(g.name)).join(', ')}
      </Row>
      <Row label="Hatch Counter">{species.hatch_counter ?? '—'}</Row>
      <Row label="Hatch Steps (approx.)">{hatchSteps(species.hatch_counter)}</Row>
      <Row label="Base Happiness">{species.base_happiness ?? '—'}</Row>
    </div>
  );
}

function MatchupsTab({ types }: { types: TypeName[] }) {
  const valid = types.filter(isValidType);
  if (valid.length === 0) return <div className="card p-5 text-muted text-sm">No type info.</div>;
  const mults = defenderMultipliers(valid);

  const buckets = {
    '4x': [] as TypeName[],
    '2x': [] as TypeName[],
    '0.5x': [] as TypeName[],
    '0.25x': [] as TypeName[],
    '0x': [] as TypeName[],
  };
  for (const t of TYPES) {
    const m = mults[t];
    if (m === 4) buckets['4x'].push(t);
    else if (m === 2) buckets['2x'].push(t);
    else if (m === 0.5) buckets['0.5x'].push(t);
    else if (m === 0.25) buckets['0.25x'].push(t);
    else if (m === 0) buckets['0x'].push(t);
  }

  return (
    <div className="card p-5 space-y-4">
      <SectionTitle>Defensive Matchups</SectionTitle>
      <div className="text-xs text-muted">How much damage this Pokémon takes from incoming attacks.</div>
      <MultiplierRow label="Takes 4× damage from" badge="text-red-400" types={buckets['4x']} />
      <MultiplierRow label="Takes 2× damage from" badge="text-red-300" types={buckets['2x']} />
      <MultiplierRow label="Takes ½× damage from" badge="text-emerald-300" types={buckets['0.5x']} />
      <MultiplierRow label="Takes ¼× damage from" badge="text-emerald-400" types={buckets['0.25x']} />
      <MultiplierRow label="Immune to" badge="text-sky-300" types={buckets['0x']} />
    </div>
  );
}

function MultiplierRow({
  label,
  badge,
  types,
}: {
  label: string;
  badge: string;
  types: TypeName[];
}) {
  if (types.length === 0) return null;
  return (
    <div>
      <div className={clsx('text-xs font-semibold uppercase tracking-wide', badge)}>{label}</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {types.map((t) => (
          <TypeBadge key={t} type={t} size="sm" />
        ))}
      </div>
    </div>
  );
}

// --- Personal status bar -----------------------------------------------------

function PersonalStatusBar({
  pokemonId,
  ownedGameGroupIds,
}: {
  pokemonId: number;
  ownedGameGroupIds: string[];
}) {
  const [storageEntries] = useStoreValue(
    () => listStorageForPokemon(pokemonId),
    ['storage'],
  );
  const [gameDexRecords] = useStoreValue(
    () => listGameDexStatusForPokemon(pokemonId, ownedGameGroupIds),
    ['gameDexes'],
  );
  const [activeHunts] = useStoreValue(
    () => listActiveHunts().then((all) => all.filter((h) => h.targetPokemonId === pokemonId)),
    ['shinyHunts'],
  );
  const onTeams = useMemo(
    () => Teams.list().filter((t) => t.slots.some((s) => s.pokemonId === pokemonId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const owned = storageEntries?.length ?? 0;
  const shinyOwned = storageEntries?.filter((e) => e.shiny).length ?? 0;
  const caughtIn = gameDexRecords?.filter((r) => r.status === 'in_game') ?? [];
  const hasHunt = (activeHunts?.length ?? 0) > 0;

  if (!owned && !caughtIn.length && !hasHunt && !onTeams.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 text-xs mt-0.5">
      {owned > 0 && (
        <Link
          to="/storage"
          className="chip bg-green-500/15 border border-green-500/30 text-green-300 normal-case hover:bg-green-500/25 transition-colors"
        >
          {owned === 1 ? '1 owned' : `${owned} owned`}
          {shinyOwned > 0 && ` · ${shinyOwned} ✨`}
        </Link>
      )}
      {caughtIn.map((r) => {
        const group = GAME_GROUPS.find((g) => g.id === r.gameGroupId);
        return group ? (
          <Link
            key={r.gameGroupId}
            to="/game-dexes"
            className="chip bg-accent/15 border border-accent/30 text-accent normal-case hover:bg-accent/25 transition-colors"
          >
            ✓ {group.short}
          </Link>
        ) : null;
      })}
      {hasHunt && (
        <Link
          to="/shiny-hunter"
          className="chip bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 normal-case hover:bg-yellow-500/25 transition-colors"
        >
          ✦ Hunt active
        </Link>
      )}
      {onTeams.map((t) => (
        <Link
          key={t.id}
          to={`/team-builder/${t.id}`}
          className="chip bg-purple-500/15 border border-purple-500/30 text-purple-300 normal-case hover:bg-purple-500/25 transition-colors"
        >
          {t.name}
        </Link>
      ))}
    </div>
  );
}

// --- Quick actions row -------------------------------------------------------

const HUNT_METHODS = [
  { value: 'random-encounter', label: 'Random Encounter' },
  { value: 'masuda-method', label: 'Masuda Method' },
  { value: 'soft-reset', label: 'Soft Reset' },
  { value: 'chain-fishing', label: 'Chain Fishing' },
  { value: 'dex-nav', label: 'DexNav' },
  { value: 'poke-radar', label: 'PokéRadar' },
  { value: 'sos-chaining', label: 'SOS Chaining' },
  { value: 'dynamax-adventures', label: 'Dynamax Adventures' },
  { value: 'mass-outbreak', label: 'Mass Outbreak' },
];

function QuickActions({
  pokemon,
  ownedGameGroupIds,
}: {
  pokemon: { id: number; name: string };
  ownedGameGroupIds: string[];
}) {
  const { id: pokemonId, name: pokemonName } = pokemon;

  const [fav] = useStoreValue(() => isFavorite(pokemonId), ['favorites']);
  const [storageEntries] = useStoreValue(
    () => listStorageForPokemon(pokemonId),
    ['storage'],
  );
  const [gameDexRecords, refetchGameDexes] = useStoreValue(
    () => listGameDexStatusForPokemon(pokemonId, ownedGameGroupIds),
    ['gameDexes'],
  );

  const inStorage = (storageEntries?.length ?? 0) > 0;
  const gameDexMap = useMemo(() => {
    const m = new Map<string, GameDexStatus>();
    gameDexRecords?.forEach((r) => m.set(r.gameGroupId, r.status));
    return m;
  }, [gameDexRecords]);

  const ownedGroups = useMemo(
    () => GAME_GROUPS.filter((g) => ownedGameGroupIds.includes(g.id)),
    [ownedGameGroupIds],
  );

  const [catchOpen, setGameDexStatusOpen] = useState(false);
  const [huntOpen, setHuntOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [moveToStorageOpen, setMoveToStorageOpen] = useState(false);
  const [moveToStorageGameId, setMoveToStorageGameId] = useState('');
  const [evolutionOpen, setEvolutionOpen] = useState(false);
  const [evolutionGameId, setEvolutionGameId] = useState('');
  const [huntGameId, setHuntGameId] = useState(() => ownedGameGroupIds[0] ?? '');
  const [huntMethod, setHuntMethod] = useState('random-encounter');

  const { data: speciesData } = useQuery({
    queryKey: ['species', pokemonName],
    queryFn: () => api.species(pokemonName),
  });

  async function handleQuickAddStorage() {
    if (inStorage) return;
    await addToStorage({ pokemonId, pokemonName, shiny: false });
  }

  async function handleToggleGameDex(gameId: string) {
    const current = gameDexMap.get(gameId);
    if (current === 'in_game') {
      await clearGameDex(gameId, pokemonId);
    } else {
      await setGameDexStatus(gameId, pokemonId, pokemonName, 'in_game');
    }
    refetchGameDexes();
    setGameDexStatusOpen(false);
  }

  async function handleStartHunt() {
    if (!huntGameId) return;
    await createHunt({
      targetPokemonId: pokemonId,
      targetPokemonName: pokemonName,
      gameId: huntGameId,
      method: huntMethod,
      shinyCharm: false,
    });
    setHuntOpen(false);
  }

  const anyCaught = gameDexRecords?.some((r) => r.status === 'in_game');

  return (
    <div className="flex flex-wrap gap-1.5">
      {/* + Storage */}
      <button
        type="button"
        className={clsx('btn text-sm', inStorage && 'text-green-300 border-green-300/40')}
        onClick={handleQuickAddStorage}
        title={inStorage ? 'Already in collection — visit Collection to manage' : 'Quick-add to your collection'}
      >
        {inStorage ? `✓ ${storageEntries!.length} in Storage` : '+ Storage'}
      </button>

      {/* Mark in Game Dex */}
      {ownedGroups.length > 0 && (
        <div className="relative">
          <button
            type="button"
            className={clsx('btn text-sm', anyCaught && 'text-blue-300 border-blue-300/40')}
            onClick={() => { setGameDexStatusOpen((x) => !x); setHuntOpen(false); setTeamOpen(false); }}
          >
            ✓ Mark in Game Dex
          </button>
          {catchOpen && (
            <div className="absolute mt-1 z-20 min-w-[11rem] card p-2 space-y-0.5">
              {ownedGroups.map((g) => {
                const status = gameDexMap.get(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    className="w-full text-left px-3 py-1.5 rounded text-sm hover:bg-bg-hover flex items-center justify-between gap-2"
                    onClick={() => handleToggleGameDex(g.id)}
                  >
                    <span>{g.short}</span>
                    {status === 'in_game' && <span className="text-green-400 text-xs">✓ in game</span>}
                    {status === 'registered' && <span className="text-blue-400 text-xs">✔ registered</span>}
                    {!status && <span className="text-muted text-xs">—</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Move to Storage */}
      {ownedGroups.length > 0 && (
        <div className="relative">
          <button
            type="button"
            className="btn text-sm"
            onClick={() => { setMoveToStorageOpen((x) => !x); setGameDexStatusOpen(false); setHuntOpen(false); setTeamOpen(false); }}
          >
            📦 Move to Storage
          </button>
          {moveToStorageOpen && (
            <div className="absolute mt-1 z-20 min-w-[11rem] card p-2 space-y-0.5">
              {ownedGroups.map((g) => {
                const status = gameDexMap.get(g.id);
                if (!status || status === 'missing') return null;
                return (
                  <button
                    key={g.id}
                    type="button"
                    className="w-full text-left px-3 py-1.5 rounded text-sm hover:bg-bg-hover"
                    onClick={() => { setMoveToStorageGameId(g.id); setMoveToStorageOpen(false); }}
                  >
                    {g.short}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Evolved Into */}
      {ownedGroups.length > 0 && (
        <div className="relative">
          <button
            type="button"
            className="btn text-sm"
            onClick={() => { setEvolutionOpen((x) => !x); setGameDexStatusOpen(false); setHuntOpen(false); setTeamOpen(false); setMoveToStorageOpen(false); }}
          >
            ⚡ Evolved Into
          </button>
          {evolutionOpen && (
            <div className="absolute mt-1 z-20 min-w-[11rem] card p-2 space-y-0.5">
              {ownedGroups.map((g) => {
                const status = gameDexMap.get(g.id);
                if (!status || status === 'missing') return null;
                return (
                  <button
                    key={g.id}
                    type="button"
                    className="w-full text-left px-3 py-1.5 rounded text-sm hover:bg-bg-hover"
                    onClick={() => { setEvolutionGameId(g.id); setEvolutionOpen(false); }}
                  >
                    {g.short}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Start Hunt */}
      {ownedGroups.length > 0 && (
        <div className="relative">
          <button
            type="button"
            className="btn text-sm"
            onClick={() => { setHuntOpen((x) => !x); setGameDexStatusOpen(false); setTeamOpen(false); }}
          >
            ✨ Hunt
          </button>
          {huntOpen && (
            <div className="absolute mt-1 z-20 w-52 card p-3 space-y-3">
              <div>
                <label className="text-xs text-muted block mb-1">Game</label>
                <select
                  className="input w-full text-sm"
                  value={huntGameId}
                  onChange={(e) => setHuntGameId(e.target.value)}
                >
                  {ownedGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.short}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Method</label>
                <select
                  className="input w-full text-sm"
                  value={huntMethod}
                  onChange={(e) => setHuntMethod(e.target.value)}
                >
                  {HUNT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn btn-primary text-sm w-full"
                onClick={handleStartHunt}
              >
                Start Hunt
              </button>
            </div>
          )}
        </div>
      )}

      {/* + Team */}
      <AddToTeam
        pokemonId={pokemonId}
        pokemonName={pokemonName}
        open={teamOpen}
        setOpen={(v) => { setTeamOpen(v); if (v) { setGameDexStatusOpen(false); setHuntOpen(false); } }}
      />

      {/* Favorite */}
      <button
        type="button"
        className={clsx('btn text-sm', fav && 'text-yellow-300 border-yellow-300/50')}
        onClick={() => toggleFavorite(pokemonId, pokemonName)}
        title={fav ? 'Remove from favorites' : 'Add to favorites'}
      >
        {fav ? '★ Favorited' : '☆ Favorite'}
      </button>

      {/* Move to Storage Modal */}
      {moveToStorageGameId && (
        <MoveToStorageModal
          pokemonId={pokemonId}
          pokemonName={pokemonName}
          gameGroupId={moveToStorageGameId}
          gameGroupName={ownedGroups.find((g) => g.id === moveToStorageGameId)?.label ?? ''}
          onClose={() => setMoveToStorageGameId('')}
          onMoveComplete={() => {
            refetchGameDexes();
            setMoveToStorageGameId('');
          }}
        />
      )}

      {/* Evolution Modal */}
      {evolutionGameId && speciesData?.evolution_chain && (
        <EvolutionChainModal
          pokemonId={pokemonId}
          pokemonName={pokemonName}
          gameGroupId={evolutionGameId}
          speciesUrl={speciesData.evolution_chain.url}
          onClose={() => setEvolutionGameId('')}
          onEvolved={() => {
            refetchGameDexes();
            setEvolutionGameId('');
          }}
        />
      )}
    </div>
  );
}

// --- Alternate forms strip ---------------------------------------------------

function AlternateFormsStrip({
  species,
  currentId,
}: {
  species: { varieties: { is_default: boolean; pokemon: { name: string } }[] };
  currentId: number;
}) {
  const variants = species.varieties
    .filter((v) => !v.is_default)
    .map((v) => ({ slug: v.pokemon.name, info: classifyVariety(v.pokemon.name) }))
    .filter((v): v is { slug: string; info: { kind: string; label: string } } => v.info != null);

  if (variants.length === 0) return null;

  const battleForms = variants.filter((v) =>
    ['mega', 'gmax', 'primal', 'origin', 'special'].includes(v.info.kind),
  );
  const regionalForms = variants.filter((v) => v.info.kind === 'regional');

  return (
    <div className="card p-5 space-y-4">
      {battleForms.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
            Battle / Alternate Forms
          </h2>
          <div className="flex flex-wrap gap-3">
            {battleForms.map((v) => (
              <VarietyCard
                key={v.slug}
                slug={v.slug}
                kind={v.info.kind}
                label={v.info.label}
                currentId={currentId}
              />
            ))}
          </div>
        </div>
      )}
      {regionalForms.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
            Regional Forms
          </h2>
          <div className="flex flex-wrap gap-3">
            {regionalForms.map((v) => (
              <VarietyCard
                key={v.slug}
                slug={v.slug}
                kind={v.info.kind}
                label={v.info.label}
                currentId={currentId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Small primitives -------------------------------------------------------

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={clsx('text-xs font-semibold uppercase tracking-wider text-muted mb-3', className)}>
      {children}
    </h2>
  );
}

// Inline value that fades in as data arrives. Keeps an em-dash placeholder
// while still un-shown so the row doesn't collapse to 0 width.
function FadeValue({ shown, children }: { shown: boolean; children: React.ReactNode }) {
  return (
    <span
      className="transition-opacity duration-300 ease-out inline-block"
      style={{ opacity: shown ? 1 : 0.25 }}
    >
      {children}
    </span>
  );
}

function Row({
  label,
  tip,
  children,
}: {
  label: string;
  tip?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-baseline gap-4 text-sm">
      <span className="text-muted inline-flex items-center gap-1.5">
        {label}
        {tip && <InfoTip text={tip} />}
      </span>
      <span className="font-medium text-right">{children}</span>
    </div>
  );
}

