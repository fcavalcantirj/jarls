import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import Home from './pages/Home';
import Game from './pages/Game';
import Lobby from './pages/Lobby';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lobby/create" element={<Lobby />} />
          <Route path="/lobby/games" element={<Lobby />} />
          <Route path="/lobby/:gameId" element={<Lobby />} />
          <Route path="/game/:gameId" element={<Game />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
