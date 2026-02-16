import { cn } from '../../lib/utils';
import { X, Sparkles, Ruler, Scale, Star, Swords } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Progress } from '../ui/progress';

const TYPE_COLORS = {
  fire: 'bg-red-500',
  water: 'bg-blue-500',
  grass: 'bg-green-500',
  electric: 'bg-yellow-500',
  psychic: 'bg-purple-500',
  ghost: 'bg-violet-600',
  dragon: 'bg-indigo-500',
  dark: 'bg-gray-700',
  steel: 'bg-slate-400',
  fairy: 'bg-pink-400',
  normal: 'bg-gray-400',
  fighting: 'bg-red-700',
  flying: 'bg-violet-400',
  poison: 'bg-purple-600',
  ground: 'bg-amber-600',
  rock: 'bg-stone-500',
  bug: 'bg-lime-600',
  ice: 'bg-cyan-400',
};

const STAT_COLORS = {
  hp: 'bg-red-500',
  attack: 'bg-orange-500',
  defense: 'bg-yellow-500',
  sp_attack: 'bg-blue-500',
  sp_defense: 'bg-green-500',
  speed: 'bg-pink-500',
};

const STAT_LABELS = {
  hp: 'HP',
  attack: 'ATK',
  defense: 'DEF',
  sp_attack: 'SP.ATK',
  sp_defense: 'SP.DEF',
  speed: 'SPD',
};

export function PokemonDetailModal({ pokemon, isOpen, onClose }) {
  if (!pokemon) return null;

  const primaryType = pokemon.types?.[0] || 'normal';
  const bgColor = TYPE_COLORS[primaryType] || TYPE_COLORS.normal;
  const totalStats = pokemon.stats ? Object.values(pokemon.stats).reduce((a, b) => a + b, 0) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-700 p-0 overflow-hidden">
        {/* Header with type color */}
        <div className={cn("relative p-6 pb-24", bgColor, "bg-opacity-20")}>
          <div className={cn("absolute inset-0", bgColor, "opacity-10")} />
          
          <DialogHeader className="relative z-10">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl font-bold text-white capitalize flex items-center gap-3">
                {pokemon.name}
                <span className="stat-text text-slate-400 text-lg font-semibold">
                  #{String(pokemon.id).padStart(3, '0')}
                </span>
              </DialogTitle>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </DialogHeader>

          {/* Pokemon Image */}
          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2">
            <div className="relative w-40 h-40">
              <div className={cn(
                "absolute inset-0 rounded-full blur-3xl opacity-50",
                bgColor
              )} />
              <img
                src={pokemon.sprite}
                alt={pokemon.name}
                className="relative w-full h-full object-contain drop-shadow-2xl"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 pt-20 space-y-6">
          {/* Type Badges */}
          <div className="flex items-center justify-center gap-3">
            {pokemon.types?.map((type) => (
              <span
                key={type}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wider",
                  `type-${type}`
                )}
              >
                {type}
              </span>
            ))}
          </div>

          {/* Quick Info */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <Ruler className="w-5 h-5 text-slate-400 mb-2" />
              <span className="stat-text text-xl font-bold text-white">
                {(pokemon.height / 10).toFixed(1)}m
              </span>
              <span className="text-xs text-slate-500 uppercase">Height</span>
            </div>
            <div className="flex flex-col items-center p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <Scale className="w-5 h-5 text-slate-400 mb-2" />
              <span className="stat-text text-xl font-bold text-white">
                {(pokemon.weight / 10).toFixed(1)}kg
              </span>
              <span className="text-xs text-slate-500 uppercase">Weight</span>
            </div>
            <div className="flex flex-col items-center p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <Star className="w-5 h-5 text-slate-400 mb-2" />
              <span className="stat-text text-xl font-bold text-white capitalize">
                {pokemon.region}
              </span>
              <span className="text-xs text-slate-500 uppercase">Region</span>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Base Stats
              </h4>
              <span className="stat-text text-sm text-slate-500">
                Total: <span className="text-white font-bold">{totalStats}</span>
              </span>
            </div>
            
            {pokemon.stats && Object.entries(pokemon.stats).map(([stat, value]) => (
              <div key={stat} className="flex items-center gap-4">
                <span className="stat-text w-16 text-xs font-semibold text-slate-400 uppercase">
                  {STAT_LABELS[stat]}
                </span>
                <span className="stat-text w-10 text-sm font-bold text-white text-right">
                  {value}
                </span>
                <div className="flex-1">
                  <Progress 
                    value={(value / 255) * 100} 
                    className="h-2 bg-slate-800"
                    indicatorClassName={STAT_COLORS[stat]}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Abilities */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Swords className="w-4 h-4" />
              Abilities
            </h4>
            <div className="flex flex-wrap gap-2">
              {pokemon.abilities?.map((ability) => (
                <span
                  key={ability}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300 capitalize"
                >
                  {ability.replace('-', ' ')}
                </span>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
