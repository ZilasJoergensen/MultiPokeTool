import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, idFromUrl, type EvolutionLink, type EvolutionDetail } from '../lib/api';
import { setGameDexStatus } from '../lib/store';
import { Sprite } from './Sprite';
import { prettyName } from '../lib/utils';
import clsx from 'clsx';

interface Stage {
  species: { name: string; url: string };
  details: EvolutionDetail[];
  id: number;
}

function flattenChain(
  link: EvolutionLink,
  acc: Stage[] = [],
  details: EvolutionDetail[] = []
): Stage[] {
  acc.push({ species: link.species, details, id: idFromUrl(link.species.url) });
  for (const next of link.evolves_to) {
    flattenChain(next, acc, next.evolution_details);
  }
  return acc;
}

function evoConditionsLabel(details: EvolutionDetail[]): string {
  if (details.length === 0) return 'Base form';
  const d = details[0];
  const parts: string[] = [];
  if (d.min_level != null) parts.push(`Lv ${d.min_level}`);
  if (d.item) parts.push(`Use ${prettyName(d.item.name)}`);
  if (d.held_item) parts.push(`Hold ${prettyName(d.held_item.name)}`);
  if (d.known_move) parts.push(`Knows ${prettyName(d.known_move.name)}`);
  if (d.known_move_type) parts.push(`Knows ${prettyName(d.known_move_type.name)} move`);
  if (d.min_happiness != null) parts.push(`Happiness ${d.min_happiness}+`);
  if (d.min_affection != null) parts.push(`Affection ${d.min_affection}+`);
  if (d.min_beauty != null) parts.push(`Beauty ${d.min_beauty}+`);
  if (d.location) parts.push(`At ${prettyName(d.location.name)}`);
  if (d.time_of_day) parts.push(`${d.time_of_day.charAt(0).toUpperCase() + d.time_of_day.slice(1)}`);
  if (d.trade_species) parts.push(`Trade w/ ${prettyName(d.trade_species.name)}`);
  if (d.trigger?.name === 'trade' && !d.trade_species) parts.push('Trade');
  if (d.needs_overworld_rain) parts.push('In rain');
  if (d.turn_upside_down) parts.push('Console upside-down');
  if (d.gender === 1) parts.push('Female');
  if (d.gender === 2) parts.push('Male');
  return parts.join(' · ') || prettyName(d.trigger?.name ?? 'Evolve');
}

interface EvolutionChainModalProps {
  pokemonId: number;
  pokemonName: string;
  gameGroupId: string;
  speciesUrl: string;
  onClose: () => void;
  onEvolved?: () => void;
}

export function EvolutionChainModal({
  pokemonId,
  pokemonName,
  gameGroupId,
  speciesUrl,
  onClose,
  onEvolved,
}: EvolutionChainModalProps) {
  const chainId = idFromUrl(speciesUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: chainData } = useQuery({
    queryKey: ['evolution-chain', chainId],
    queryFn: () => api.evolutionChain(chainId),
    enabled: chainId > 0,
  });

  if (!chainData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="card w-96 p-6 text-center text-muted">Loading evolution data...</div>
      </div>
    );
  }

  const stages = flattenChain(chainData.chain);
  const currentIndex = stages.findIndex((s) => s.id === pokemonId);

  if (currentIndex === -1 || currentIndex === stages.length - 1) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="card w-96 p-6 text-center space-y-4">
          <p className="text-muted">{pokemonName} has no evolutions available.</p>
          <button
            type="button"
            className="btn btn-primary w-full text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const currentStage = stages[currentIndex];
  const availableEvolutions = stages.slice(currentIndex + 1);

  const handleSelectEvolution = async (evolution: Stage) => {
    try {
      setError(null);
      setLoading(true);

      // Mark current form as 'registered' (caught but not owned)
      await setGameDexStatus(
        gameGroupId,
        pokemonId,
        pokemonName,
        'registered'
      );

      // Mark evolved form as 'in_game' (now owned)
      await setGameDexStatus(
        gameGroupId,
        evolution.id,
        evolution.species.name,
        'in_game'
      );

      onEvolved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update evolution status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="card w-96 p-6 space-y-4 max-h-[90vh] overflow-auto">
        <h3 className="text-lg font-semibold">Select Evolution</h3>

        {/* Current form */}
        <div className="bg-bg-hover rounded p-3 text-sm">
          <p className="text-xs text-muted mb-2">Current form:</p>
          <div className="flex items-center gap-3">
            <div className="w-[56px] h-[56px] flex items-center justify-center flex-shrink-0">
              <Sprite id={pokemonId} name={pokemonName} size={56} />
            </div>
            <span className="font-semibold">{prettyName(pokemonName)}</span>
          </div>
        </div>

        {/* Evolution options */}
        <div className="space-y-2">
          <p className="text-xs text-muted">Evolve into:</p>
          {availableEvolutions.map((evo, idx) => {
            const condition = evoConditionsLabel(evo.details);
            return (
              <button
                key={evo.species.name}
                type="button"
                className={clsx(
                  'w-full p-3 rounded-lg border transition text-left',
                  loading
                    ? 'opacity-50 cursor-not-allowed'
                    : 'border-line/40 hover:border-line/70 hover:bg-bg-hover cursor-pointer'
                )}
                onClick={() => handleSelectEvolution(evo)}
                disabled={loading}
              >
                <div className="flex items-center gap-3">
                  <div className="w-[48px] h-[48px] flex items-center justify-center flex-shrink-0">
                    <Sprite id={evo.id} name={evo.species.name} size={48} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{prettyName(evo.species.name)}</p>
                    <p className="text-xs text-muted/70">{condition}</p>
                  </div>
                  {loading && <span className="text-xs text-muted">⏳</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Error message */}
        {error && <div className="text-sm text-red-400 bg-red-500/10 p-2 rounded">{error}</div>}

        {/* Close button */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            className="btn flex-1 text-sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
