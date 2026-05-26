import { STAT_MAX } from '../lib/utils';

const STAT_COLOR: Record<string, string> = {
  hp: 'bg-emerald-500',
  attack: 'bg-orange-500',
  defense: 'bg-yellow-500',
  'special-attack': 'bg-sky-500',
  'special-defense': 'bg-teal-500',
  speed: 'bg-pink-500',
};

export function StatBar({ name, value }: { name: string; value: number }) {
  const pct = Math.min(100, (value / STAT_MAX) * 100);
  const color = STAT_COLOR[name] ?? 'bg-accent';
  return (
    <div className="stat-bar">
      <span className={color} style={{ width: `${pct}%` }} />
    </div>
  );
}
