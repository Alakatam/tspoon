import { cn } from '../../lib/utils';
import { Trophy, Medal, Award } from 'lucide-react';

const RANK_STYLES = {
  1: {
    bg: 'bg-gradient-to-r from-yellow-500/20 to-amber-500/10',
    border: 'border-yellow-500/50',
    text: 'text-yellow-400',
    icon: Trophy,
    glow: 'shadow-[0_0_20px_rgba(234,179,8,0.2)]'
  },
  2: {
    bg: 'bg-gradient-to-r from-slate-400/20 to-slate-300/10',
    border: 'border-slate-400/50',
    text: 'text-slate-300',
    icon: Medal,
    glow: 'shadow-[0_0_15px_rgba(148,163,184,0.2)]'
  },
  3: {
    bg: 'bg-gradient-to-r from-orange-600/20 to-amber-700/10',
    border: 'border-orange-500/50',
    text: 'text-orange-400',
    icon: Award,
    glow: 'shadow-[0_0_15px_rgba(234,88,12,0.2)]'
  }
};

export function LeaderboardItem({ rank, username, value, label = "catches", avatar }) {
  const style = RANK_STYLES[rank];
  const isTopThree = rank <= 3;

  return (
    <div
      data-testid={`leaderboard-item-${rank}`}
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl border transition-all duration-300",
        isTopThree 
          ? cn(style?.bg, style?.border, style?.glow)
          : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
      )}
    >
      {/* Rank */}
      <div className={cn(
        "flex items-center justify-center w-12 h-12 rounded-lg font-bold stat-text text-lg",
        isTopThree 
          ? cn("bg-slate-900/50", style?.text) 
          : "bg-slate-800 text-slate-400"
      )}>
        {isTopThree && style?.icon ? (
          <style.icon className="w-6 h-6" />
        ) : (
          `#${rank}`
        )}
      </div>

      {/* Avatar & Name */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
          {avatar ? (
            <img src={avatar} alt={username} className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-slate-400">
              {username?.charAt(0)?.toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <h4 className={cn(
            "font-semibold truncate",
            isTopThree ? "text-white" : "text-slate-200"
          )}>
            {username}
          </h4>
          <p className="text-xs text-slate-500 capitalize">{label}</p>
        </div>
      </div>

      {/* Value */}
      <div className="text-right">
        <span className={cn(
          "stat-text text-2xl font-bold",
          isTopThree ? style?.text : "text-slate-300"
        )}>
          {value.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/40 animate-pulse">
      <div className="w-12 h-12 rounded-lg bg-slate-800" />
      <div className="flex items-center gap-3 flex-1">
        <div className="w-10 h-10 rounded-full bg-slate-800" />
        <div className="space-y-2">
          <div className="h-4 bg-slate-800 rounded w-24" />
          <div className="h-3 bg-slate-800 rounded w-16" />
        </div>
      </div>
      <div className="w-16 h-8 bg-slate-800 rounded" />
    </div>
  );
}
