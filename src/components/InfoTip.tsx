import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

/**
 * Small info icon that reveals a tooltip on hover or click. Click works on
 * touch devices where hover is unreliable; outside-click closes it.
 */
export function InfoTip({
  text,
  className,
}: {
  text: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className={clsx('relative inline-flex items-center group', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((x) => !x);
        }}
        aria-label="More info"
        className="text-muted hover:text-accent text-[11px] leading-none w-4 h-4 rounded-full border border-current grid place-items-center font-bold"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 z-30
                     bg-bg-card border border-line rounded-lg px-3 py-2
                     text-xs text-text shadow-card normal-case font-normal
                     leading-relaxed pointer-events-none"
        >
          {text}
        </span>
      )}
    </span>
  );
}
