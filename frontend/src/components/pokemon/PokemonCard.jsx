import { cn } from '../../lib/utils';
import { Sparkles } from 'lucide-react';

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

export function PokemonCard({ pokemon, isShiny = false, onClick }) {
  const primaryType = pokemon?.types?.[0] || 'normal';
  const bgColor = TYPE_COLORS[primaryType] || TYPE_COLORS.normal;

  return (
    <div
      data-testid={`pokemon-card-${pokemon?.id}`}
      onClick={onClick}
      className={cn(
        "pokemon-card relative rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md overflow-hidden cursor-pointer group",
        "hover:border-slate-600"
      )}
    >
      {/* Type Color Accent */}
      <div className={cn("absolute top-0 left-0 right-0 h-1", bgColor)} />

      {/* Shiny Indicator */}
      {isShiny && (
        <div className="absolute top-3 right-3 z-10">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-yellow-500 via-pink-500 to-blue-500 text-xs font-bold text-white">
            <Sparkles className="w-3 h-3" />
            SHINY
          </div>
        </div>
      )}

      {/* Pokemon Image */}
      <div className="relative pt-6 pb-2 px-4">
        <div className="aspect-square relative flex items-center justify-center">
          <div className={cn(
            "absolute inset-0 rounded-full opacity-20 blur-2xl transition-opacity",
            bgColor,
            "group-hover:opacity-40"
          )} />
          <img
            src={isShiny && pokemon?.sprite_shiny ? pokemon.sprite_shiny : pokemon?.sprite}
            alt={pokemon?.name}
            className="relative w-full h-full object-contain drop-shadow-2xl transition-transform group-hover:scale-110"
            loading="lazy"
          />
        </div>
      </div>

      {/* Pokemon Info */}
      <div className="p-4 pt-0">
        <div className="flex items-center justify-between mb-2">
          <span className="stat-text text-slate-500 text-sm font-semibold">
            #{String(pokemon?.id).padStart(3, '0')}
          </span>
          <span className="stat-text text-slate-500 text-xs">
            Gen {pokemon?.generation}
          </span>
        </div>
        
        <h3 className="text-lg font-bold text-white capitalize mb-3">
          {pokemon?.name}
        </h3>

        {/* Type Badges */}
        <div className="flex gap-2">
          {pokemon?.types?.map((type) => (
            <span
              key={type}
              className={cn(
                "px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide",
                `type-${type}`
              )}
            >
              {type}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PokemonCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden animate-pulse">
      <div className="h-1 bg-slate-700" />
      <div className="p-4">
        <div className="aspect-square bg-slate-800 rounded-lg mb-4" />
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-2" />
        <div className="h-6 bg-slate-800 rounded w-2/3 mb-3" />
        <div className="flex gap-2">
          <div className="h-5 bg-slate-800 rounded w-16" />
          <div className="h-5 bg-slate-800 rounded w-16" />
        </div>
      </div>
    </div>
  );
}
