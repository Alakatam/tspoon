import { useState, useEffect } from 'react';
import { Zap, Info } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import axios from 'axios';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TYPE_COLORS = {
  normal: { bg: 'bg-gray-400', text: 'text-black' },
  fire: { bg: 'bg-red-500', text: 'text-white' },
  water: { bg: 'bg-blue-500', text: 'text-white' },
  electric: { bg: 'bg-yellow-500', text: 'text-black' },
  grass: { bg: 'bg-green-500', text: 'text-white' },
  ice: { bg: 'bg-cyan-400', text: 'text-black' },
  fighting: { bg: 'bg-red-700', text: 'text-white' },
  poison: { bg: 'bg-purple-600', text: 'text-white' },
  ground: { bg: 'bg-amber-600', text: 'text-white' },
  flying: { bg: 'bg-violet-400', text: 'text-black' },
  psychic: { bg: 'bg-pink-500', text: 'text-white' },
  bug: { bg: 'bg-lime-600', text: 'text-white' },
  rock: { bg: 'bg-stone-500', text: 'text-white' },
  ghost: { bg: 'bg-violet-700', text: 'text-white' },
  dragon: { bg: 'bg-indigo-600', text: 'text-white' },
  dark: { bg: 'bg-gray-800', text: 'text-white' },
  steel: { bg: 'bg-slate-400', text: 'text-black' },
  fairy: { bg: 'bg-pink-400', text: 'text-black' },
};

const TYPES_ORDER = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'
];

