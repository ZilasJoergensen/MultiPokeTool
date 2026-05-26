// Sprite helper: provide a lightweight thumbnail srcset for mobile.
const ART_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';
const HOME_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home';
const TINY_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

export function spriteUrl(id: number, opts: { shiny?: boolean; home?: boolean; tiny?: boolean } = {}) {
  if (opts.tiny) return `${TINY_BASE}/${id}.png`;
  const base = opts.home ? HOME_BASE : ART_BASE;
  const file = opts.shiny ? `shiny/${id}.png` : `${id}.png`;
  return `${base}/${file}`;
}

export function Sprite({
  id,
  name,
  shiny = false,
  className,
  size = 96,
}: {
  id: number;
  name: string;
  shiny?: boolean;
  className?: string;
  size?: number;
}) {
  const src = spriteUrl(id, { shiny });
  const tiny = spriteUrl(id, { tiny: true });
  const srcSet = `${tiny} 64w, ${src} 256w`;

  return (
    <img
      src={tiny}
      srcSet={srcSet}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      className={className}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.opacity = '0.3';
      }}
    />
  );
}
