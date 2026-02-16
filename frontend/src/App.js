import "@/index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Pokedex from "./pages/Pokedex";
import Leaderboard from "./pages/Leaderboard";
import UserLookup from "./pages/UserLookup";
import TypeChart from "./pages/TypeChart";

function App() {
  return (
    <div className="App min-h-screen bg-slate-950">
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pokedex" element={<Pokedex />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/users" element={<UserLookup />} />
            <Route path="/types" element={<TypeChart />} />
          </Routes>
        </Layout>
      </BrowserRouter>
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
