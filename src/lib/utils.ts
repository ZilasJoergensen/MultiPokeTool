import type { TypeName } from './types-chart';
import type { FlavorTextEntry } from './api';

export function titleCase(s: string): string {
  return s
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function padId(id: number): string {
  return '#' + String(id).padStart(4, '0');
}

// Decimetres to metres (PokeAPI stores height in dm, weight in hg)
export function formatHeight(dm: number): string {
  const m = dm / 10;
  const totalInches = m * 39.3701;
  const ft = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${m.toFixed(1)} m  /  ${ft}'${inches}"`;
}

export function formatWeight(hg: number): string {
  const kg = hg / 10;
  const lbs = (kg * 2.20462).toFixed(1);
  return `${kg.toFixed(1)} kg  /  ${lbs} lbs`;
}

export function genderRatio(rate: number): string {
  if (rate === -1) return 'Genderless';
  const femalePct = (rate / 8) * 100;
  const malePct = 100 - femalePct;
  return `♂ ${malePct.toFixed(1)}%  ·  ♀ ${femalePct.toFixed(1)}%`;
}

export function hatchSteps(counter: number | null): string {
  if (counter == null) return '—';
  // Standard formula: (counter + 1) * 255 steps in gen 4+
  const steps = (counter + 1) * 255;
  return `${steps.toLocaleString()} steps`;
}

export function pickEnglish<T extends { language: { name: string } }>(
  entries: T[],
): T | undefined {
  return entries.find((e) => e.language.name === 'en');
}

export function bestFlavorText(entries: FlavorTextEntry[]): string {
  const english = entries.filter((e) => e.language.name === 'en');
  if (english.length === 0) return '';
  // Prefer the most recent game's entry
  const last = english[english.length - 1];
  return last.flavor_text.replace(/[\f\n\r]/g, ' ').trim();
}

export const STAT_LABELS: Record<string, string> = {
  hp: 'HP',
  attack: 'Atk',
  defense: 'Def',
  'special-attack': 'Sp. Atk',
  'special-defense': 'Sp. Def',
  speed: 'Speed',
};

export const STAT_MAX = 255; // for bar normalization

// Type color helper — returns Tailwind background class. Stellar/unknown handled too.
export function typeBg(type: string): string {
  return `bg-type-${type}`;
}

export function isValidType(t: string): t is TypeName {
  return [
    'normal', 'fire', 'water', 'electric', 'grass', 'ice',
    'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
    'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
  ].includes(t);
}

// Decode internal API names to friendly labels
export function prettyName(name: string): string {
  return titleCase(
    name
      .replace(/-/g, ' ')
      .replace(/\bgmax\b/i, 'Gigantamax')
      .replace(/\bmega\b/i, 'Mega'),
  );
}

// Natures and stat calculation ------------------------------------------------
export type StatKey = keyof typeof STAT_LABELS;

export const NATURES: { id: string; label: string; plus: StatKey | null; minus: StatKey | null }[] = [
  { id: 'hardy', label: 'Hardy', plus: null, minus: null },
  { id: 'lonely', label: 'Lonely', plus: 'attack', minus: 'defense' },
  { id: 'brave', label: 'Brave', plus: 'attack', minus: 'speed' },
  { id: 'adamant', label: 'Adamant', plus: 'attack', minus: 'special-attack' },
  { id: 'naughty', label: 'Naughty', plus: 'attack', minus: 'special-defense' },
  { id: 'bold', label: 'Bold', plus: 'defense', minus: 'attack' },
  { id: 'docile', label: 'Docile', plus: null, minus: null },
  { id: 'relaxed', label: 'Relaxed', plus: 'defense', minus: 'speed' },
  { id: 'impish', label: 'Impish', plus: 'defense', minus: 'special-attack' },
  { id: 'lax', label: 'Lax', plus: 'defense', minus: 'special-defense' },
  { id: 'timid', label: 'Timid', plus: 'speed', minus: 'attack' },
  { id: 'hasty', label: 'Hasty', plus: 'speed', minus: 'defense' },
  { id: 'serious', label: 'Serious', plus: null, minus: null },
  { id: 'jolly', label: 'Jolly', plus: 'speed', minus: 'special-attack' },
  { id: 'naive', label: 'Naive', plus: 'speed', minus: 'special-defense' },
  { id: 'modest', label: 'Modest', plus: 'special-attack', minus: 'attack' },
  { id: 'mild', label: 'Mild', plus: 'special-attack', minus: 'defense' },
  { id: 'quiet', label: 'Quiet', plus: 'special-attack', minus: 'speed' },
  { id: 'bashful', label: 'Bashful', plus: null, minus: null },
  { id: 'rash', label: 'Rash', plus: 'special-attack', minus: 'special-defense' },
  { id: 'calm', label: 'Calm', plus: 'special-defense', minus: 'attack' },
  { id: 'gentle', label: 'Gentle', plus: 'special-defense', minus: 'defense' },
  { id: 'sassy', label: 'Sassy', plus: 'special-defense', minus: 'speed' },
  { id: 'careful', label: 'Careful', plus: 'special-defense', minus: 'special-attack' },
  { id: 'quirky', label: 'Quirky', plus: null, minus: null },
];

function natureModifier(natureId: string, key: StatKey) {
  const n = NATURES.find((x) => x.id === natureId) ?? NATURES.find((x) => x.id === 'docile')!;
  if (n.plus === key) return 1.1;
  if (n.minus === key) return 0.9;
  return 1.0;
}

export function calculateStats(
  baseStats: { base_stat: number; stat: { name: string } }[],
  level: number,
  ivs: Record<string, number>,
  evs: Record<string, number>,
  natureId = 'docile',
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of baseStats) {
    const key = s.stat.name as StatKey;
    const base = s.base_stat;
    const iv = Math.max(0, Math.min(31, ivs[key] ?? 31));
    const ev = Math.max(0, Math.min(252, evs[key] ?? 0));
    if (key === 'hp') {
      const hp = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
      out[key] = hp;
    } else {
      const raw = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
      out[key] = Math.floor(raw * natureModifier(natureId, key));
    }
  }
  return out;
}
