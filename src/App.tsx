import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PokedexPage } from './pages/Pokedex';
import { PokemonDetailPage } from './pages/PokemonDetail';
import { TeamBuilderPage } from './pages/TeamBuilder';
import { BattlePlannerPage } from './pages/BattlePlanner';
import { SettingsPage } from './pages/Settings';
import { GameDexesPage } from './pages/GameDexes';
import { ShinyHunterPage } from './pages/ShinyHunter';
import { DashboardPage } from './pages/Dashboard';
import { StoragePage } from './pages/Storage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/pokedex" element={<PokedexPage />} />
        <Route path="/pokemon/:idOrName" element={<PokemonDetailPage />} />
        <Route path="/storage" element={<StoragePage />} />
        <Route path="/game-dexes" element={<GameDexesPage />} />
        <Route path="/shiny-hunter" element={<ShinyHunterPage />} />
        <Route path="/team-builder" element={<TeamBuilderPage />} />
        <Route path="/team-builder/:teamId" element={<TeamBuilderPage />} />
        <Route path="/battle-planner" element={<BattlePlannerPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