export default function TypeChart() {
  const [typeChart, setTypeChart] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedAttacking, setSelectedAttacking] = useState(null);

  useEffect(() => {
    fetchTypeChart();
  }, []);

  const fetchTypeChart = async () => {
    try {
      const response = await axios.get(`${API}/types/chart`);
      setTypeChart(response.data);
    } catch (error) {
      console.error('Error fetching type chart:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEffectiveness = (attacking, defending) => {
    if (!typeChart[attacking]) return 1;
    return typeChart[attacking][defending] ?? 1;
  };

  const getEffectivenessStyle = (value) => {
    if (value === 0) return { bg: 'bg-gray-900', text: 'text-gray-500', label: '0×' };
    if (value === 0.5) return { bg: 'bg-red-900/50', text: 'text-red-400', label: '½×' };
    if (value === 2) return { bg: 'bg-green-900/50', text: 'text-green-400', label: '2×' };
    return { bg: 'bg-slate-800', text: 'text-slate-500', label: '1×' };
  };

  return (
    <div data-testid="type-chart-page" className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight flex items-center gap-3">
          <Zap className="w-8 h-8 text-yellow-400" />
          Type Effectiveness Chart
        </h1>
        <p className="text-slate-400 mt-1">
          See how different types interact in battle
        </p>
      </div>

      {/* Legend */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-4">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm text-slate-400 font-medium">Legend:</span>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded flex items-center justify-center bg-green-900/50">
              <span className="text-green-400 stat-text font-bold text-sm">2×</span>
            </div>
            <span className="text-sm text-slate-300">Super Effective</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded flex items-center justify-center bg-red-900/50">
              <span className="text-red-400 stat-text font-bold text-sm">½×</span>
            </div>
            <span className="text-sm text-slate-300">Not Very Effective</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded flex items-center justify-center bg-gray-900">
              <span className="text-gray-500 stat-text font-bold text-sm">0×</span>
            </div>
            <span className="text-sm text-slate-300">No Effect</span>
          </div>
        </div>
      </div>

      {/* Type Chart Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full mx-auto" />
              <p className="text-slate-400 mt-4">Loading type chart...</p>
            </div>
          ) : (
            <table className="w-full min-w-[900px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-slate-900 p-3 border-b border-r border-slate-800">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Info className="w-3 h-3" />
                      <span>ATK → DEF</span>
                    </div>
                  </th>
                  {TYPES_ORDER.map((type) => (
                    <th 
                      key={type}
                      className="p-2 border-b border-slate-800 min-w-[50px]"
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className={cn(
                              "w-full py-1.5 px-1 rounded text-[10px] font-bold uppercase tracking-wider",
                              TYPE_COLORS[type].bg,
                              TYPE_COLORS[type].text
                            )}>
                              {type.slice(0, 3)}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-800 border-slate-700">
                            <span className="capitalize">{type}</span>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TYPES_ORDER.map((attackingType) => (
                  <tr 
                    key={attackingType}
                    className={cn(
                      "transition-colors",
                      selectedAttacking === attackingType && "bg-slate-800/50"
                    )}
                    onMouseEnter={() => setSelectedAttacking(attackingType)}
                    onMouseLeave={() => setSelectedAttacking(null)}
                  >
                    <th 
                      className={cn(
                        "sticky left-0 z-10 p-2 border-r border-slate-800 transition-colors",
                        selectedAttacking === attackingType ? "bg-slate-800" : "bg-slate-900"
                      )}
                    >
                      <div className={cn(
                        "py-1.5 px-3 rounded text-xs font-bold uppercase tracking-wider inline-block",
                        TYPE_COLORS[attackingType].bg,
                        TYPE_COLORS[attackingType].text
                      )}>
                        {attackingType}
                      </div>
                    </th>
                    {TYPES_ORDER.map((defendingType) => {
                      const effectiveness = getEffectiveness(attackingType, defendingType);
                      const style = getEffectivenessStyle(effectiveness);
                      
                      return (
                        <td 
                          key={defendingType}
                          className="p-1.5 text-center border-b border-slate-800/50"
                        >
                          <div className={cn(
                            "w-full py-1.5 rounded stat-text text-xs font-bold",
                            style.bg,
                            style.text
                          )}>
                            {effectiveness !== 1 ? style.label : ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Quick Reference Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {TYPES_ORDER.map((type) => {
          const typeData = typeChart[type] || {};
          const superEffective = Object.entries(typeData).filter(([, v]) => v === 2).map(([t]) => t);
          const notVeryEffective = Object.entries(typeData).filter(([, v]) => v === 0.5).map(([t]) => t);
          const noEffect = Object.entries(typeData).filter(([, v]) => v === 0).map(([t]) => t);
          
          return (
            <div 
              key={type}
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 hover:border-slate-600 transition-colors"
            >
              <Badge className={cn(
                "w-full justify-center mb-3 py-1",
                TYPE_COLORS[type].bg,
                TYPE_COLORS[type].text
              )}>
                {type}
              </Badge>
              
              {superEffective.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] text-green-400 uppercase tracking-wider mb-1">Strong vs</p>
                  <div className="flex flex-wrap gap-1">
                    {superEffective.slice(0, 4).map((t) => (
                      <span key={t} className="text-[10px] text-slate-300 capitalize bg-slate-800 px-1.5 py-0.5 rounded">
                        {t.slice(0, 3)}
                      </span>
                    ))}
                    {superEffective.length > 4 && (
                      <span className="text-[10px] text-slate-500">+{superEffective.length - 4}</span>
                    )}
                  </div>
                </div>
              )}
              
              {notVeryEffective.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] text-red-400 uppercase tracking-wider mb-1">Weak vs</p>
                  <div className="flex flex-wrap gap-1">
                    {notVeryEffective.slice(0, 4).map((t) => (
                      <span key={t} className="text-[10px] text-slate-300 capitalize bg-slate-800 px-1.5 py-0.5 rounded">
                        {t.slice(0, 3)}
                      </span>
                    ))}
                    {notVeryEffective.length > 4 && (
                      <span className="text-[10px] text-slate-500">+{notVeryEffective.length - 4}</span>
                    )}
                  </div>
                </div>
              )}
              
              {noEffect.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">No effect</p>
                  <div className="flex flex-wrap gap-1">
                    {noEffect.map((t) => (
                      <span key={t} className="text-[10px] text-slate-400 capitalize bg-slate-800 px-1.5 py-0.5 rounded">
                        {t.slice(0, 3)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
