import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PokedexPage } from './pages/Pokedex';
import { PokemonDetailPage } from './pages/PokemonDetail';
import { TeamBuilderPage } from './pages/TeamBuilder';
import { DamageCalcPage } from './pages/DamageCalc';
import { SettingsPage } from './pages/Settings';
import { CatchTrackerPage } from './pages/CatchTracker';
import { ShinyHunterPage } from './pages/ShinyHunter';
import { DashboardPage } from './pages/Dashboard';
import { CollectionPage } from './pages/Collection';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/pokedex" element={<PokedexPage />} />
        <Route path="/pokemon/:idOrName" element={<PokemonDetailPage />} />
        <Route path="/collection" element={<CollectionPage />} />
        <Route path="/catch-tracker" element={<CatchTrackerPage />} />
        <Route path="/shiny-hunter" element={<ShinyHunterPage />} />
        <Route path="/team-builder" element={<TeamBuilderPage />} />
        <Route path="/team-builder/:teamId" element={<TeamBuilderPage />} />
        <Route path="/damage-calc" element={<DamageCalcPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
