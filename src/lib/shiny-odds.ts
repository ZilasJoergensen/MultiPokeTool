// Shiny odds and hunting method definitions.
// All rates are per individual encounter/hatch/reset.
// Gen 6+ base rates are used; Gen 1-5 rates are roughly half.

export interface HuntMethod {
  id: string;
  label: string;
  description: string;
  /** Odds per roll, optionally adjusted by charm. */
  odds: (shinyCharm: boolean) => number;
  /** Whether this method counts "encounters", "eggs", or "resets". */
  unit: 'encounters' | 'eggs' | 'resets';
}

export const HUNT_METHODS: HuntMethod[] = [
  {
    id: 'random',
    label: 'Random encounters',
    description: 'Standard wild Pokémon encounters',
    odds: (charm) => (charm ? 3 : 1) / 4096,
    unit: 'encounters',
  },
  {
    id: 'reset',
    label: 'Soft resets',
    description: 'Resetting for legendaries, starters or gift Pokémon',
    odds: (charm) => (charm ? 3 : 1) / 4096,
    unit: 'resets',
  },
  {
    id: 'masuda',
    label: 'Masuda Method',
    description: 'Breeding two Pokémon from different-language games',
    odds: (charm) => (charm ? 8 : 6) / 4096,
    unit: 'eggs',
  },
  {
    id: 'egg',
    label: 'Egg hatching (same-language)',
    description: 'Hatching eggs from same-language parents',
    odds: (charm) => (charm ? 3 : 1) / 4096,
    unit: 'eggs',
  },
  {
    id: 'outbreak',
    label: 'Mass outbreak',
    description: 'Gen 8/9 mass outbreaks (3 rolls)',
    odds: (charm) => (charm ? 5 : 3) / 4096,
    unit: 'encounters',
  },
  {
    id: 'outbreak_sandwich',
    label: 'Outbreak + Sparkling Power',
    description: 'SV: mass outbreak with Sparkling Power Lv.3 sandwich',
    odds: (charm) => (charm ? 8 : 6) / 4096,
    unit: 'encounters',
  },
  {
    id: 'radar',
    label: 'Pokéradar chain',
    description: 'Gen 4 Pokéradar chain of 40+',
    odds: () => 1 / 200,
    unit: 'encounters',
  },
  {
    id: 'sos',
    label: 'SOS chaining',
    description: 'Gen 7 SOS chaining (70+ allies)',
    odds: (charm) => (charm ? 12 : 9) / 4096,
    unit: 'encounters',
  },
  {
    id: 'other',
    label: 'Other method',
    description: 'Custom or unspecified hunting method',
    odds: (charm) => (charm ? 3 : 1) / 4096,
    unit: 'encounters',
  },
];

export function getMethod(id: string): HuntMethod {
  return HUNT_METHODS.find((m) => m.id === id) ?? HUNT_METHODS[0];
}

/** Format odds as "1 in X" string. */
export function formatOdds(p: number): string {
  return `1 in ${Math.round(1 / p).toLocaleString()}`;
}

/**
 * Probability of having found the shiny by encounter N.
 * P(X ≤ n) = 1 − (1 − p)^n
 */
export function cumulativeProbability(p: number, n: number): number {
  if (n <= 0) return 0;
  return 1 - Math.pow(1 - p, n);
}

/** Expected number of encounters to find the shiny (mean of geometric dist). */
export function expectedEncounters(p: number): number {
  return Math.round(1 / p);
}
