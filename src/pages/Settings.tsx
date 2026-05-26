import { useRef, useState, useMemo } from 'react';
import clsx from 'clsx';
import {
  exportEverything,
  importEverything,
  getPrefs,
  updatePrefs,
  type BackupBundle,
  type UserPrefs,
} from '../lib/store';
import { useStoreValue } from '../lib/use-store';
import { GAME_GROUPS } from '../lib/games';

type SettingSection = 'general' | 'games-dexes' | 'collection' | 'shiny-hunting' | 'team-builder' | 'data-backup' | 'advanced' | 'about';

const SETTINGS_SECTIONS: { id: SettingSection; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'games-dexes', label: 'Games & Dexes' },
  { id: 'collection', label: 'Collection' },
  { id: 'shiny-hunting', label: 'Shiny Hunting' },
  { id: 'team-builder', label: 'Team Builder' },
  { id: 'data-backup', label: 'Data & Backup' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'about', label: 'About' },
];

export function SettingsPage() {
  const [prefs] = useStoreValue(getPrefs, ['prefs']);
  const [activeSection, setActiveSection] = useState<SettingSection>('general');

  const handleUpdatePrefs = async (patch: Partial<UserPrefs>) => {
    await updatePrefs(patch);
  };

  return (
    <div className="flex gap-6 min-h-[calc(100vh-120px)]">
      {/* ── Left Sidebar ────────────────────────────────────────── */}
      <div className="w-48 shrink-0">
        <div className="sticky top-6 space-y-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted px-2 py-1">
            Settings
          </h2>
          <nav className="space-y-0.5">
            {SETTINGS_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={clsx(
                  'w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors',
                  activeSection === section.id
                    ? 'bg-accent/20 text-text font-medium'
                    : 'text-muted hover:text-text hover:bg-bg-hover',
                )}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Content Area ────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 pb-12">
        {activeSection === 'general' && <GeneralSection prefs={prefs} onUpdate={handleUpdatePrefs} />}
        {activeSection === 'games-dexes' && <GamesDexesSection prefs={prefs} onUpdate={handleUpdatePrefs} />}
        {activeSection === 'collection' && <CollectionSection prefs={prefs} onUpdate={handleUpdatePrefs} />}
        {activeSection === 'shiny-hunting' && <ShinyHuntingSection prefs={prefs} onUpdate={handleUpdatePrefs} />}
        {activeSection === 'team-builder' && <TeamBuilderSection prefs={prefs} onUpdate={handleUpdatePrefs} />}
        {activeSection === 'data-backup' && <DataBackupSection prefs={prefs} />}
        {activeSection === 'advanced' && <AdvancedSection />}
        {activeSection === 'about' && <AboutSection />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-2xl font-bold mb-2">{children}</h1>
  );
}

function SectionDescription({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-muted mb-6">{children}</p>
  );
}

interface SettingControlProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingControl({ label, description, children }: SettingControlProps) {
  return (
    <div className="space-y-2 pb-4 border-b border-line/30 last:border-b-0">
      <label className="text-sm font-medium block">{label}</label>
      {description && <p className="text-xs text-muted">{description}</p>}
      <div>{children}</div>
    </div>
  );
}

interface RadioGroupProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function RadioGroup({ value, options, onChange }: RadioGroupProps) {
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="radio-group"
            value={opt.value}
            checked={value === opt.value}
            onChange={(e) => onChange(e.target.value)}
            className="rounded-full"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: General
// ---------------------------------------------------------------------------

function GeneralSection({ prefs, onUpdate }: { prefs: UserPrefs | undefined; onUpdate: (patch: Partial<UserPrefs>) => Promise<void> }) {
  if (!prefs) return <div>Loading...</div>;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <SectionTitle>General</SectionTitle>
        <SectionDescription>
          Customize your app experience.
        </SectionDescription>
      </div>

      <div className="space-y-4">
        <SettingControl
          label="Theme"
          description="Choose your preferred color scheme."
        >
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="theme-group"
                value="dark"
                checked={(prefs.theme ?? 'dark') === 'dark'}
                onChange={(e) => onUpdate({ theme: e.target.value as 'dark' | 'light' })}
                className="rounded-full"
              />
              🌙 Dark Mode
            </label>
            <label className="flex items-center gap-2 text-sm cursor-not-allowed opacity-50">
              <input
                type="radio"
                name="theme-group"
                value="light"
                disabled
                className="rounded-full"
              />
              ☀️ Light Mode (coming soon)
            </label>
          </div>
        </SettingControl>

        <SettingControl
          label="Compact Mode"
          description="Reduce spacing and font sizes for a denser layout."
        >
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.compactMode ?? false}
              onChange={(e) => onUpdate({ compactMode: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Enable compact mode</span>
          </label>
        </SettingControl>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Games & Dexes
// ---------------------------------------------------------------------------

function GamesDexesSection({ prefs, onUpdate }: { prefs: UserPrefs | undefined; onUpdate: (patch: Partial<UserPrefs>) => Promise<void> }) {
  if (!prefs) return <div>Loading...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <SectionTitle>Games & Pokédexes</SectionTitle>
        <SectionDescription>
          Select which games you own. This determines which Pokémon are available and powers the catch tracker.
        </SectionDescription>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Which games do you own?</h3>
        <p className="text-xs text-muted mb-3">Version groups are tracked together for now. Individual version tracking will be added later.</p>
        <GamesOwned ownedVersions={prefs.ownedVersions ?? []} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

function GamesOwned({ ownedVersions, onUpdate }: { ownedVersions: string[]; onUpdate: (patch: Partial<UserPrefs>) => Promise<void> }) {
  const ownedSet = useMemo(() => new Set(ownedVersions), [ownedVersions]);

  async function toggleGroup(group: (typeof GAME_GROUPS)[number]) {
    const allOwned = group.versions.every((v) => ownedSet.has(v));
    let next = new Set(ownedSet);
    if (allOwned) {
      for (const v of group.versions) next.delete(v);
    } else {
      for (const v of group.versions) next.add(v);
    }
    await onUpdate({ ownedVersions: Array.from(next) });
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {GAME_GROUPS.map((g) => {
        const allOwned = g.versions.every((v) => ownedSet.has(v));
        const someOwned = !allOwned && g.versions.some((v) => ownedSet.has(v));
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => toggleGroup(g)}
            title={g.label}
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm text-left transition-colors',
              allOwned
                ? 'border-accent bg-accent/10 text-text'
                : someOwned
                  ? 'border-accent/40 bg-accent/5 text-text'
                  : 'border-line bg-bg-elev text-muted hover:text-text hover:border-line',
            )}
          >
            <span
              className={clsx(
                'w-4 h-4 rounded border grid place-items-center text-[10px] shrink-0',
                allOwned
                  ? 'bg-accent border-accent text-white'
                  : someOwned
                    ? 'border-accent text-accent'
                    : 'border-line',
              )}
            >
              {allOwned ? '✓' : someOwned ? '−' : ''}
            </span>
            <span className="flex-1 min-w-0">{g.short}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Collection
// ---------------------------------------------------------------------------

function CollectionSection({ prefs, onUpdate }: { prefs: UserPrefs | undefined; onUpdate: (patch: Partial<UserPrefs>) => Promise<void> }) {
  if (!prefs) return <div>Loading...</div>;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <SectionTitle>Collection</SectionTitle>
        <SectionDescription>
          How would you like to track your Pokémon collection?
        </SectionDescription>
      </div>

      <div className="space-y-4">
        <SettingControl
          label="Track Forms Separately"
          description="Count regional forms (e.g., Alola Raichu) as different Pokémon."
        >
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.trackFormsSeparately ?? false}
              onChange={(e) => onUpdate({ trackFormsSeparately: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Track forms separately</span>
          </label>
        </SettingControl>

        <SettingControl
          label="Track Shinies Separately"
          description="Count shiny Pokémon separately from regular ones."
        >
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.trackShiniesSeparately ?? false}
              onChange={(e) => onUpdate({ trackShiniesSeparately: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Track shinies separately</span>
          </label>
        </SettingControl>

        <SettingControl
          label="Living Dex Per Game"
          description="Maintain separate living dex boxes for each game instead of one global living dex."
        >
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.trackLivingSlotsPerGame ?? false}
              onChange={(e) => onUpdate({ trackLivingSlotsPerGame: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Track living dex per game</span>
          </label>
        </SettingControl>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Shiny Hunting
// ---------------------------------------------------------------------------

function ShinyHuntingSection({ prefs, onUpdate }: { prefs: UserPrefs | undefined; onUpdate: (patch: Partial<UserPrefs>) => Promise<void> }) {
  if (!prefs) return <div>Loading...</div>;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <SectionTitle>Shiny Hunting</SectionTitle>
        <SectionDescription>
          Set default preferences for new shiny hunts.
        </SectionDescription>
      </div>

      <div className="space-y-4">
        <SettingControl
          label="Default Hunting Method"
          description="The method used by default when creating a new hunt."
        >
          <RadioGroup
            value={prefs.defaultShinyMethod ?? 'encounters'}
            options={[
              { value: 'encounters', label: 'Encounters' },
              { value: 'rest', label: 'Rest' },
              { value: 'soft-reset', label: 'Soft Reset' },
            ]}
            onChange={(method) => onUpdate({ defaultShinyMethod: method as 'encounters' | 'rest' | 'soft-reset' })}
          />
        </SettingControl>

        <SettingControl
          label="Shiny Charm"
          description="Enable shiny charm by default for new hunts."
        >
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.defaultShinyCharm ?? false}
              onChange={(e) => onUpdate({ defaultShinyCharm: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Use shiny charm by default</span>
          </label>
        </SettingControl>

        <SettingControl
          label="Auto-Track Encounters"
          description="Automatically log encounters to active hunts."
        >
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.autoTrackShinyHunts ?? false}
              onChange={(e) => onUpdate({ autoTrackShinyHunts: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Auto-track encounters</span>
          </label>
        </SettingControl>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Team Builder
// ---------------------------------------------------------------------------

function TeamBuilderSection({ prefs, onUpdate }: { prefs: UserPrefs | undefined; onUpdate: (patch: Partial<UserPrefs>) => Promise<void> }) {
  if (!prefs) return <div>Loading...</div>;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <SectionTitle>Team Builder</SectionTitle>
        <SectionDescription>
          Choose default competitive rules for your teams.
        </SectionDescription>
      </div>

      <div className="space-y-4">
        <SettingControl
          label="Competitive Ruleset"
          description="The EV cap and constraints applied by default to new teams."
        >
          <RadioGroup
            value={prefs.competitiveRuleset ?? 'standard'}
            options={[
              { value: 'standard', label: '📊 Standard (510 total · max 252 per stat)' },
              { value: 'champions', label: '🏆 Pokémon Champions (66 total · max 32 per stat)' },
            ]}
            onChange={(ruleset) => onUpdate({ competitiveRuleset: ruleset as 'standard' | 'champions' })}
          />
        </SettingControl>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Data & Backup
// ---------------------------------------------------------------------------

function DataBackupSection({ prefs }: { prefs: UserPrefs | undefined }) {
  if (!prefs) return <div>Loading...</div>;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <SectionTitle>Data & Backup</SectionTitle>
        <SectionDescription>
          Manage your personal data and backups.
        </SectionDescription>
      </div>

      <div className="space-y-4">
        <div className="pb-4 border-b border-line/30">
          <h3 className="text-sm font-semibold mb-3">Export & Import</h3>
          <p className="text-xs text-muted mb-3">
            Save all your data (favorites, recently viewed, teams, catch records, shiny hunts, collection) to a JSON file. Import it later on another device or after clearing browser data.
          </p>
          <BackupControls />
        </div>

        <SettingControl
          label="Auto-Backup"
          description="Automatically save your data periodically (not yet implemented)."
        >
          <label className="flex items-center gap-2 cursor-pointer opacity-50">
            <input
              type="checkbox"
              disabled
              checked={prefs.autoBackupEnabled ?? false}
              className="rounded"
            />
            <span className="text-sm">Enable auto-backup</span>
          </label>
        </SettingControl>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Advanced
// ---------------------------------------------------------------------------

function AdvancedSection() {
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <SectionTitle>Advanced</SectionTitle>
        <SectionDescription>
          Advanced settings and debug tools.
        </SectionDescription>
      </div>

      <div className="card p-4 bg-bg-elev/50 border border-line/30 rounded-lg text-sm text-muted">
        <p>Advanced settings coming soon.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: About
// ---------------------------------------------------------------------------

function AboutSection() {
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <SectionTitle>About</SectionTitle>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-1">Pokédex</h3>
          <p className="text-sm text-muted">Version 0.1.0</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-1">Data</h3>
          <p className="text-sm text-muted">
            All your personal data (favorites, teams, catch records, etc.) is stored locally in your browser. Nothing is sent to any server.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-1">Pokémon Data</h3>
          <p className="text-sm text-muted">
            Pokémon information is provided by{' '}
            <a href="https://pokeapi.co/" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">
              PokéAPI
            </a>
            , a free and open-source API.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backup Controls (preserved from original)
// ---------------------------------------------------------------------------

function BackupControls() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    try {
      const bundle = await exportEverything();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `pokedex-backup-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`Exported ${bundle.favorites.length} favorites, ${bundle.recent.length} recent, ${bundle.teamsLocalStorage ? 'teams included' : 'no teams'}.`);
    } catch (e) {
      setStatus(`Export failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File, merge: boolean) {
    setBusy(true);
    setStatus(null);
    try {
      const text = await file.text();
      const bundle = JSON.parse(text) as BackupBundle;
      if (!merge) {
        const ok = confirm(
          'REPLACE will erase your current favorites, recently viewed and games-owned settings before importing. Continue?',
        );
        if (!ok) return;
      }
      const result = await importEverything(bundle, { merge });
      setStatus(
        `Imported ${result.favorites} favorites, ${result.recent} recent, prefs ${result.prefs ? 'restored' : 'unchanged'}, teams ${result.teams ? 'restored' : 'unchanged'}.`,
      );
    } catch (e) {
      setStatus(`Import failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary text-sm"
          onClick={handleExport}
          disabled={busy}
        >
          ⬇ Export backup
        </button>
        <button
          type="button"
          className="btn text-sm"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          ⬆ Import & merge
        </button>
        <button
          type="button"
          className="btn text-red-400 text-sm"
          onClick={async () => {
            const confirmed = confirm(
              'This will replace all current local data (favorites, recent, games, teams, catches, hunts).\n\nExport a backup first?\n\n[Cancel] to export first\n[OK] to proceed with replace',
            );
            if (!confirmed) {
              // Ask if user wants to export first
              const exportNow = confirm('Would you like to export a backup first?');
              if (exportNow) {
                await handleExport();
              }
              return;
            }
            fileRef.current?.setAttribute('data-mode', 'replace');
            fileRef.current?.click();
          }}
          disabled={busy}
        >
          ⬆ Import & replace
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const merge = fileRef.current?.getAttribute('data-mode') !== 'replace';
            fileRef.current?.removeAttribute('data-mode');
            handleImport(file, merge);
          }}
        />
      </div>
      {status && <div className="text-xs text-muted">{status}</div>}
    </div>
  );
}
