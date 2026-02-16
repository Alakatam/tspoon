import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  BookOpen, 
  Trophy, 
  Users, 
  Zap,
  Menu,
  X,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/pokedex', label: 'Pokédex', icon: BookOpen },
  { path: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { path: '/users', label: 'Trainers', icon: Users },
  { path: '/types', label: 'Type Chart', icon: Zap },
];

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-950 grid-pattern">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-yellow-500 flex items-center justify-center neon-yellow">
                <Sparkles className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Twisted Spoon
                </h1>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                  Pokémon Bot
                </p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Menu Button */}
            <button
              data-testid="mobile-menu-btn"
              className="md:hidden p-2 text-slate-400 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-slate-800 bg-slate-900">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-6 py-4 text-sm font-medium border-b border-slate-800 transition-colors",
                    isActive
                      ? "bg-yellow-500/10 text-yellow-400"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <p>© 2025 PokeQuest Bot. Not affiliated with Pokémon or Nintendo.</p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 pulse-live" />
                Bot Online
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
