import { useState, useEffect } from 'react';
import { Users, Database, Sparkles, Globe, Activity, TrendingUp } from 'lucide-react';
import { StatsCard, StatsCardSkeleton } from '../components/dashboard/StatsCard';
import { LeaderboardItem, LeaderboardSkeleton } from '../components/dashboard/LeaderboardItem';
import { PokemonCard, PokemonCardSkeleton } from '../components/pokemon/PokemonCard';
import { PokemonDetailModal } from '../components/pokemon/PokemonDetailModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [catchesLeaderboard, setCatchesLeaderboard] = useState([]);
  const [shiniesLeaderboard, setShiniesLeaderboard] = useState([]);
  const [featuredPokemon, setFeaturedPokemon] = useState([]);
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [weather, setWeather] = useState('clear');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, catchesRes, shiniesRes, pokemonRes, weatherRes] = await Promise.all([
        axios.get(`${API}/stats/bot`),
        axios.get(`${API}/leaderboard/catches?limit=5`),
        axios.get(`${API}/leaderboard/shinies?limit=5`),
        axios.get(`${API}/pokemon?limit=8`),
        axios.get(`${API}/global/weather`),
      ]);
      
      setStats(statsRes.data);
      setCatchesLeaderboard(catchesRes.data);
      setShiniesLeaderboard(shiniesRes.data);
      setFeaturedPokemon(pokemonRes.data);
      setWeather(weatherRes.data.weather);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const WEATHER_INFO = {
    clear: { label: 'Clear', color: 'bg-yellow-500' },
    rain: { label: 'Rain', color: 'bg-blue-500' },
    snow: { label: 'Snow', color: 'bg-cyan-400' },
    sandstorm: { label: 'Sandstorm', color: 'bg-amber-600' },
    fog: { label: 'Fog', color: 'bg-slate-400' },
  };

  return (
    <div data-testid="dashboard-page" className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-slate-400 mt-1">
            Welcome back, Trainer! Here's your bot overview.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-slate-700 text-slate-300 px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2 pulse-live" />
            Bot Online
          </Badge>
          <Badge 
            variant="outline" 
            className={`border-slate-700 px-3 py-1.5 ${WEATHER_INFO[weather]?.color} bg-opacity-20 text-white`}
          >
            <Globe className="w-3 h-3 mr-2" />
            {WEATHER_INFO[weather]?.label || 'Clear'}
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {loading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          <>
            <StatsCard
              title="Total Trainers"
              value={stats?.total_users || 0}
              icon={Users}
            />
            <StatsCard
              title="Pokémon Caught"
              value={stats?.total_pokemon_caught || 0}
              icon={Database}
            />
            <StatsCard
              title="Shinies Found"
              value={stats?.total_shiny_caught || 0}
              icon={Sparkles}
            />
            <StatsCard
              title="Pokémon in Dex"
              value={stats?.pokemon_in_database || 0}
              icon={Activity}
            />
          </>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboards */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-yellow-400" />
                Top Trainers
              </h2>
            </div>
            
            <Tabs defaultValue="catches" className="p-4">
              <TabsList className="grid grid-cols-2 bg-slate-800/50 p-1 rounded-lg">
                <TabsTrigger 
                  value="catches"
                  className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black rounded-md text-sm"
                >
                  Catches
                </TabsTrigger>
                <TabsTrigger 
                  value="shinies"
                  className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black rounded-md text-sm"
                >
                  Shinies
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="catches" className="mt-4 space-y-3">
                {loading ? (
                  <>
                    <LeaderboardSkeleton />
                    <LeaderboardSkeleton />
                    <LeaderboardSkeleton />
                  </>
                ) : catchesLeaderboard.length > 0 ? (
                  catchesLeaderboard.map((entry) => (
                    <LeaderboardItem
                      key={entry.user_id}
                      rank={entry.rank}
                      username={entry.username}
                      value={entry.value}
                      label="catches"
                    />
                  ))
                ) : (
                  <p className="text-center text-slate-500 py-8">No data yet</p>
                )}
              </TabsContent>
              
              <TabsContent value="shinies" className="mt-4 space-y-3">
                {loading ? (
                  <>
                    <LeaderboardSkeleton />
                    <LeaderboardSkeleton />
                    <LeaderboardSkeleton />
                  </>
                ) : shiniesLeaderboard.length > 0 ? (
                  shiniesLeaderboard.map((entry) => (
                    <LeaderboardItem
                      key={entry.user_id}
                      rank={entry.rank}
                      username={entry.username}
                      value={entry.value}
                      label="shinies"
                    />
                  ))
                ) : (
                  <p className="text-center text-slate-500 py-8">No data yet</p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Featured Pokemon */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                Featured Pokémon
              </h2>
              <span className="text-sm text-slate-500">
                {featuredPokemon.length} shown
              </span>
            </div>
            
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {loading ? (
                  <>
                    <PokemonCardSkeleton />
                    <PokemonCardSkeleton />
                    <PokemonCardSkeleton />
                    <PokemonCardSkeleton />
                  </>
                ) : (
                  featuredPokemon.map((pokemon) => (
                    <PokemonCard
                      key={pokemon.id}
                      pokemon={pokemon}
                      onClick={() => setSelectedPokemon(pokemon)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pokemon Detail Modal */}
      <PokemonDetailModal
        pokemon={selectedPokemon}
        isOpen={!!selectedPokemon}
        onClose={() => setSelectedPokemon(null)}
      />
    </div>
  );
}
