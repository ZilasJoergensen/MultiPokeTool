import type { QueryClient } from '@tanstack/react-query';
import { api } from './api';
import { spriteUrl } from '../components/Sprite';

/**
 * Eagerly fetch the data a detail page will need before the user clicks.
 * Called on hover/focus of a Pokédex card — by the time the click navigates,
 * the cache is usually warm and the page renders without skeletons.
 */
export function prefetchPokemonDetail(qc: QueryClient, idOrName: string | number) {
  const key = String(idOrName);
  // Pokemon + species in parallel — same calls the detail page will issue.
  qc.prefetchQuery({
    queryKey: ['pokemon', key],
    queryFn: () => api.pokemon(idOrName),
    staleTime: 1000 * 60 * 60 * 24 * 30,
  });
  qc.prefetchQuery({
    queryKey: ['species', key],
    queryFn: () => api.species(idOrName),
    staleTime: 1000 * 60 * 60 * 24 * 30,
  });
}

/**
 * Warm the browser image cache for the official artwork. The sprite endpoint
 * is on a different origin (raw.githubusercontent.com), so a separate prefetch
 * is needed — React Query doesn't know about it.
 */
export function preloadSprite(id: number) {
  if (typeof window === 'undefined') return;
  const img = new Image();
  img.src = spriteUrl(id);
}
