import clsx from 'clsx';
import { typeBg } from '../lib/utils';

export function TypeBadge({
  type,
  size = 'md',
  className,
}: {
  type: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'chip text-white drop-shadow-sm',
        typeBg(type),
        size === 'sm' && 'text-[10px] px-2 py-0.5',
        size === 'lg' && 'text-sm px-3 py-1.5',
        className,
      )}
    >
      {type}
    </span>
  );
}
