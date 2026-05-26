// Official artwork from PokeAPI's sprites repo. Skips a network roundtrip
// per card vs hitting /pokemon/{id} for every grid cell.
const ART_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';
const HOME_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home';

export function spriteUrl(id: number, opts: { shiny?: boolean; home?: boolean } = {}) {
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
  return (
    <img
      src={spriteUrl(id, { shiny })}
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
