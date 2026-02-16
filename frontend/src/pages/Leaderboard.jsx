import { useState, useEffect } from 'react';
import { Trophy, Sparkles, BookOpen, RefreshCw } from 'lucide-react';
import { LeaderboardItem, LeaderboardSkeleton } from '../components/dashboard/LeaderboardItem';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Leaderboard() {
  const [catchesLeaderboard, setCatchesLeaderboard] = useState([]);
  const [shiniesLeaderboard, setShiniesLeaderboard] = useState([]);
  const [dexLeaderboard, setDexLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboards = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      const [catchesRes, shiniesRes, dexRes] = await Promise.all([
        axios.get(`${API}/leaderboard/catches?limit=20`),
        axios.get(`${API}/leaderboard/shinies?limit=20`),
        axios.get(`${API}/leaderboard/dex?limit=20`),
      ]);
      
      setCatchesLeaderboard(catchesRes.data);
      setShiniesLeaderboard(shiniesRes.data);
      setDexLeaderboard(dexRes.data);
    } catch (error) {
      console.error('Error fetching leaderboards:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboards();
  }, []);

  const LeaderboardSection = ({ data, label, emptyMessage }) => (
    <div className="space-y-3">
      {loading ? (
        Array(10).fill(0).map((_, i) => <LeaderboardSkeleton key={i} />)
      ) : data.length > 0 ? (
        data.map((entry) => (
          <LeaderboardItem
            key={entry.user_id}
            rank={entry.rank}
            username={entry.username}
            value={entry.value}
            label={label}
          />
        ))
      ) : (
        <div className="text-center py-12 text-slate-500">
          {emptyMessage}
        </div>
      )}
    </div>
  );

  return (
    <div data-testid="leaderboard-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Leaderboard
          </h1>
          <p className="text-slate-400 mt-1">
            See how you rank against other trainers
          </p>
        </div>
        
        <Button
          variant="outline"
          onClick={() => fetchLeaderboards(true)}
          disabled={refreshing}
          className="border-slate-700 text-slate-300 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Leaderboard Tabs */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md overflow-hidden">
        <Tabs defaultValue="catches" className="w-full">
          <div className="border-b border-slate-800 p-4">
            <TabsList className="grid grid-cols-3 bg-slate-800/50 p-1 rounded-lg">
              <TabsTrigger 
                value="catches"
                className="flex items-center gap-2 data-[state=active]:bg-yellow-500 data-[state=active]:text-black rounded-md"
              >
                <Trophy className="w-4 h-4" />
                <span className="hidden sm:inline">Total Catches</span>
                <span className="sm:hidden">Catches</span>
              </TabsTrigger>
              <TabsTrigger 
                value="shinies"
                className="flex items-center gap-2 data-[state=active]:bg-yellow-500 data-[state=active]:text-black rounded-md"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Shiny Hunters</span>
                <span className="sm:hidden">Shinies</span>
              </TabsTrigger>
              <TabsTrigger 
                value="dex"
                className="flex items-center gap-2 data-[state=active]:bg-yellow-500 data-[state=active]:text-black rounded-md"
              >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Dex Completion</span>
                <span className="sm:hidden">Dex</span>
              </TabsTrigger>
            </TabsList>
          </div>
          
          <div className="p-4 md:p-6">
            <TabsContent value="catches" className="mt-0">
              <LeaderboardSection 
                data={catchesLeaderboard} 
                label="catches"
                emptyMessage="No catches recorded yet. Start catching Pokémon!"
              />
            </TabsContent>
            
            <TabsContent value="shinies" className="mt-0">
              <LeaderboardSection 
                data={shiniesLeaderboard} 
                label="shinies"
                emptyMessage="No shinies found yet. Keep hunting!"
              />
            </TabsContent>
            
            <TabsContent value="dex" className="mt-0">
              <LeaderboardSection 
                data={dexLeaderboard} 
                label="in Pokédex"
                emptyMessage="No Pokédex entries yet. Start completing your dex!"
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center">
          <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
          <h3 className="text-sm text-slate-400 uppercase tracking-wider mb-1">
            Top Catcher
          </h3>
          <p className="text-xl font-bold text-white">
            {catchesLeaderboard[0]?.username || '-'}
          </p>
          <p className="stat-text text-slate-500">
            {catchesLeaderboard[0]?.value?.toLocaleString() || 0} catches
          </p>
        </div>
        
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center">
          <Sparkles className="w-8 h-8 text-pink-400 mx-auto mb-3" />
          <h3 className="text-sm text-slate-400 uppercase tracking-wider mb-1">
            Shiny Master
          </h3>
          <p className="text-xl font-bold text-white">
            {shiniesLeaderboard[0]?.username || '-'}
          </p>
          <p className="stat-text text-slate-500">
            {shiniesLeaderboard[0]?.value?.toLocaleString() || 0} shinies
          </p>
        </div>
        
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center">
          <BookOpen className="w-8 h-8 text-blue-400 mx-auto mb-3" />
          <h3 className="text-sm text-slate-400 uppercase tracking-wider mb-1">
            Dex Champion
          </h3>
          <p className="text-xl font-bold text-white">
            {dexLeaderboard[0]?.username || '-'}
          </p>
          <p className="stat-text text-slate-500">
            {dexLeaderboard[0]?.value?.toLocaleString() || 0} entries
          </p>
        </div>
      </div>
    </div>
  );
}
