import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Outlet } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
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
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  // close on navigation
  useEffect(() => setOpen(false), [loc.pathname]);

  // lock body scroll when menu is open
  const panel = (
    <div className={'fixed inset-0 z-60 ' + (open ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!open}>
      <div
        onClick={() => setOpen(false)}
        className={'absolute inset-0 bg-black/60 transition-opacity ' + (open ? 'opacity-100' : 'opacity-0')}
      />

      <aside
        className={
          'fixed left-0 top-0 bottom-0 w-80 sm:w-64 bg-bg-elev border-r border-line shadow-xl transform transition-transform z-60 overflow-y-auto ' +
          (open ? 'translate-x-0' : '-translate-x-full')
        }
        role="dialog"
        aria-modal="true"
      >
        <div className="p-4 flex items-center justify-between sticky top-0 bg-bg-elev z-60 border-b border-line">
          <div className="font-semibold">Menu</div>
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="p-2 rounded-md hover:bg-bg/20">✕</button>
        </div>
        <nav className="flex flex-col p-4 gap-2 text-text">
          <NavLink onClick={() => setOpen(false)} to="/" className="block px-3 py-2 rounded-md text-base hover:bg-bg text-text">Home</NavLink>
          <NavLink onClick={() => setOpen(false)} to="/pokedex" className="block px-3 py-2 rounded-md text-base hover:bg-bg text-text">Pokédex</NavLink>
          <NavLink onClick={() => setOpen(false)} to="/catch-tracker" className="block px-3 py-2 rounded-md text-base hover:bg-bg text-text">Catch Tracker</NavLink>
          <NavLink onClick={() => setOpen(false)} to="/collection" className="block px-3 py-2 rounded-md text-base hover:bg-bg text-text">Collection</NavLink>
          <NavLink onClick={() => setOpen(false)} to="/team-builder" className="block px-3 py-2 rounded-md text-base hover:bg-bg text-text">Team Builder</NavLink>
          <NavLink onClick={() => setOpen(false)} to="/settings" className="block px-3 py-2 rounded-md text-base hover:bg-bg text-text">Settings</NavLink>
        </nav>
      </aside>
    </div>
  );

  return (
    <>
      <button
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="p-2 rounded-md bg-bg-elev/40"
      >
        ☰
      </button>
      {createPortal(panel, document.body)}
    </>
  );
          <nav className="flex flex-col p-4 gap-2 text-text">
            <NavLink onClick={() => setOpen(false)} to="/" className="block px-3 py-2 rounded-md text-base hover:bg-bg text-text">Home</NavLink>
            <NavLink onClick={() => setOpen(false)} to="/pokedex" className="block px-3 py-2 rounded-md text-base hover:bg-bg text-text">Pokédex</NavLink>
            <NavLink onClick={() => setOpen(false)} to="/catch-tracker" className="block px-3 py-2 rounded-md text-base hover:bg-bg text-text">Catch Tracker</NavLink>
            <NavLink onClick={() => setOpen(false)} to="/collection" className="block px-3 py-2 rounded-md text-base hover:bg-bg text-text">Collection</NavLink>
            <NavLink onClick={() => setOpen(false)} to="/team-builder" className="block px-3 py-2 rounded-md text-base hover:bg-bg text-text">Team Builder</NavLink>
            <NavLink onClick={() => setOpen(false)} to="/settings" className="block px-3 py-2 rounded-md text-base hover:bg-bg text-text">Settings</NavLink>
          </nav>
        </aside>
      </div>
    </>
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
