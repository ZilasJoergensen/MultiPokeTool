/**
 * Goal templates for each game group.
 * These are the "default" goals a user sees when they first open Game Completion
 * for a given game. After first load they're persisted to IndexedDB so the user
 * can personalise them (toggle included, mark completed, add custom goals).
 *
 * Design rules:
 *  - No step-by-step walkthrough goals (no "Beat Brock", "Catch first Pokémon").
 *  - Only goals that signify meaningful completion: Champion, Pokédex, Legendaries,
 *    Trainer Card stars, Postgame systems, hardcore challenges.
 *  - Event/Mythical goals default to includedByDefault: false because they are
 *    not realistically obtainable today without trading or cheating.
 *  - Link-cable / multiplayer goals default to includedByDefault: false.
 */

export type GoalDifficulty = 'core' | 'postgame' | 'hardcore' | 'event' | 'custom';

export interface GoalTemplate {
  /** ID relative to the game — the full key will be `${gameId}:${relId}`. */
  relId: string;
  category: string;
  title: string;
  description?: string;
  difficulty: GoalDifficulty;
  /** Whether this goal counts toward the completion % by default. */
  includedByDefault: boolean;
  progressTarget?: number;
  linkedPokemonIds?: number[];
}

// ---------------------------------------------------------------------------
// Category constants
// ---------------------------------------------------------------------------

const CAT = {
  core:     'Core Completion',
  pokedex:  'Pokédex Completion',
  legend:   'Legendary Pokémon',
  postgame: 'Postgame & Side Content',
  trainer:  'Trainer Card / Achievements',
  hardcore: 'Optional Hardcore Goals',
  event:    'Event / Mythical Goals',
} as const;

// ---------------------------------------------------------------------------
// Red / Blue / Yellow
// ---------------------------------------------------------------------------

const rby: GoalTemplate[] = [
  { relId: 'champion',          category: CAT.core,     title: 'Become Pokémon Champion',              difficulty: 'core',     includedByDefault: true },
  { relId: 'pokedex-kanto',     category: CAT.pokedex,  title: 'Complete the Kanto Pokédex',           description: 'See all 151 Pokémon in the Kanto Pokédex.', difficulty: 'core', includedByDefault: true },
  { relId: 'legendary-articuno',category: CAT.legend,   title: 'Catch Articuno',                       difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [144] },
  { relId: 'legendary-zapdos',  category: CAT.legend,   title: 'Catch Zapdos',                         difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [145] },
  { relId: 'legendary-moltres', category: CAT.legend,   title: 'Catch Moltres',                        difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [146] },
  { relId: 'legendary-mewtwo',  category: CAT.legend,   title: 'Catch Mewtwo',                         difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [150] },
  { relId: 'event-mew',         category: CAT.event,    title: 'Obtain Mew (event)',                    description: 'Not obtainable through normal play.', difficulty: 'event', includedByDefault: false, linkedPokemonIds: [151] },
  { relId: 'ingame-trades',     category: CAT.postgame, title: 'Complete all in-game trades',           difficulty: 'postgame', includedByDefault: true },
  { relId: 'fossil-pokemon',    category: CAT.postgame, title: 'Revive both fossil Pokémon',            difficulty: 'postgame', includedByDefault: true },
  { relId: 'safari-zone',       category: CAT.hardcore, title: 'Catch all Safari Zone Pokémon',        difficulty: 'hardcore', includedByDefault: false },
  { relId: 'level100-team',     category: CAT.hardcore, title: 'Build a full Level 100 team',           difficulty: 'hardcore', includedByDefault: false },
];

// ---------------------------------------------------------------------------
// Gold / Silver / Crystal
// ---------------------------------------------------------------------------

const gsc: GoalTemplate[] = [
  { relId: 'champion-johto',    category: CAT.core,     title: 'Become Johto Champion',                difficulty: 'core',     includedByDefault: true },
  { relId: 'gyms-kanto',        category: CAT.core,     title: 'Defeat all Kanto Gym Leaders',         difficulty: 'core',     includedByDefault: true },
  { relId: 'defeat-red',        category: CAT.postgame, title: 'Defeat Red on Mt. Silver',             difficulty: 'postgame', includedByDefault: true },
  { relId: 'radio-tower',       category: CAT.core,     title: 'Liberate the Goldenrod Radio Tower',   difficulty: 'core',     includedByDefault: true },
  { relId: 'pokedex-johto',     category: CAT.pokedex,  title: 'Complete the Johto Pokédex',           difficulty: 'core',     includedByDefault: true },
  { relId: 'legendary-lugia',   category: CAT.legend,   title: 'Catch Lugia',                          difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [249] },
  { relId: 'legendary-hooh',    category: CAT.legend,   title: 'Catch Ho-Oh',                          difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [250] },
  { relId: 'legendary-raikou',  category: CAT.legend,   title: 'Catch Raikou (roaming)',               difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [243] },
  { relId: 'legendary-entei',   category: CAT.legend,   title: 'Catch Entei (roaming)',                difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [244] },
  { relId: 'legendary-suicune', category: CAT.legend,   title: 'Catch Suicune',                        difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [245] },
  { relId: 'event-celebi',      category: CAT.event,    title: 'Obtain Celebi (event)',                difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [251] },
  { relId: 'bug-contest',       category: CAT.postgame, title: 'Win the National Park Bug Catching Contest', difficulty: 'postgame', includedByDefault: false },
  { relId: 'ingame-trades',     category: CAT.postgame, title: 'Complete all in-game trades',          difficulty: 'postgame', includedByDefault: false },
  { relId: 'level100-team',     category: CAT.hardcore, title: 'Build a full Level 100 team',          difficulty: 'hardcore', includedByDefault: false },
];

