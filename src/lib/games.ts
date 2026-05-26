// Shared game group definitions — used by Settings and CatchTracker.

export interface GameGroup {
  id: string;
  label: string;
  /** Short abbreviation for compact UI (tabs, etc.). */
  short: string;
  /** PokeAPI version slugs included in this group. */
  versions: string[];
}

export const GAME_GROUPS: GameGroup[] = [
  { id: 'rby',   label: 'Red / Blue / Yellow',              short: 'R/B/Y',   versions: ['red', 'blue', 'yellow'] },
  { id: 'gsc',   label: 'Gold / Silver / Crystal',          short: 'G/S/C',   versions: ['gold', 'silver', 'crystal'] },
  { id: 'rse',   label: 'Ruby / Sapphire / Emerald',        short: 'R/S/E',   versions: ['ruby', 'sapphire', 'emerald'] },
  { id: 'frlg',  label: 'FireRed / LeafGreen',              short: 'FR/LG',   versions: ['firered', 'leafgreen'] },
  { id: 'dppt',  label: 'Diamond / Pearl / Platinum',       short: 'D/P/Pt',  versions: ['diamond', 'pearl', 'platinum'] },
  { id: 'hgss',  label: 'HeartGold / SoulSilver',           short: 'HG/SS',   versions: ['heartgold', 'soulsilver'] },
  { id: 'bw',    label: 'Black / White',                    short: 'B/W',     versions: ['black', 'white'] },
  { id: 'b2w2',  label: 'Black 2 / White 2',               short: 'B2/W2',   versions: ['black-2', 'white-2'] },
  { id: 'xy',    label: 'X / Y',                            short: 'X/Y',     versions: ['x', 'y'] },
  { id: 'oras',  label: 'Omega Ruby / Alpha Sapphire',      short: 'OR/AS',   versions: ['omega-ruby', 'alpha-sapphire'] },
  { id: 'sm',    label: 'Sun / Moon',                       short: 'S/M',     versions: ['sun', 'moon'] },
  { id: 'usum',  label: 'Ultra Sun / Ultra Moon',           short: 'US/UM',   versions: ['ultra-sun', 'ultra-moon'] },
  { id: 'lgpe',  label: "Let's Go Pikachu / Eevee",         short: 'LGP/E',   versions: ['lets-go-pikachu', 'lets-go-eevee'] },
  { id: 'swsh',  label: 'Sword / Shield',                   short: 'Sw/Sh',   versions: ['sword', 'shield'] },
  { id: 'bdsp',  label: 'Brilliant Diamond / Shining Pearl',short: 'BD/SP',   versions: ['brilliant-diamond', 'shining-pearl'] },
  { id: 'pla',   label: 'Legends: Arceus',                  short: 'LA',      versions: ['legends-arceus'] },
  { id: 'sv',    label: 'Scarlet / Violet',                  short: 'S/V',     versions: ['scarlet', 'violet'] },
];
