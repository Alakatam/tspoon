import { useState } from 'react';
import { Search, User, Database, Sparkles, BookOpen, Calendar } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { PokemonCard, PokemonCardSkeleton } from '../components/pokemon/PokemonCard';
import { PokemonDetailModal } from '../components/pokemon/PokemonDetailModal';
import axios from 'axios';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function UserLookup() {
  const [userId, setUserId] = useState('');
  const [user, setUser] = useState(null);
  const [userPokemon, setUserPokemon] = useState([]);
  const [pokedex, setPokedex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPokemon, setSelectedPokemon] = useState(null);

  const searchUser = async () => {
    if (!userId.trim()) {
      setError('Please enter a user ID');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const [userRes, pokemonRes, pokedexRes] = await Promise.all([
        axios.get(`${API}/users/${userId}`),
        axios.get(`${API}/users/${userId}/pokemon?limit=12`),
        axios.get(`${API}/users/${userId}/pokedex`),
      ]);
      
      setUser(userRes.data);
      setUserPokemon(pokemonRes.data);
      setPokedex(pokedexRes.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('User not found. Try a different ID.');
      } else {
        setError('Failed to fetch user data.');
      }
      setUser(null);
      setUserPokemon([]);
      setPokedex(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      searchUser();
    }
  };

  return (
    <div data-testid="user-lookup-page" className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
          Trainer Lookup
        </h1>
        <p className="text-slate-400 mt-1">
          Search for a trainer by their Discord user ID
        </p>
      </div>

      {/* Search */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              data-testid="user-search-input"
              placeholder="Enter Discord User ID (e.g., 123456789012345678)"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-10 bg-slate-950 border-slate-800 focus:border-yellow-500/50"
            />
          </div>
          <Button
            data-testid="user-search-btn"
            onClick={searchUser}
            disabled={loading}
            className="bg-yellow-500 text-black hover:bg-yellow-400 font-bold uppercase tracking-wide neon-yellow"
          >
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>
        
        {error && (
          <p className="mt-4 text-red-400 text-sm">{error}</p>
        )}
      </div>

      {/* User Profile */}
      {user && (
        <div className="space-y-6">
          {/* User Info Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md overflow-hidden">
            <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-yellow-500/10 to-transparent">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-yellow-500/50 flex items-center justify-center">
                  <User className="w-8 h-8 text-yellow-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {user.username}
                  </h2>
                  <p className="text-slate-400 stat-text text-sm">
                    ID: {user.user_id}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-800">
              <div className="p-4 text-center">
                <Database className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                <p className="stat-text text-2xl font-bold text-white">
                  {user.total_catches?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-slate-500 uppercase">Catches</p>
              </div>
              <div className="p-4 text-center">
                <Sparkles className="w-5 h-5 text-pink-400 mx-auto mb-2" />
                <p className="stat-text text-2xl font-bold text-white">
                  {user.shiny_catches?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-slate-500 uppercase">Shinies</p>
              </div>
              <div className="p-4 text-center">
                <BookOpen className="w-5 h-5 text-green-400 mx-auto mb-2" />
                <p className="stat-text text-2xl font-bold text-white">
                  {user.pokedex?.length || 0}
                </p>
                <p className="text-xs text-slate-500 uppercase">Dex Entries</p>
              </div>
              <div className="p-4 text-center">
                <Calendar className="w-5 h-5 text-yellow-400 mx-auto mb-2" />
                <p className="stat-text text-2xl font-bold text-white">
                  ${user.balance?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-slate-500 uppercase">Balance</p>
              </div>
            </div>
          </div>

          {/* Pokedex Progress */}
          {pokedex && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-green-400" />
                Pokédex Progress
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(pokedex).map(([region, data]) => (
                  <div 
                    key={region}
                    className="p-4 rounded-lg bg-slate-800/50 border border-slate-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-white capitalize">
                        {region}
                      </span>
                      <Badge variant="outline" className="border-slate-600 text-slate-300 stat-text">
                        {data.caught}/{data.total}
                      </Badge>
                    </div>
                    <Progress 
                      value={data.percentage} 
                      className="h-2 bg-slate-700"
                    />
                    <p className="text-right text-xs text-slate-500 mt-1 stat-text">
                      {data.percentage}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User's Pokemon */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-400" />
                Recent Pokémon
              </h3>
              <span className="text-sm text-slate-500">
                {userPokemon.length} shown
              </span>
            </div>
            
            <div className="p-4">
              {userPokemon.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {userPokemon.map((p) => (
                    <PokemonCard
                      key={p.instance_id}
                      pokemon={p.pokemon_data}
                      isShiny={p.is_shiny}
                      onClick={() => setSelectedPokemon(p.pokemon_data)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-500 py-8">
                  No Pokémon in collection yet
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!user && !loading && !error && (
        <div className="text-center py-16">
          <User className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-400 mb-2">
            Search for a Trainer
          </h3>
          <p className="text-slate-500 max-w-md mx-auto">
            Enter a Discord user ID to view their trainer profile, collection, and Pokédex progress.
          </p>
        </div>
      )}

      {/* Pokemon Detail Modal */}
      <PokemonDetailModal
        pokemon={selectedPokemon}
        isOpen={!!selectedPokemon}
        onClose={() => setSelectedPokemon(null)}
      />
    </div>
  );
}
