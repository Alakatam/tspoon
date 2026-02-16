import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Grid, List, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { PokemonCard, PokemonCardSkeleton } from '../components/pokemon/PokemonCard';
import { PokemonDetailModal } from '../components/pokemon/PokemonDetailModal';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import axios from 'axios';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const REGIONS = [
  { value: 'all', label: 'All Regions' },
  { value: 'kanto', label: 'Kanto (1-151)' },
  { value: 'johto', label: 'Johto (152-251)' },
  { value: 'hoenn', label: 'Hoenn (252-386)' },
  { value: 'sinnoh', label: 'Sinnoh (387-493)' },
  { value: 'unova', label: 'Unova (494-649)' },
  { value: 'kalos', label: 'Kalos (650-721)' },
  { value: 'alola', label: 'Alola (722-809)' },
  { value: 'galar', label: 'Galar (810-905)' },
];

const TYPES = [
  'all', 'fire', 'water', 'grass', 'electric', 'psychic', 'ghost', 'dragon',
  'dark', 'steel', 'fairy', 'normal', 'fighting', 'flying', 'poison',
  'ground', 'rock', 'bug', 'ice'
];

export default function Pokedex() {
  const [pokemon, setPokemon] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState('grid');
  
  const ITEMS_PER_PAGE = 30;

  const fetchPokemon = useCallback(async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        skip: String(page * ITEMS_PER_PAGE),
        limit: String(ITEMS_PER_PAGE),
      });
      
      if (search) params.append('search', search);
      if (typeFilter !== 'all') params.append('type_filter', typeFilter);
      if (regionFilter !== 'all') params.append('region', regionFilter);
      
      const [pokemonRes, countRes] = await Promise.all([
        axios.get(`${API}/pokemon?${params.toString()}`),
        axios.get(`${API}/pokemon/count/total`),
      ]);
      
      setPokemon(pokemonRes.data);
      setTotalCount(countRes.data.count);
    } catch (error) {
      console.error('Error fetching Pokemon:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, regionFilter]);

  useEffect(() => {
    fetchPokemon();
  }, [fetchPokemon]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [search, typeFilter, regionFilter]);

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setRegionFilter('all');
    setPage(0);
  };

  const hasFilters = search || typeFilter !== 'all' || regionFilter !== 'all';
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div data-testid="pokedex-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Pokédex
          </h1>
          <p className="text-slate-400 mt-1">
            Browse all {totalCount} Pokémon in the database
          </p>
        </div>
        
        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className={viewMode === 'grid' ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'border-slate-700'}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            className={viewMode === 'list' ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'border-slate-700'}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              data-testid="pokedex-search"
              placeholder="Search Pokémon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-950 border-slate-800 focus:border-yellow-500/50"
            />
          </div>
          
          {/* Type Filter */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger 
              data-testid="type-filter"
              className="w-full md:w-[180px] bg-slate-950 border-slate-800"
            >
              <Filter className="w-4 h-4 mr-2 text-slate-500" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800">
              {TYPES.map((type) => (
                <SelectItem key={type} value={type} className="capitalize">
                  {type === 'all' ? 'All Types' : type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Region Filter */}
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger 
              data-testid="region-filter"
              className="w-full md:w-[200px] bg-slate-950 border-slate-800"
            >
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800">
              {REGIONS.map((region) => (
                <SelectItem key={region.value} value={region.value}>
                  {region.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Clear Filters */}
          {hasFilters && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
        
        {/* Active Filters */}
        {hasFilters && (
          <div className="flex flex-wrap gap-2 mt-4">
            {search && (
              <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                Search: {search}
              </Badge>
            )}
            {typeFilter !== 'all' && (
              <Badge className={`type-${typeFilter} capitalize`}>
                {typeFilter}
              </Badge>
            )}
            {regionFilter !== 'all' && (
              <Badge variant="secondary" className="bg-slate-800 text-slate-300 capitalize">
                {regionFilter}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Pokemon Grid */}
      <div className={cn(
        viewMode === 'grid'
          ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
          : "flex flex-col gap-2"
      )}>
        {loading ? (
          Array(ITEMS_PER_PAGE).fill(0).map((_, i) => (
            <PokemonCardSkeleton key={i} />
          ))
        ) : pokemon.length > 0 ? (
          pokemon.map((p) => (
            viewMode === 'grid' ? (
              <PokemonCard
                key={p.id}
                pokemon={p}
                onClick={() => setSelectedPokemon(p)}
              />
            ) : (
              <div
                key={p.id}
                onClick={() => setSelectedPokemon(p)}
                className="flex items-center gap-4 p-3 rounded-lg border border-slate-800 bg-slate-900/60 hover:border-slate-600 cursor-pointer transition-colors"
              >
                <img
                  src={p.sprite}
                  alt={p.name}
                  className="w-12 h-12 object-contain"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="stat-text text-slate-500 text-sm">
                      #{String(p.id).padStart(3, '0')}
                    </span>
                    <h3 className="font-semibold text-white capitalize truncate">
                      {p.name}
                    </h3>
                  </div>
                  <div className="flex gap-1 mt-1">
                    {p.types?.map((type) => (
                      <span
                        key={type}
                        className={`type-${type} px-2 py-0.5 rounded text-xs font-semibold uppercase`}
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-slate-500">No Pokémon found matching your filters</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="border-slate-700 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          
          <span className="text-slate-400 stat-text">
            Page {page + 1} of {totalPages}
          </span>
          
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="border-slate-700 disabled:opacity-50"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
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
