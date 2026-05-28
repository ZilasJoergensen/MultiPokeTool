import { useState } from 'react';
import { addToStorage, setGameDexStatus } from '../lib/store';

const NATURES = [
  'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
  'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
  'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
  'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
  'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky',
];

const BALLS = [
  'Poké Ball', 'Great Ball', 'Ultra Ball', 'Master Ball',
  'Premier Ball', 'Heal Ball', 'Net Ball', 'Nest Ball',
  'Repeat Ball', 'Timer Ball', 'Luxury Ball', 'Dusk Ball',
  'Quick Ball', 'Dive Ball', 'Lure Ball', 'Heavy Ball',
  'Love Ball', 'Moon Ball', 'Level Ball', 'Cherish Ball',
  'Dream Ball', 'Safari Ball', 'Sport Ball', 'Fast Ball',
  'Slow Ball', 'Beast Ball', 'Ancient Ball', 'Gigaton Ball',
  'Feather Ball', 'Wing Ball', 'Jet Ball',
];

interface MoveToStorageModalProps {
  pokemonId: number;
  pokemonName: string;
  gameGroupId: string;
  gameGroupName: string;
  onClose: () => void;
  onMoveComplete?: () => void;
}

export function MoveToStorageModal({
  pokemonId,
  pokemonName,
  gameGroupId,
  gameGroupName,
  onClose,
  onMoveComplete,
}: MoveToStorageModalProps) {
  const [loading, setLoading] = useState(false);
  const [expandDetails, setExpandDetails] = useState(false);
  const [shiny, setShiny] = useState(false);
  const [nature, setNature] = useState('');
  const [ball, setBall] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleMove = async (includeDetails: boolean) => {
    try {
      setError(null);
      setLoading(true);

      await addToStorage({
        pokemonId,
        pokemonName,
        shiny,
        originGame: gameGroupId,
        currentLocation: 'Pokémon HOME',
        ...(includeDetails && nature && { nature }),
        ...(includeDetails && ball && { ball }),
        ...(includeDetails && notes && { notes }),
      });

      // Keep game dex status as 'registered' — moving to storage doesn't erase the catch
      await setGameDexStatus(gameGroupId, pokemonId, pokemonName, 'registered');

      onMoveComplete?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move Pokémon to storage');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="card w-96 p-6 space-y-4">
        <h3 className="text-lg font-semibold">Move to Storage</h3>

        {/* Info section */}
        <div className="bg-bg-hover rounded p-3 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted">Pokémon:</span>
            <span className="font-semibold">{pokemonName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">From:</span>
            <span className="font-semibold">{gameGroupName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Location:</span>
            <span className="font-semibold">Pokémon HOME</span>
          </div>
        </div>

        {/* Shiny toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm">Shiny?</label>
          <button
            type="button"
            className={`px-3 py-1 rounded text-sm transition ${
              shiny
                ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-300'
                : 'bg-bg-hover border border-muted/30'
            }`}
            onClick={() => setShiny(!shiny)}
          >
            {shiny ? '✨ Yes' : 'No'}
          </button>
        </div>

        {/* Collapsible Additional Details */}
        <div className="border-t border-muted/20 pt-3">
          <button
            type="button"
            className="text-sm text-accent hover:text-accent/80 flex items-center gap-2 transition"
            onClick={() => setExpandDetails(!expandDetails)}
          >
            <span className={`transition ${expandDetails ? 'rotate-90' : ''}`}>▶</span>
            Additional Details
          </button>

          {expandDetails && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-xs text-muted block mb-1">Nature</label>
                <select
                  className="input w-full text-sm"
                  value={nature}
                  onChange={(e) => setNature(e.target.value)}
                >
                  <option value="">None</option>
                  {NATURES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-muted block mb-1">Ball</label>
                <select
                  className="input w-full text-sm"
                  value={ball}
                  onChange={(e) => setBall(e.target.value)}
                >
                  <option value="">None</option>
                  {BALLS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-muted block mb-1">Notes</label>
                <textarea
                  className="input w-full text-sm resize-none"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes about this Pokémon..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && <div className="text-sm text-red-400 bg-red-500/10 p-2 rounded">{error}</div>}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            className="btn flex-1 text-sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn text-sm flex-1"
            onClick={() => handleMove(false)}
            disabled={loading}
          >
            {loading ? '...' : 'Continue'}
          </button>
          {(shiny || nature || ball || notes) && (
            <button
              type="button"
              className="btn btn-primary text-sm flex-1"
              onClick={() => handleMove(true)}
              disabled={loading}
            >
              {loading ? '...' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
