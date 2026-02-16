import { cn } from '../../lib/utils';

export function StatsCard({ title, value, icon: Icon, trend, trendValue, className }) {
  return (
    <div
      data-testid={`stats-card-${title?.toLowerCase().replace(/\s+/g, '-')}`}
      className={cn(
        "relative rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6 overflow-hidden group",
        "hover:border-slate-600 transition-all duration-300",
        className
      )}
    >
      {/* Background Glow */}
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-yellow-500/5 blur-3xl group-hover:bg-yellow-500/10 transition-colors" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700">
            {Icon && <Icon className="w-5 h-5 text-yellow-400" />}
          </div>
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium",
              trend === 'up' ? 'text-green-400' : 'text-red-400'
            )}>
              {trend === 'up' ? '↑' : '↓'} {trendValue}
            </div>
          )}
        </div>
        
        <h3 className="stat-text text-3xl md:text-4xl font-bold text-white mb-1">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </h3>
        
        <p className="text-sm text-slate-400 font-medium">
          {title}
        </p>
      </div>
    </div>
  );
}

export function StatsCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 animate-pulse">
      <div className="w-11 h-11 rounded-lg bg-slate-800 mb-4" />
      <div className="h-10 bg-slate-800 rounded w-24 mb-2" />
      <div className="h-4 bg-slate-800 rounded w-32" />
    </div>
  );
}
