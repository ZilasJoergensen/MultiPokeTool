import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { getPrefs } from '../lib/store';
import { useStoreValue } from '../lib/use-store';
import { preloadDexes } from '../lib/regional-dex';
import { GAME_GROUPS } from '../lib/games';

export function Layout() {
  const queryClient = useQueryClient();
  const [prefs] = useStoreValue(getPrefs, ['prefs']);

  // Preload regional dexes for owned games on app startup
  useEffect(() => {
    if (!prefs?.ownedVersions.length) return;

    // Collect owned game group IDs
    const ownedSet = new Set(prefs.ownedVersions);
    const ownedGameIds = GAME_GROUPS
      .filter((g) => g.versions.some((v) => ownedSet.has(v)))
      .map((g) => g.id);

    // preloadDexes handles deduplication (e.g. rby + frlg both use kanto)
    if (ownedGameIds.length > 0) {
      preloadDexes(queryClient, ownedGameIds);
    }
  }, [prefs, queryClient]);

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur bg-bg/80 border-b border-line">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-12 flex items-center gap-4">
          <NavLink to="/" className="flex items-center gap-2 font-extrabold tracking-tight">
            <span className="w-7 h-7 rounded-full bg-accent grid place-items-center text-white shadow-card">
              <span className="w-3 h-3 rounded-full bg-white border-2 border-bg" />
            </span>
            <span className="text-lg">Pokedex</span>
          </NavLink>
          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1 text-sm">
            <Tab to="/" end>Home</Tab>
            <Tab to="/pokedex">Pokédex</Tab>
            <Tab to="/collection">Collection</Tab>
            <Tab to="/catch-tracker">Catch Tracker</Tab>
            <Tab to="/shiny-hunter">Shiny Hunter</Tab>
            <Tab to="/team-builder">Team Builder</Tab>
            <Tab to="/damage-calc">Damage Calc</Tab>
            <Tab to="/settings">Settings</Tab>
          </nav>
          {/* Mobile menu button */}
          <div className="sm:hidden ml-2">
            <MobileMenu />
          </div>
          <div className="ml-auto text-xs text-muted hidden sm:block">
            Data from <a className="text-text hover:text-accent" href="https://pokeapi.co" target="_blank" rel="noreferrer">PokeAPI</a>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4">
        <Outlet />
      </main>
    </div>
  );
}

function MobileMenu() {
  return (
    <details className="relative">
      <summary className="list-none cursor-pointer p-2 rounded-md bg-bg-elev/40 text-sm">☰</summary>
      <div className="absolute right-0 mt-2 w-48 bg-bg-elev border border-line rounded-md shadow-card p-2 flex flex-col gap-1">
        <NavLink to="/" className="px-2 py-1 rounded hover:bg-bg">Home</NavLink>
        <NavLink to="/pokedex" className="px-2 py-1 rounded hover:bg-bg">Pokédex</NavLink>
        <NavLink to="/catch-tracker" className="px-2 py-1 rounded hover:bg-bg">Catch Tracker</NavLink>
        <NavLink to="/collection" className="px-2 py-1 rounded hover:bg-bg">Collection</NavLink>
        <NavLink to="/team-builder" className="px-2 py-1 rounded hover:bg-bg">Team Builder</NavLink>
        <NavLink to="/settings" className="px-2 py-1 rounded hover:bg-bg">Settings</NavLink>
      </div>
    </details>
  );
}

function Tab({ to, end, children }: { to: string; end?: boolean; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      viewTransition
      className={({ isActive }) =>
        clsx(
          'px-3 py-1.5 rounded-lg transition-colors',
          isActive ? 'bg-bg-elev text-text' : 'text-muted hover:text-text hover:bg-bg-elev/60',
        )
      }
    >
      {children}
    </NavLink>
  );
}