// ---------------------------------------------------------------------------
// Ruby / Sapphire / Emerald
// ---------------------------------------------------------------------------

const rse: GoalTemplate[] = [
  { relId: 'champion',              category: CAT.core,     title: 'Become Hoenn Champion',                      difficulty: 'core',     includedByDefault: true },
  { relId: 'pokedex-hoenn',         category: CAT.pokedex,  title: 'Complete the Hoenn Pokédex',                 difficulty: 'core',     includedByDefault: true },
  { relId: 'legendary-kyogre',      category: CAT.legend,   title: 'Catch Kyogre',                               description: 'Sapphire / Emerald only.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [382] },
  { relId: 'legendary-groudon',     category: CAT.legend,   title: 'Catch Groudon',                              description: 'Ruby / Emerald only.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [383] },
  { relId: 'legendary-rayquaza',    category: CAT.legend,   title: 'Catch Rayquaza',                             difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [384] },
  { relId: 'legendary-regis',       category: CAT.legend,   title: 'Catch the three Regis',                      description: 'Regirock, Regice, Registeel.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [377, 378, 379] },
  { relId: 'legendary-lati',        category: CAT.legend,   title: 'Catch Latias / Latios (roaming)',            difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [380, 381] },
  { relId: 'event-jirachi',         category: CAT.event,    title: 'Obtain Jirachi (event)',                      difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [385] },
  { relId: 'event-deoxys',          category: CAT.event,    title: 'Obtain Deoxys (event/Birth Island)',          difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [386] },
  { relId: 'battle-frontier',       category: CAT.hardcore, title: 'Earn all Battle Frontier symbols (Emerald)', difficulty: 'hardcore', includedByDefault: false },
  { relId: 'secret-base',           category: CAT.postgame, title: 'Fully upgrade Secret Base',                  difficulty: 'postgame', includedByDefault: false },
  { relId: 'contest-master',        category: CAT.postgame, title: 'Win all five Master-Rank Contests',          difficulty: 'hardcore', includedByDefault: false },
];

// ---------------------------------------------------------------------------
// FireRed / LeafGreen  (most detailed — reference implementation)
// ---------------------------------------------------------------------------

const frlg: GoalTemplate[] = [
  // Core Completion
  { relId: 'champion',        category: CAT.core, title: 'Become Pokémon Champion',
    description: 'Defeat the Elite Four and your rival at Indigo Plateau.',
    difficulty: 'core', includedByDefault: true },
  { relId: 'sevii-islands',   category: CAT.core, title: 'Complete Sevii Islands Postgame',
    description: "Finish the Sevii Islands quest and help Celio restore the Pokémon Network Machine.",
    difficulty: 'postgame', includedByDefault: true },
  { relId: 'national-dex',    category: CAT.core, title: 'Unlock National Pokédex',
    description: 'Obtain the National Pokédex upgrade from Professor Oak after seeing all 150 Kanto Pokémon.',
    difficulty: 'core', includedByDefault: true },

  // Pokédex Completion
  { relId: 'pokedex-kanto',   category: CAT.pokedex, title: 'Complete the Kanto Pokédex',
    description: 'See or catch all 150 original Kanto Pokémon.',
    difficulty: 'core', includedByDefault: true },
  { relId: 'living-kanto',    category: CAT.pokedex, title: 'Complete Kanto Living Dex',
    description: 'Have one of every Kanto Pokémon simultaneously in your boxes.',
    difficulty: 'hardcore', includedByDefault: false },
  { relId: 'pokedex-national',category: CAT.pokedex, title: 'Complete National Pokédex',
    description: 'Obtain data for all Pokémon in the National Pokédex.',
    difficulty: 'hardcore', includedByDefault: false },
  { relId: 'living-national', category: CAT.pokedex, title: 'Complete National Living Dex',
    description: 'Have one of every Pokémon simultaneously in your boxes.',
    difficulty: 'hardcore', includedByDefault: false },

  // Legendary Pokémon
  { relId: 'legendary-articuno', category: CAT.legend, title: 'Catch Articuno', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [144] },
  { relId: 'legendary-zapdos',   category: CAT.legend, title: 'Catch Zapdos',   difficulty: 'core', includedByDefault: true, linkedPokemonIds: [145] },
  { relId: 'legendary-moltres',  category: CAT.legend, title: 'Catch Moltres',  difficulty: 'core', includedByDefault: true, linkedPokemonIds: [146] },
  { relId: 'legendary-mewtwo',   category: CAT.legend, title: 'Catch Mewtwo',   difficulty: 'core', includedByDefault: true, linkedPokemonIds: [150] },
  { relId: 'legendary-beast',    category: CAT.legend, title: 'Catch Roaming Legendary Beast',
    description: 'Catch the roaming legendary (Raikou, Entei, or Suicune) that wanders Kanto after defeating the Elite Four.',
    difficulty: 'core', includedByDefault: true, linkedPokemonIds: [243, 244, 245] },

  // Event / Mythical Goals
  { relId: 'event-mew',    category: CAT.event, title: 'Obtain Mew (event)',
    description: 'Not realistically available through normal play today.', difficulty: 'event', includedByDefault: false, linkedPokemonIds: [151] },
  { relId: 'event-deoxys', category: CAT.event, title: 'Obtain Deoxys (Aurora Ticket event)',
    description: 'Requires Aurora Ticket event item to access Birth Island.', difficulty: 'event', includedByDefault: false, linkedPokemonIds: [386] },

  // Postgame & Side Content
  { relId: 'fossil-pokemon',  category: CAT.postgame, title: 'Obtain both Fossil Pokémon',
    description: 'Revive both the Dome Fossil and Helix Fossil Pokémon (requires trading between FR and LG).', difficulty: 'core', includedByDefault: true },
  { relId: 'ingame-trades',   category: CAT.postgame, title: 'Complete all in-game trades',    difficulty: 'postgame', includedByDefault: true },
  { relId: 'fame-checker',    category: CAT.postgame, title: 'Complete the Fame Checker',
    description: 'Collect all Famous Person entries.', difficulty: 'postgame', includedByDefault: false },
  { relId: 'key-items',       category: CAT.postgame, title: 'Obtain all key items',           difficulty: 'postgame', includedByDefault: false },

  // Trainer Card / Achievements
  { relId: 'star-hof',        category: CAT.trainer, title: 'Trainer Card ★: Enter Hall of Fame',                      difficulty: 'core',     includedByDefault: true },
  { relId: 'star-nat-dex',    category: CAT.trainer, title: 'Trainer Card ★: Complete National Pokédex',              difficulty: 'hardcore', includedByDefault: false },
  { relId: 'star-link-cable', category: CAT.trainer, title: 'Trainer Card ★: Win 200 Link Cable Battles',
    description: 'Requires a second player. Not realistic for most players today.', difficulty: 'hardcore', includedByDefault: false },
  { relId: 'star-minigame',   category: CAT.trainer, title: 'Trainer Card ★: Complete Union Room Minigame',
    description: 'Achieve the required score in Jump Game or Dodrio Berry Picking.', difficulty: 'hardcore', includedByDefault: false },

  // Optional Hardcore Goals
  { relId: 'trainer-tower',   category: CAT.hardcore, title: 'Clear all Trainer Tower modes',
    description: 'Complete Single, Double, Knockout, and Mixed battle modes in Trainer Tower on Seven Island.', difficulty: 'hardcore', includedByDefault: false },
  { relId: 'lorelei-dolls',   category: CAT.hardcore, title: "Fill Lorelei's house with dolls",
    description: "Obtain all the dolls for Lorelei's room on Four Island.", difficulty: 'hardcore', includedByDefault: false },
  { relId: 'gift-pokemon',    category: CAT.hardcore, title: 'Obtain all gift Pokémon',
    description: 'Collect all Pokémon gifted by NPCs in Kanto and the Sevii Islands.', difficulty: 'hardcore', includedByDefault: false },
  { relId: 'version-exclusives', category: CAT.hardcore, title: 'Obtain all version exclusives via trade',
    description: 'Trade for every version-exclusive Pokémon between FireRed and LeafGreen.', difficulty: 'hardcore', includedByDefault: false },
  { relId: 'shiny-legendary', category: CAT.hardcore, title: 'Shiny hunt a legendary Pokémon',  difficulty: 'hardcore', includedByDefault: false },
  { relId: 'level100-team',   category: CAT.hardcore, title: 'Build a final Level 100 team',    difficulty: 'hardcore', includedByDefault: false },
];

// ---------------------------------------------------------------------------
// Diamond / Pearl / Platinum
// ---------------------------------------------------------------------------

const dppt: GoalTemplate[] = [
  { relId: 'champion',            category: CAT.core,     title: 'Become Sinnoh Champion',             difficulty: 'core',     includedByDefault: true },
  { relId: 'pokedex-sinnoh',      category: CAT.pokedex,  title: 'Complete the Sinnoh Pokédex',        difficulty: 'core',     includedByDefault: true },
  { relId: 'legendary-dialga',    category: CAT.legend,   title: 'Catch Dialga',                       description: 'Diamond / Platinum only.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [483] },
  { relId: 'legendary-palkia',    category: CAT.legend,   title: 'Catch Palkia',                       description: 'Pearl / Platinum only.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [484] },
  { relId: 'legendary-giratina',  category: CAT.legend,   title: 'Catch Giratina',                     difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [487] },
  { relId: 'legendary-lake-trio', category: CAT.legend,   title: 'Catch the Lake Trio',                description: 'Uxie, Mesprit, Azelf.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [480, 481, 482] },
  { relId: 'legendary-heatran',   category: CAT.legend,   title: 'Catch Heatran',                      difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [485] },
  { relId: 'legendary-regigigas', category: CAT.legend,   title: 'Catch Regigigas',                    difficulty: 'postgame', includedByDefault: true,  linkedPokemonIds: [486] },
  { relId: 'legendary-cresselia', category: CAT.legend,   title: 'Catch Cresselia (roaming)',          difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [488] },
  { relId: 'event-manaphy',       category: CAT.event,    title: 'Obtain Manaphy (Ranger mission)',     difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [490] },
  { relId: 'event-darkrai',       category: CAT.event,    title: 'Obtain Darkrai (Member Card event)',  difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [491] },
  { relId: 'event-shaymin',       category: CAT.event,    title: 'Obtain Shaymin (Oak\'s Letter event)',difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [492] },
  { relId: 'event-arceus',        category: CAT.event,    title: 'Obtain Arceus (Azure Flute event)',   difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [493] },
  { relId: 'battle-frontier',     category: CAT.hardcore, title: 'Earn all Battle Frontier symbols (Platinum)', difficulty: 'hardcore', includedByDefault: false },
  { relId: 'underground',         category: CAT.postgame, title: 'Collect all fossils in the Underground', difficulty: 'hardcore', includedByDefault: false },
];

// ---------------------------------------------------------------------------
// HeartGold / SoulSilver
// ---------------------------------------------------------------------------

const hgss: GoalTemplate[] = [
  { relId: 'champion-johto',    category: CAT.core,     title: 'Become Johto Champion',                difficulty: 'core',     includedByDefault: true },
  { relId: 'gyms-kanto',        category: CAT.core,     title: 'Defeat all Kanto Gym Leaders',         difficulty: 'core',     includedByDefault: true },
  { relId: 'defeat-red',        category: CAT.postgame, title: 'Defeat Red on Mt. Silver',             difficulty: 'postgame', includedByDefault: true },
  { relId: 'radio-tower',       category: CAT.core,     title: 'Liberate the Goldenrod Radio Tower',   difficulty: 'core',     includedByDefault: true },
  { relId: 'pokedex-johto',     category: CAT.pokedex,  title: 'Complete the Johto Pokédex',           difficulty: 'core',     includedByDefault: true },
  { relId: 'legendary-lugia',   category: CAT.legend,   title: 'Catch Lugia',                          difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [249] },
  { relId: 'legendary-hooh',    category: CAT.legend,   title: 'Catch Ho-Oh',                          difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [250] },
  { relId: 'legendary-beasts',  category: CAT.legend,   title: 'Catch all three roaming Legendary Beasts', description: 'Raikou, Entei, Suicune.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [243, 244, 245] },
  { relId: 'event-celebi',      category: CAT.event,    title: 'Obtain Celebi (event)',                difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [251] },
  { relId: 'pokeathlon',        category: CAT.postgame, title: 'Win all Pokéathlon events',            difficulty: 'postgame', includedByDefault: false },
  { relId: 'apricorn-balls',    category: CAT.postgame, title: 'Collect all Apricorn Balls',           difficulty: 'postgame', includedByDefault: true },
  { relId: 'battle-frontier',   category: CAT.hardcore, title: 'Earn all Battle Frontier symbols',     difficulty: 'hardcore', includedByDefault: false },
  { relId: 'pokegear-numbers',  category: CAT.hardcore, title: 'Collect all Pokégear phone numbers',   difficulty: 'hardcore', includedByDefault: false },
];

// ---------------------------------------------------------------------------
// Black / White
// ---------------------------------------------------------------------------

const bw: GoalTemplate[] = [
  { relId: 'champion',          category: CAT.core,     title: 'Become Unova Champion',                difficulty: 'core',     includedByDefault: true },
  { relId: 'defeat-n-ghetsis', category: CAT.core,     title: 'Defeat N and Ghetsis',                 difficulty: 'core',     includedByDefault: true },
  { relId: 'pokedex-unova',     category: CAT.pokedex,  title: 'Complete the Unova Pokédex',           difficulty: 'core',     includedByDefault: true },
  { relId: 'legendary-reshiram',category: CAT.legend,   title: 'Catch Reshiram',                       description: 'White only.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [643] },
  { relId: 'legendary-zekrom',  category: CAT.legend,   title: 'Catch Zekrom',                         description: 'Black only.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [644] },
  { relId: 'legendary-kyurem',  category: CAT.legend,   title: 'Catch Kyurem',                         difficulty: 'postgame', includedByDefault: true,  linkedPokemonIds: [646] },
  { relId: 'legendary-justice', category: CAT.legend,   title: 'Catch the Swords of Justice',          description: 'Cobalion, Terrakion, Virizion.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [638, 639, 640] },
  { relId: 'legendary-forces',  category: CAT.legend,   title: 'Catch the Forces of Nature (roaming)', description: 'Tornadus (Black) or Thundurus (White) roams; Landorus requires both.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [641, 642, 645] },
  { relId: 'event-victini',     category: CAT.event,    title: 'Obtain Victini (Liberty Pass event)',   difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [494] },
  { relId: 'event-keldeo',      category: CAT.event,    title: 'Obtain Keldeo (event)',                 difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [647] },
  { relId: 'event-meloetta',    category: CAT.event,    title: 'Obtain Meloetta (event)',               difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [648] },
  { relId: 'event-genesect',    category: CAT.event,    title: 'Obtain Genesect (event)',               difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [649] },
  { relId: 'battle-subway',     category: CAT.hardcore, title: 'Win 21+ consecutive battles in Battle Subway', difficulty: 'hardcore', includedByDefault: false },
  { relId: 'musicals',          category: CAT.hardcore, title: 'Complete all Pokémon Musicals',         difficulty: 'hardcore', includedByDefault: false },
];

// ---------------------------------------------------------------------------
// Black 2 / White 2
// ---------------------------------------------------------------------------

const b2w2: GoalTemplate[] = [
  { relId: 'champion',            category: CAT.core,     title: 'Become Unova Champion',                        difficulty: 'core',     includedByDefault: true },
  { relId: 'pokedex-unova',       category: CAT.pokedex,  title: 'Complete the Unova Pokédex',                   difficulty: 'core',     includedByDefault: true },
  { relId: 'legendary-kyurem',    category: CAT.legend,   title: 'Catch Kyurem (Black or White forme)',          difficulty: 'core',     includedByDefault: true, linkedPokemonIds: [646] },
  { relId: 'legendary-justice',   category: CAT.legend,   title: 'Catch the Swords of Justice',                  description: 'Cobalion, Terrakion, Virizion.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [638, 639, 640] },
  { relId: 'legendary-lati',      category: CAT.legend,   title: 'Catch Latias / Latios (Strange House)',        description: 'Latias in White 2, Latios in Black 2.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [380, 381] },
  { relId: 'legendary-regis',     category: CAT.legend,   title: 'Catch the three Regis',                        difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [377, 378, 379] },
  { relId: 'legendary-regigigas', category: CAT.legend,   title: 'Catch Regigigas',                              difficulty: 'postgame', includedByDefault: true,  linkedPokemonIds: [486] },
  { relId: 'event-genesect',      category: CAT.event,    title: 'Obtain Genesect (event)',                       difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [649] },
  { relId: 'pokemon-world-tournament', category: CAT.postgame, title: 'Win the Pokémon World Tournament',        difficulty: 'postgame', includedByDefault: true },
  { relId: 'pokestar-studios',    category: CAT.hardcore, title: 'Complete all Pokéstar Studios films',          difficulty: 'hardcore', includedByDefault: false },
  { relId: 'medal-rally',         category: CAT.hardcore, title: 'Collect all Medals',                           difficulty: 'hardcore', includedByDefault: false },
];

// ---------------------------------------------------------------------------
// X / Y
// ---------------------------------------------------------------------------

const xy: GoalTemplate[] = [
  { relId: 'champion',          category: CAT.core,     title: 'Become Kalos Champion',                difficulty: 'core',     includedByDefault: true },
  { relId: 'pokedex-kalos',     category: CAT.pokedex,  title: 'Complete the Kalos Pokédex',           difficulty: 'core',     includedByDefault: true },
  { relId: 'legendary-xerneas', category: CAT.legend,   title: 'Catch Xerneas',                        description: 'X only.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [716] },
  { relId: 'legendary-yveltal', category: CAT.legend,   title: 'Catch Yveltal',                        description: 'Y only.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [717] },
  { relId: 'legendary-zygarde', category: CAT.legend,   title: 'Catch Zygarde',                        difficulty: 'postgame', includedByDefault: true,  linkedPokemonIds: [718] },
  { relId: 'legendary-mewtwo',  category: CAT.legend,   title: 'Catch Mewtwo',                         difficulty: 'postgame', includedByDefault: true,  linkedPokemonIds: [150] },
  { relId: 'legendary-bird',    category: CAT.legend,   title: 'Catch roaming Legendary Bird',          description: 'One of Articuno, Zapdos, or Moltres roams based on your starter.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [144, 145, 146] },
  { relId: 'event-diancie',     category: CAT.event,    title: 'Obtain Diancie (event)',                difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [719] },
  { relId: 'event-hoopa',       category: CAT.event,    title: 'Obtain Hoopa (event)',                  difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [720] },
  { relId: 'event-volcanion',   category: CAT.event,    title: 'Obtain Volcanion (event)',              difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [721] },
  { relId: 'mega-stones',       category: CAT.hardcore, title: 'Collect all Mega Stones',              difficulty: 'hardcore', includedByDefault: false },
  { relId: 'friend-safari',     category: CAT.hardcore, title: 'Fill out the Friend Safari',           difficulty: 'hardcore', includedByDefault: false },
];

// ---------------------------------------------------------------------------
// Omega Ruby / Alpha Sapphire
// ---------------------------------------------------------------------------

const oras: GoalTemplate[] = [
  { relId: 'champion',              category: CAT.core,     title: 'Become Hoenn Champion',                    difficulty: 'core',     includedByDefault: true },
  { relId: 'delta-episode',         category: CAT.core,     title: 'Complete the Delta Episode',               description: 'Complete the post-credits Delta Episode including catching Rayquaza and Deoxys.', difficulty: 'postgame', includedByDefault: true },
  { relId: 'pokedex-hoenn',         category: CAT.pokedex,  title: 'Complete the Hoenn Pokédex',               difficulty: 'core',     includedByDefault: true },
  { relId: 'legendary-kyogre',      category: CAT.legend,   title: 'Catch Kyogre',                             description: 'Alpha Sapphire only.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [382] },
  { relId: 'legendary-groudon',     category: CAT.legend,   title: 'Catch Groudon',                            description: 'Omega Ruby only.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [383] },
  { relId: 'legendary-rayquaza',    category: CAT.legend,   title: 'Catch Rayquaza',                           difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [384] },
  { relId: 'legendary-deoxys',      category: CAT.legend,   title: 'Catch Deoxys',                             description: 'Obtained during the Delta Episode.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [386] },
  { relId: 'legendary-regis',       category: CAT.legend,   title: 'Catch the three Regis',                    difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [377, 378, 379] },
  { relId: 'legendary-lati',        category: CAT.legend,   title: 'Catch Latias & Latios',                    difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [380, 381] },
  { relId: 'event-jirachi',         category: CAT.event,    title: 'Obtain Jirachi (event)',                    difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [385] },
  { relId: 'event-diancie',         category: CAT.event,    title: 'Obtain Diancie (event)',                    difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [719] },
  { relId: 'mirage-spots',          category: CAT.postgame, title: 'Visit all Mirage Spots',                    difficulty: 'hardcore', includedByDefault: false },
  { relId: 'contest-master',        category: CAT.hardcore, title: 'Win all Master-Rank Contests',             difficulty: 'hardcore', includedByDefault: false },
  { relId: 'battle-maison',         category: CAT.hardcore, title: 'Achieve 50-win streak in Battle Maison',   difficulty: 'hardcore', includedByDefault: false },
];

// ---------------------------------------------------------------------------
// Sun / Moon
// ---------------------------------------------------------------------------

const sm: GoalTemplate[] = [
  { relId: 'champion',            category: CAT.core,     title: 'Become Alola Champion',                  difficulty: 'core',     includedByDefault: true },
  { relId: 'island-challenge',    category: CAT.core,     title: 'Complete all Island Challenge Trials',   difficulty: 'core',     includedByDefault: true },
  { relId: 'pokedex-alola',       category: CAT.pokedex,  title: 'Complete the Alola Pokédex',             difficulty: 'core',     includedByDefault: true },
  { relId: 'legendary-solgaleo',  category: CAT.legend,   title: 'Catch Solgaleo',                         description: 'Sun only.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [791] },
  { relId: 'legendary-lunala',    category: CAT.legend,   title: 'Catch Lunala',                           description: 'Moon only.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [792] },
  { relId: 'legendary-necrozma',  category: CAT.legend,   title: 'Catch Necrozma',                         difficulty: 'postgame', includedByDefault: true,  linkedPokemonIds: [800] },
  { relId: 'legendary-tapus',     category: CAT.legend,   title: 'Catch all four Island Guardians (Tapus)', difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [785, 786, 787, 788] },
  { relId: 'ultra-beasts',        category: CAT.legend,   title: 'Catch all Ultra Beasts',                 difficulty: 'postgame', includedByDefault: true },
  { relId: 'event-marshadow',     category: CAT.event,    title: 'Obtain Marshadow (event)',                difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [802] },
  { relId: 'battle-tree',         category: CAT.hardcore, title: 'Achieve 50-win streak in Battle Tree',   difficulty: 'hardcore', includedByDefault: false },
  { relId: 'shiny-charm',         category: CAT.hardcore, title: 'Deposit 300 species for Shiny Charm',    difficulty: 'hardcore', includedByDefault: false },
];

// ---------------------------------------------------------------------------
// Ultra Sun / Ultra Moon
// ---------------------------------------------------------------------------

const usum: GoalTemplate[] = [
  { relId: 'champion',            category: CAT.core,     title: 'Become Alola Champion',                          difficulty: 'core',     includedByDefault: true },
  { relId: 'ultra-recon',         category: CAT.core,     title: 'Complete the Ultra Recon Squad storyline',       difficulty: 'core',     includedByDefault: true },
  { relId: 'rainbow-rocket',      category: CAT.postgame, title: 'Defeat Team Rainbow Rocket',                     difficulty: 'postgame', includedByDefault: true },
  { relId: 'pokedex-alola',       category: CAT.pokedex,  title: 'Complete the Alola Pokédex',                     difficulty: 'core',     includedByDefault: true },
  { relId: 'legendary-solgaleo',  category: CAT.legend,   title: 'Catch Solgaleo',                                 description: 'Ultra Sun only.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [791] },
  { relId: 'legendary-lunala',    category: CAT.legend,   title: 'Catch Lunala',                                   description: 'Ultra Moon only.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [792] },
  { relId: 'legendary-necrozma',  category: CAT.legend,   title: 'Catch Ultra Necrozma',                           difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [800] },
  { relId: 'legendary-tapus',     category: CAT.legend,   title: 'Catch all four Island Guardians (Tapus)',        difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [785, 786, 787, 788] },
  { relId: 'ultra-beasts',        category: CAT.legend,   title: 'Catch all Ultra Beasts',                         difficulty: 'postgame', includedByDefault: true },
  { relId: 'wormhole-legends',    category: CAT.hardcore, title: 'Catch all Legendary Pokémon via Ultra Wormholes', difficulty: 'hardcore', includedByDefault: false },
  { relId: 'event-marshadow',     category: CAT.event,    title: 'Obtain Marshadow (event)',                        difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [802] },
  { relId: 'event-zeraora',       category: CAT.event,    title: 'Obtain Zeraora (event)',                          difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [807] },
  { relId: 'mantine-surf',        category: CAT.hardcore, title: 'Achieve high score in Mantine Surf',             difficulty: 'hardcore', includedByDefault: false },
];

// ---------------------------------------------------------------------------
// Let's Go Pikachu / Eevee
// ---------------------------------------------------------------------------

const lgpe: GoalTemplate[] = [
  { relId: 'champion',              category: CAT.core,     title: 'Become Pokémon Champion',              difficulty: 'core',     includedByDefault: true },
  { relId: 'pokedex-kanto',         category: CAT.pokedex,  title: 'Complete the Kanto Pokédex',           difficulty: 'core',     includedByDefault: true },
  { relId: 'legendary-articuno',    category: CAT.legend,   title: 'Catch Articuno',                       difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [144] },
  { relId: 'legendary-zapdos',      category: CAT.legend,   title: 'Catch Zapdos',                         difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [145] },
  { relId: 'legendary-moltres',     category: CAT.legend,   title: 'Catch Moltres',                        difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [146] },
  { relId: 'legendary-mewtwo',      category: CAT.legend,   title: 'Catch Mewtwo',                         difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [150] },
  { relId: 'obtain-mew',            category: CAT.event,    title: 'Obtain Mew (Poké Ball Plus)',           description: 'Transfer Mew from a Poké Ball Plus device. Requires the physical accessory.', difficulty: 'event', includedByDefault: false, linkedPokemonIds: [151] },
  { relId: 'master-trainers',       category: CAT.hardcore, title: 'Defeat all 151 Master Trainers',       difficulty: 'hardcore', includedByDefault: false },
  { relId: 'no-damage-gym',         category: CAT.hardcore, title: 'Beat all gyms without taking damage',  difficulty: 'hardcore', includedByDefault: false },
];

// ---------------------------------------------------------------------------
// Sword / Shield
// ---------------------------------------------------------------------------

const swsh: GoalTemplate[] = [
  { relId: 'champion',            category: CAT.core,     title: 'Become Galar Champion',                        difficulty: 'core',     includedByDefault: true },
  { relId: 'postgame-story',      category: CAT.postgame, title: 'Complete the post-game story',                 description: 'Unlock and complete the Darkest Day story.', difficulty: 'postgame', includedByDefault: true },
  { relId: 'pokedex-galar',       category: CAT.pokedex,  title: 'Complete the Galar Pokédex',                   difficulty: 'core',     includedByDefault: true },
  { relId: 'legendary-zacian',    category: CAT.legend,   title: 'Catch Zacian',                                 description: 'Sword only.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [888] },
  { relId: 'legendary-zamazenta', category: CAT.legend,   title: 'Catch Zamazenta',                              description: 'Shield only.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [889] },
  { relId: 'legendary-eternatus', category: CAT.legend,   title: 'Catch Eternatus',                              difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [890] },
  { relId: 'dlc-isle-armor',      category: CAT.postgame, title: 'Complete the Isle of Armor DLC',               difficulty: 'postgame', includedByDefault: false },
  { relId: 'legendary-kubfu',     category: CAT.legend,   title: 'Catch Kubfu and Evolve to Urshifu (DLC)',      difficulty: 'postgame', includedByDefault: false, linkedPokemonIds: [891] },
  { relId: 'dlc-crown-tundra',    category: CAT.postgame, title: 'Complete the Crown Tundra DLC',                difficulty: 'postgame', includedByDefault: false },
  { relId: 'legendary-calyrex',   category: CAT.legend,   title: 'Catch Calyrex (Crown Tundra DLC)',             difficulty: 'postgame', includedByDefault: false, linkedPokemonIds: [898] },
  { relId: 'dynamax-adventures',  category: CAT.hardcore, title: 'Catch all Legendary Pokémon via Dynamax Adventures', difficulty: 'hardcore', includedByDefault: false },
  { relId: 'battle-tower',        category: CAT.hardcore, title: 'Reach Master Ball Tier in Battle Tower',       difficulty: 'hardcore', includedByDefault: false },
  { relId: 'gigantamax-forms',    category: CAT.hardcore, title: 'Catch all Gigantamax forms',                   difficulty: 'hardcore', includedByDefault: false },
];

// ---------------------------------------------------------------------------
// Brilliant Diamond / Shining Pearl
// ---------------------------------------------------------------------------

const bdsp: GoalTemplate[] = [
  { relId: 'champion',            category: CAT.core,     title: 'Become Sinnoh Champion',             difficulty: 'core',     includedByDefault: true },
  { relId: 'pokedex-sinnoh',      category: CAT.pokedex,  title: 'Complete the Sinnoh Pokédex',        difficulty: 'core',     includedByDefault: true },
  { relId: 'legendary-dialga',    category: CAT.legend,   title: 'Catch Dialga',                       description: 'Brilliant Diamond only.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [483] },
  { relId: 'legendary-palkia',    category: CAT.legend,   title: 'Catch Palkia',                       description: 'Shining Pearl only.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [484] },
  { relId: 'legendary-giratina',  category: CAT.legend,   title: 'Catch Giratina',                     difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [487] },
  { relId: 'legendary-lake-trio', category: CAT.legend,   title: 'Catch the Lake Trio',                description: 'Uxie, Mesprit, Azelf.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [480, 481, 482] },
  { relId: 'legendary-heatran',   category: CAT.legend,   title: 'Catch Heatran',                      difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [485] },
  { relId: 'legendary-regigigas', category: CAT.legend,   title: 'Catch Regigigas',                    difficulty: 'postgame', includedByDefault: true,  linkedPokemonIds: [486] },
  { relId: 'legendary-cresselia', category: CAT.legend,   title: 'Catch Cresselia (roaming)',          difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [488] },
  { relId: 'battle-tower',        category: CAT.hardcore, title: 'Reach Master Ball Tier in Battle Tower', difficulty: 'hardcore', includedByDefault: false },
  { relId: 'underground-biomes',  category: CAT.postgame, title: 'Explore all Grand Underground biomes', difficulty: 'postgame', includedByDefault: false },
  { relId: 'pokeradar-shiny',     category: CAT.hardcore, title: 'Achieve Poké Radar shiny chain of 40+', difficulty: 'hardcore', includedByDefault: false },
];

// ---------------------------------------------------------------------------
// Legends: Arceus
// ---------------------------------------------------------------------------

const pla: GoalTemplate[] = [
  { relId: 'credits',           category: CAT.core,     title: 'Complete the main story',                  description: 'Watch the ending credits after the final battle.', difficulty: 'core', includedByDefault: true },
  { relId: 'postgame-arceus',   category: CAT.postgame, title: 'Complete the post-game and catch Arceus',  difficulty: 'postgame', includedByDefault: true, linkedPokemonIds: [493] },
  { relId: 'pokedex-hisui',     category: CAT.pokedex,  title: 'Complete the Hisui Pokédex',               description: 'Fill out all Pokédex entries (complete at least one research task) for all 242 Pokémon.', difficulty: 'core', includedByDefault: true },
  { relId: 'research-level-10', category: CAT.pokedex,  title: 'Reach Research Level 10 for all Pokémon',  difficulty: 'hardcore', includedByDefault: false },
  { relId: 'perfect-pokedex',   category: CAT.pokedex,  title: 'Perfect all Pokédex entries',              description: 'Achieve perfect research score on every Pokémon.', difficulty: 'hardcore', includedByDefault: false },
  { relId: 'legendary-dialga',  category: CAT.legend,   title: 'Catch Origin Forme Dialga',                difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [483] },
  { relId: 'legendary-palkia',  category: CAT.legend,   title: 'Catch Origin Forme Palkia',                difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [484] },
  { relId: 'legendary-lake-trio',category: CAT.legend,  title: 'Catch the Lake Trio',                      description: 'Uxie, Mesprit, Azelf.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [480, 481, 482] },
  { relId: 'legendary-regis',   category: CAT.legend,   title: 'Catch the three Regis',                    difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [377, 378, 379] },
  { relId: 'legendary-heatran', category: CAT.legend,   title: 'Catch Heatran',                            difficulty: 'core',     includedByDefault: true,  linkedPokemonIds: [485] },
  { relId: 'legendary-shaymin', category: CAT.legend,   title: 'Catch Shaymin',                            difficulty: 'postgame', includedByDefault: true,  linkedPokemonIds: [492] },
  { relId: 'event-darkrai',     category: CAT.event,    title: 'Catch Darkrai (Mystery Gift)',               difficulty: 'event',    includedByDefault: false, linkedPokemonIds: [491] },
  { relId: 'all-requests',      category: CAT.hardcore, title: 'Complete all requests',                     description: 'Finish every NPC request in the game.', difficulty: 'hardcore', includedByDefault: false },
];

// ---------------------------------------------------------------------------
// Scarlet / Violet
// ---------------------------------------------------------------------------

const sv: GoalTemplate[] = [
  { relId: 'three-stories',     category: CAT.core,     title: 'Complete all three main storylines',       description: 'Victory Road, Path of Legends, and Starfall Street.', difficulty: 'core', includedByDefault: true },
  { relId: 'way-home',          category: CAT.core,     title: 'Complete The Way Home',                    description: 'Complete the final Area Zero story.', difficulty: 'core', includedByDefault: true },
  { relId: 'pokedex-paldea',    category: CAT.pokedex,  title: 'Complete the Paldea Pokédex',              difficulty: 'core',     includedByDefault: true },
  { relId: 'koraidon-miraidon', category: CAT.core,     title: 'Restore all of your ride Pokémon\'s powers', difficulty: 'core',   includedByDefault: true },
  { relId: 'legendary-ruinous', category: CAT.legend,   title: 'Catch the four Treasures of Ruin',         description: 'Wo-Chien, Chien-Pao, Ting-Lu, Chi-Yu.', difficulty: 'core', includedByDefault: true, linkedPokemonIds: [984, 985, 986, 987] },
  { relId: 'legendary-paradox', category: CAT.legend,   title: 'Catch all Paradox Pokémon',                difficulty: 'postgame', includedByDefault: true },
  { relId: 'dlc-teal-mask',     category: CAT.postgame, title: 'Complete The Teal Mask DLC',               difficulty: 'postgame', includedByDefault: false },
  { relId: 'dlc-indigo-disk',   category: CAT.postgame, title: 'Complete The Indigo Disk DLC',             difficulty: 'postgame', includedByDefault: false },
  { relId: 'ace-tournament',    category: CAT.postgame, title: 'Win the Academy Ace Tournament',           difficulty: 'postgame', includedByDefault: false },
  { relId: 'event-walking-wake',category: CAT.event,    title: 'Obtain Walking Wake / Iron Leaves (Tera Raid event)', difficulty: 'event', includedByDefault: false },
  { relId: 'tera-raid-six-star',category: CAT.hardcore, title: 'Complete a 6-star Tera Raid',              difficulty: 'hardcore', includedByDefault: false },
  { relId: 'battle-stadium',    category: CAT.hardcore, title: 'Reach Master Ball Rank in Battle Stadium', difficulty: 'hardcore', includedByDefault: false },
];

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const GOAL_TEMPLATES: Record<string, GoalTemplate[]> = {
  rby, gsc, rse, frlg, dppt, hgss, bw, b2w2, xy, oras, sm, usum, lgpe, swsh, bdsp, pla, sv,
};

/** Category display order — used to sort categories in the UI. */
export const CATEGORY_ORDER = [
  CAT.core,
  CAT.pokedex,
  CAT.legend,
  CAT.postgame,
  CAT.trainer,
  CAT.hardcore,
  CAT.event,
  'Custom Goals',
];
