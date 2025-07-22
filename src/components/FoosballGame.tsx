import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GameScores } from "@/components/GameScores";
import { useMultiplayerRoom } from "@/hooks/useMultiplayerRoom";
import { MultiplayerControls } from "./MultiplayerControls";

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Player {
  y: number;
  team: 'red' | 'blue';
  rod: number;
}

interface GameState {
  ball: Ball;
  players: Player[];
  score: { red: number; blue: number };
  gameStatus: 'waiting' | 'playing' | 'paused' | 'goal' | 'ended';
  gameMode: 'single' | 'multi' | null;
}

const FIELD_WIDTH = 800;
const FIELD_HEIGHT = 400;
const BALL_SIZE = 12;
const PLAYER_HEIGHT = 60;
const GOAL_WIDTH = 80;
const PLAYER_SPEED = 300;

export const FoosballGame = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const keysRef = useRef<Set<string>>(new Set());
  const lastTimeRef = useRef<number>(0);
  const playersRef = useRef<Player[]>([
    { y: FIELD_HEIGHT / 2, team: 'red', rod: 1 },
    { y: FIELD_HEIGHT / 2, team: 'red', rod: 2 },
    { y: FIELD_HEIGHT / 2, team: 'red', rod: 3 },
    { y: FIELD_HEIGHT / 2, team: 'blue', rod: 4 },
    { y: FIELD_HEIGHT / 2, team: 'blue', rod: 5 },
    { y: FIELD_HEIGHT / 2, team: 'blue', rod: 6 },
  ]);
  
  const [gameState, setGameState] = useState<GameState>({
    ball: { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0 },
    players: [
      { y: FIELD_HEIGHT / 2, team: 'red', rod: 1 },
      { y: FIELD_HEIGHT / 2, team: 'red', rod: 2 },
      { y: FIELD_HEIGHT / 2, team: 'red', rod: 3 },
      { y: FIELD_HEIGHT / 2, team: 'blue', rod: 4 },
      { y: FIELD_HEIGHT / 2, team: 'blue', rod: 5 },
      { y: FIELD_HEIGHT / 2, team: 'blue', rod: 6 },
    ],
    score: { red: 0, blue: 0 },
    gameStatus: 'waiting',
    gameMode: null
  });

  const [showGameModeSelection, setShowGameModeSelection] = useState(false);
  const { room, isCreator, isConnected, createRoom, joinRoom, updateGameState, leaveRoom } = useMultiplayerRoom();

  // Sync game state with multiplayer room
  useEffect(() => {
    if (room && room.game_state) {
      const roomState = room.game_state;
      setGameState(prev => ({
        ...prev,
        score: { 
          red: roomState.player1_score, 
          blue: roomState.player2_score 
        },
        gameStatus: roomState.game_status === 'waiting' ? 'waiting' : 
                   roomState.game_status === 'playing' ? 'playing' : 'ended',
        gameMode: 'multi'
      }));

      // Check if game should end
      if (roomState.player1_score >= 10 || roomState.player2_score >= 10) {
        setGameState(prev => ({ ...prev, gameStatus: 'ended' }));
        saveGameScore(
          isCreator ? roomState.player1_score : roomState.player2_score,
          isCreator ? roomState.player2_score : roomState.player1_score,
          'completed'
        );
      }
    }
  }, [room, isCreator]);

  // Create single player game
  const createSinglePlayerGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      gameStatus: 'waiting',
      gameMode: 'single'
    }));
    setShowGameModeSelection(false);
    toast("Single player game created!");
  }, []);

  // Create multiplayer game
  const createMultiPlayerGame = useCallback(async () => {
    await createRoom();
    setShowGameModeSelection(false);
  }, [createRoom]);

  // Start game
  const startGame = useCallback(async () => {
    if (gameState.gameMode === 'multi' && room) {
      await updateGameState({ game_status: 'playing' });
    }
    
    setGameState(prev => ({
      ...prev,
      gameStatus: 'playing',
      ball: { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 3, vy: 2 }
    }));
    toast("Game started!");
  }, [gameState.gameMode, room, updateGameState]);

  // Save game score to database
  const saveGameScore = useCallback(async (playerScore: number, opponentScore: number, status: 'completed' | 'quit') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('game_scores')
        .insert({
          user_id: user.id,
          player_score: playerScore,
          opponent_score: opponentScore,
          game_mode: gameState.gameMode || 'single',
          game_status: status
        });
    } catch (error) {
      console.error('Error saving game score:', error);
    }
  }, [gameState.gameMode]);

  // Quit game
  const quitGame = useCallback(async () => {
    if (gameState.score.red > 0 || gameState.score.blue > 0) {
      const playerScore = isCreator ? gameState.score.red : gameState.score.blue;
      const opponentScore = isCreator ? gameState.score.blue : gameState.score.red;
      await saveGameScore(playerScore, opponentScore, 'quit');
    }

    if (isConnected) {
      await leaveRoom();
    }

    setGameState({
      ball: { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0 },
      players: [
        { y: FIELD_HEIGHT / 2, team: 'red', rod: 1 },
        { y: FIELD_HEIGHT / 2, team: 'red', rod: 2 },
        { y: FIELD_HEIGHT / 2, team: 'red', rod: 3 },
        { y: FIELD_HEIGHT / 2, team: 'blue', rod: 4 },
        { y: FIELD_HEIGHT / 2, team: 'blue', rod: 5 },
        { y: FIELD_HEIGHT / 2, team: 'blue', rod: 6 },
      ],
      score: { red: 0, blue: 0 },
      gameStatus: 'waiting',
      gameMode: null
    });
    setShowGameModeSelection(false);
    toast("Game ended");
  }, [gameState.score, isCreator, isConnected, leaveRoom, saveGameScore]);

  // Reset ball position
  const resetBall = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      ball: { 
        x: FIELD_WIDTH / 2, 
        y: FIELD_HEIGHT / 2, 
        vx: Math.random() > 0.5 ? 3 : -3, 
        vy: (Math.random() - 0.5) * 4 
      },
      gameStatus: 'playing'
    }));
  }, []);

  // Update multiplayer score
  const updateMultiplayerScore = useCallback(async (redScore: number, blueScore: number) => {
    if (room && gameState.gameMode === 'multi') {
      await updateGameState({
        player1_score: redScore,
        player2_score: blueScore,
        game_status: redScore >= 10 || blueScore >= 10 ? 'finished' : 'playing'
      });
    }
  }, [room, gameState.gameMode, updateGameState]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Game physics and rendering
  useEffect(() => {
    if (gameState.gameStatus !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameLoop = (currentTime: number) => {
      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;
      
      const keys = keysRef.current;
      const moveDistance = PLAYER_SPEED * deltaTime;
      
      // Player controls based on team and game mode
      const playerTeam = isCreator ? 'red' : 'blue';
      
      if (gameState.gameMode === 'single' || (gameState.gameMode === 'multi' && playerTeam === 'red')) {
        if (keys.has('w')) {
          playersRef.current = playersRef.current.map(p => 
            p.team === 'red' ? { ...p, y: Math.max(PLAYER_HEIGHT/2, p.y - moveDistance) } : p
          );
        }
        if (keys.has('s')) {
          playersRef.current = playersRef.current.map(p => 
            p.team === 'red' ? { ...p, y: Math.min(FIELD_HEIGHT - PLAYER_HEIGHT/2, p.y + moveDistance) } : p
          );
        }
      }
      
      if (gameState.gameMode === 'multi' && playerTeam === 'blue') {
        if (keys.has('arrowup') || keys.has('up')) {
          playersRef.current = playersRef.current.map(p => 
            p.team === 'blue' ? { ...p, y: Math.max(PLAYER_HEIGHT/2, p.y - moveDistance) } : p
          );
        }
        if (keys.has('arrowdown') || keys.has('down')) {
          playersRef.current = playersRef.current.map(p => 
            p.team === 'blue' ? { ...p, y: Math.min(FIELD_HEIGHT - PLAYER_HEIGHT/2, p.y + moveDistance) } : p
          );
        }
      }

      // Computer AI for single player mode
      if (gameState.gameMode === 'single') {
        const ball = gameState.ball;
        const targetY = ball.y;
        
        playersRef.current = playersRef.current.map(p => {
          if (p.team === 'blue') {
            const currentY = p.y;
            const diff = targetY - currentY;
            const aiSpeed = PLAYER_SPEED * 0.7;
            
            if (Math.abs(diff) > 10) {
              const direction = diff > 0 ? 1 : -1;
              const newY = currentY + direction * aiSpeed * deltaTime;
              return {
                ...p,
                y: Math.max(PLAYER_HEIGHT/2, Math.min(FIELD_HEIGHT - PLAYER_HEIGHT/2, newY))
              };
            }
          }
          return p;
        });
      }
      
      // Handle ball physics and collisions
      setGameState(prev => {
        const newState = { ...prev };
        
        let { ball } = newState;
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Wall collisions
        if (ball.y <= BALL_SIZE/2 || ball.y >= FIELD_HEIGHT - BALL_SIZE/2) {
          ball.vy = -ball.vy;
        }

        // Goal detection
        if (ball.x <= -BALL_SIZE/2) {
          newState.score.blue++;
          newState.gameStatus = 'goal';
          toast("Blue team scores!");
          updateMultiplayerScore(newState.score.red, newState.score.blue);
          
          if (newState.score.blue >= 10) {
            newState.gameStatus = 'ended';
            toast.success("Blue team wins!");
          } else {
            setTimeout(() => resetBall(), 2000);
          }
        } else if (ball.x >= FIELD_WIDTH + BALL_SIZE/2) {
          newState.score.red++;
          newState.gameStatus = 'goal';
          toast("Red team scores!");
          updateMultiplayerScore(newState.score.red, newState.score.blue);
          
          if (newState.score.red >= 10) {
            newState.gameStatus = 'ended';
            toast.success("Red team wins!");
          } else {
            setTimeout(() => resetBall(), 2000);
          }
        }

        // Side wall bounces
        if ((ball.x <= BALL_SIZE/2 && ball.y < FIELD_HEIGHT/2 - GOAL_WIDTH/2) || 
            (ball.x <= BALL_SIZE/2 && ball.y > FIELD_HEIGHT/2 + GOAL_WIDTH/2) ||
            (ball.x >= FIELD_WIDTH - BALL_SIZE/2 && ball.y < FIELD_HEIGHT/2 - GOAL_WIDTH/2) ||
            (ball.x >= FIELD_WIDTH - BALL_SIZE/2 && ball.y > FIELD_HEIGHT/2 + GOAL_WIDTH/2)) {
          ball.vx = -ball.vx;
        }

        // Player collisions
        playersRef.current.forEach(player => {
          const rodX = player.team === 'red' 
            ? 100 + (player.rod - 1) * 120 
            : FIELD_WIDTH - 100 - (6 - player.rod) * 120;
          
          const distance = Math.sqrt(
            Math.pow(ball.x - rodX, 2) + Math.pow(ball.y - player.y, 2)
          );
          
          if (distance < BALL_SIZE/2 + 15) {
            ball.vx = -ball.vx * 1.1;
            ball.vy += (ball.y - player.y) * 0.1;
          }
        });

        newState.ball = ball;
        return newState;
      });

      // Render game
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw field
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
      
      // Draw center line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(FIELD_WIDTH / 2, 0);
      ctx.lineTo(FIELD_WIDTH / 2, FIELD_HEIGHT);
      ctx.stroke();
      
      // Draw goals
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, FIELD_HEIGHT/2 - GOAL_WIDTH/2, 10, GOAL_WIDTH);
      ctx.fillRect(FIELD_WIDTH - 10, FIELD_HEIGHT/2 - GOAL_WIDTH/2, 10, GOAL_WIDTH);
      
      // Draw players
      playersRef.current.forEach(player => {
        const rodX = player.team === 'red' 
          ? 100 + (player.rod - 1) * 120 
          : FIELD_WIDTH - 100 - (6 - player.rod) * 120;
        
        ctx.fillStyle = player.team === 'red' ? '#ef4444' : '#3b82f6';
        ctx.fillRect(rodX - 8, player.y - PLAYER_HEIGHT/2, 16, PLAYER_HEIGHT);
        
        // Draw rod
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(rodX, 0);
        ctx.lineTo(rodX, FIELD_HEIGHT);
        ctx.stroke();
      });
      
      // Draw ball
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(gameState.ball.x, gameState.ball.y, BALL_SIZE/2, 0, Math.PI * 2);
      ctx.fill();

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState.gameStatus, gameState.gameMode, isCreator, resetBall, updateMultiplayerScore]);

  // Initial game mode selection
  if (!gameState.gameMode && !isConnected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center space-y-6 max-w-md">
          <h1 className="text-4xl font-bold text-primary">Foosball Online</h1>
          <p className="text-muted-foreground">Choose how to play</p>
          
          {!showGameModeSelection ? (
            <div className="space-y-4">
              <Button onClick={() => setShowGameModeSelection(true)} className="w-full" size="lg">
                Start Game
              </Button>
            </div>
          ) : (
            <div className="space-y-3 pt-4 border-t">
              <h3 className="text-lg font-semibold">Select Game Mode</h3>
              <div className="space-y-2">
                <Button onClick={createSinglePlayerGame} className="w-full">
                  Single Player vs AI
                </Button>
                <Button onClick={createMultiPlayerGame} className="w-full" variant="secondary">
                  Multiplayer Online
                </Button>
                <Button 
                  onClick={() => setShowGameModeSelection(false)} 
                  variant="outline"
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // Multiplayer lobby
  if (gameState.gameMode === 'multi' && isConnected && room?.game_state.game_status === 'waiting') {
    const playerTeam = isCreator ? 'red' : 'blue';
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <MultiplayerControls
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            roomCode={room?.room_code}
            isConnected={isConnected}
            isWaiting={!room?.opponent_id}
            onLeaveRoom={leaveRoom}
          />
          
          {room?.opponent_id && (
            <Card className="p-6 text-center">
              <h2 className="text-xl font-semibold mb-4">Ready to Play!</h2>
              <p className="text-muted-foreground mb-4">
                You are the <span className={`font-bold ${playerTeam === 'red' ? 'text-red-500' : 'text-blue-500'}`}>
                  {playerTeam.toUpperCase()}
                </span> team
              </p>
              <Button onClick={startGame} size="lg">
                Start Game
              </Button>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Multiplayer room setup
  if (gameState.gameMode === 'multi' && !isConnected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <MultiplayerControls
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          isConnected={isConnected}
          isWaiting={false}
          onLeaveRoom={leaveRoom}
        />
      </div>
    );
  }

  // Game ended screen
  if (gameState.gameStatus === 'ended') {
    const playerTeam = gameState.gameMode === 'single' ? 'red' : (isCreator ? 'red' : 'blue');
    const playerScore = playerTeam === 'red' ? gameState.score.red : gameState.score.blue;
    const opponentScore = playerTeam === 'red' ? gameState.score.blue : gameState.score.red;
    const playerWon = playerScore > opponentScore;

    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="p-8 text-center">
            <h1 className="text-4xl font-bold mb-4">
              {playerWon ? "🎉 You Won!" : "💪 Good Game!"}
            </h1>
            <div className="text-2xl font-semibold mb-4">
              Final Score: {gameState.score.red} - {gameState.score.blue}
            </div>
            <div className="text-muted-foreground mb-6">
              {gameState.gameMode === 'single' ? 'Single Player vs AI' : `Multiplayer Game - Room ${room?.room_code}`}
            </div>
            <Button onClick={quitGame} size="lg">
              Play Again
            </Button>
          </Card>
          
          <GameScores />
        </div>
      </div>
    );
  }

  const playerTeam = gameState.gameMode === 'single' ? 'red' : (isCreator ? 'red' : 'blue');

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Game Header */}
        <div className="flex justify-between items-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold">
              {gameState.gameMode === 'single' ? 'Single Player vs AI' : `Room: ${room?.room_code}`}
            </h1>
            <p className="text-muted-foreground">
              You are: <span className={`font-bold ${playerTeam === 'red' ? 'text-red-500' : 'text-blue-500'}`}>
                {playerTeam.toUpperCase()} team
              </span>
            </p>
          </div>
          
          {/* Score */}
          <div className="text-center">
            <div className="text-3xl font-bold space-x-4">
              <span className="text-red-500">{gameState.score.red}</span>
              <span>-</span>
              <span className="text-blue-500">{gameState.score.blue}</span>
            </div>
            <p className="text-sm text-muted-foreground">RED - BLUE</p>
          </div>

          {/* Controls */}
          <div className="text-right space-y-2">
            {gameState.gameStatus === 'waiting' && (
              <Button onClick={startGame}>Start Game</Button>
            )}
            <Button onClick={quitGame} variant="outline" size="sm">
              Quit Game
            </Button>
            <div className="text-xs text-muted-foreground">
              {playerTeam === 'red' ? 'W/S to move' : '↑/↓ to move'}
            </div>
          </div>
        </div>

        {/* Game Canvas */}
        <Card className="p-4">
          <canvas
            ref={canvasRef}
            width={FIELD_WIDTH}
            height={FIELD_HEIGHT}
            className="border-2 border-gray-400 rounded-lg mx-auto block bg-green-100"
          />
        </Card>

        {/* Instructions */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-semibold text-red-500 mb-2">Red Team Controls:</h3>
              <p>W - Move players up</p>
              <p>S - Move players down</p>
            </div>
            <div>
              <h3 className="font-semibold text-blue-500 mb-2">Blue Team Controls:</h3>
              {gameState.gameMode === 'single' ? (
                <p>Computer controlled</p>
              ) : (
                <>
                  <p>↑ - Move players up</p>
                  <p>↓ - Move players down</p>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};