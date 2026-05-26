import clsx from 'clsx';

/**
 * Cross-fades children in when `shown` flips from false to true. Layout
 * containers should reserve the final size around this so toggling `shown`
 * doesn't push siblings — this component handles opacity, not height.
 */
export function FadeIn({
  shown,
  children,
  className,
  durationMs = 250,
}: {
  shown: boolean;
  children: React.ReactNode;
  className?: string;
  durationMs?: number;
}) {
  return (
    <div
      className={clsx(
        'transition-opacity ease-out',
        shown ? 'opacity-100' : 'opacity-0',
        className,
      )}
      style={{ transitionDuration: `${durationMs}ms` }}
    >
      {children}
    </div>
  );
}
