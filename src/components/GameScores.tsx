import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

interface GameScore {
  id: string;
  player_score: number;
  opponent_score: number;
  game_mode: string;
  game_status: string;
  created_at: string;
  profiles: {
    username: string;
  } | null;
}

export const GameScores = () => {
  const [scores, setScores] = useState<GameScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScores();
  }, []);

  const fetchScores = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('game_scores')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      
      // Get user profile for display name
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('user_id', user.id)
        .single();

      const scoresWithProfile = (data || []).map(score => ({
        ...score,
        profiles: profile
      }));
      
      setScores(scoresWithProfile);
    } catch (error) {
      console.error('Error fetching scores:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Recent Games</h3>
        <div className="text-muted-foreground">Loading...</div>
      </Card>
    );
  }

  if (scores.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Recent Games</h3>
        <div className="text-muted-foreground">No games played yet</div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-3">Recent Games</h3>
      <div className="space-y-2">
        {scores.map((score) => (
          <div key={score.id} className="flex justify-between items-center p-2 border rounded">
            <div className="flex items-center gap-2">
              <span className="font-medium">{score.profiles?.username || 'Unknown Player'}</span>
              <span className="text-xs px-2 py-1 bg-secondary rounded">
                {score.game_mode === 'single' ? 'vs AI' : 'Multiplayer'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-bold ${score.player_score > score.opponent_score ? 'text-green-600' : 'text-red-600'}`}>
                {score.player_score} - {score.opponent_score}
              </span>
              <span className={`text-xs px-2 py-1 rounded ${
                score.game_status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {score.game_status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};