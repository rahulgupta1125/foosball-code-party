import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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
  gameStatus: 'waiting' | 'playing' | 'paused' | 'goal';
  roomCode: string;
  playerTeam: 'red' | 'blue' | null;
}

const FIELD_WIDTH = 800;
const FIELD_HEIGHT = 400;
const BALL_SIZE = 12;
const PLAYER_HEIGHT = 60;
const GOAL_WIDTH = 80;
const PLAYER_SPEED = 300; // pixels per second

export const FoosballGame = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const keysRef = useRef<Set<string>>(new Set());
  const lastTimeRef = useRef<number>(0);
  
  const [gameState, setGameState] = useState<GameState>({
    ball: { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 0, vy: 0 },
    players: [
      // Red team players (left side)
      { y: FIELD_HEIGHT / 2, team: 'red', rod: 1 },
      { y: FIELD_HEIGHT / 2, team: 'red', rod: 2 },
      { y: FIELD_HEIGHT / 2, team: 'red', rod: 3 },
      // Blue team players (right side)
      { y: FIELD_HEIGHT / 2, team: 'blue', rod: 4 },
      { y: FIELD_HEIGHT / 2, team: 'blue', rod: 5 },
      { y: FIELD_HEIGHT / 2, team: 'blue', rod: 6 },
    ],
    score: { red: 0, blue: 0 },
    gameStatus: 'waiting',
    roomCode: '',
    playerTeam: null
  });

  const [showRoomInput, setShowRoomInput] = useState(false);
  const [roomInput, setRoomInput] = useState('');

  // Generate unique room code
  const generateRoomCode = useCallback(() => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }, []);

  // Create new game
  const createGame = useCallback(() => {
    const code = generateRoomCode();
    setGameState(prev => ({
      ...prev,
      roomCode: code,
      playerTeam: 'red',
      gameStatus: 'waiting'
    }));
    toast(`Room created! Share code: ${code}`);
  }, [generateRoomCode]);

  // Join game
  const joinGame = useCallback(() => {
    if (!roomInput.trim()) {
      toast.error("Please enter a room code");
      return;
    }
    setGameState(prev => ({
      ...prev,
      roomCode: roomInput.toUpperCase(),
      playerTeam: 'blue',
      gameStatus: 'playing'
    }));
    setShowRoomInput(false);
    toast(`Joined room: ${roomInput.toUpperCase()}`);
  }, [roomInput]);

  // Start game
  const startGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      gameStatus: 'playing',
      ball: { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 3, vy: 2 }
    }));
    toast("Game started!");
  }, []);

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
      const deltaTime = (currentTime - lastTimeRef.current) / 1000; // Convert to seconds
      lastTimeRef.current = currentTime;
      
      // Handle player movement
      setGameState(prev => {
        const newState = { ...prev };
        const keys = keysRef.current;
        const moveDistance = PLAYER_SPEED * deltaTime;
        
        // Player controls based on team
        if (newState.playerTeam === 'red') {
          if (keys.has('w')) {
            newState.players = newState.players.map(p => 
              p.team === 'red' ? { ...p, y: Math.max(PLAYER_HEIGHT/2, p.y - moveDistance) } : p
            );
          }
          if (keys.has('s')) {
            newState.players = newState.players.map(p => 
              p.team === 'red' ? { ...p, y: Math.min(FIELD_HEIGHT - PLAYER_HEIGHT/2, p.y + moveDistance) } : p
            );
          }
        } else if (newState.playerTeam === 'blue') {
          if (keys.has('arrowup') || keys.has('up')) {
            newState.players = newState.players.map(p => 
              p.team === 'blue' ? { ...p, y: Math.max(PLAYER_HEIGHT/2, p.y - moveDistance) } : p
            );
          }
          if (keys.has('arrowdown') || keys.has('down')) {
            newState.players = newState.players.map(p => 
              p.team === 'blue' ? { ...p, y: Math.min(FIELD_HEIGHT - PLAYER_HEIGHT/2, p.y + moveDistance) } : p
            );
          }
        }

        // Ball physics
        let { ball } = newState;
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Wall collisions
        if (ball.y <= BALL_SIZE/2 || ball.y >= FIELD_HEIGHT - BALL_SIZE/2) {
          ball.vy = -ball.vy;
        }

        // Goal detection
        if (ball.x <= 0) {
          newState.score.blue++;
          newState.gameStatus = 'goal';
          toast("Blue team scores!");
          setTimeout(() => resetBall(), 2000);
        } else if (ball.x >= FIELD_WIDTH) {
          newState.score.red++;
          newState.gameStatus = 'goal';
          toast("Red team scores!");
          setTimeout(() => resetBall(), 2000);
        }

        // Side wall bounces
        if (ball.x <= BALL_SIZE/2 || ball.x >= FIELD_WIDTH - BALL_SIZE/2) {
          ball.vx = -ball.vx;
        }

        // Player collisions
        newState.players.forEach(player => {
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
      gameState.players.forEach(player => {
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
  }, [gameState.gameStatus, gameState.playerTeam, resetBall]);

  if (gameState.gameStatus === 'waiting' && !gameState.roomCode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center space-y-6 max-w-md">
          <h1 className="text-4xl font-bold text-primary">Foosball Online</h1>
          <p className="text-muted-foreground">Choose how to play</p>
          
          <div className="space-y-4">
            <Button onClick={createGame} className="w-full" size="lg">
              Create New Game
            </Button>
            
            <Button 
              onClick={() => setShowRoomInput(true)} 
              variant="secondary" 
              className="w-full"
              size="lg"
            >
              Join Game
            </Button>
          </div>

          {showRoomInput && (
            <div className="space-y-3 pt-4 border-t">
              <Input
                placeholder="Enter room code"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                className="text-center uppercase"
                maxLength={6}
              />
              <div className="flex gap-2">
                <Button onClick={joinGame} className="flex-1">
                  Join
                </Button>
                <Button 
                  onClick={() => setShowRoomInput(false)} 
                  variant="outline"
                  className="flex-1"
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

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Game Header */}
        <div className="flex justify-between items-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Room: {gameState.roomCode}</h1>
            <p className="text-muted-foreground">
              You are: <span className={`font-bold ${gameState.playerTeam === 'red' ? 'text-team-red' : 'text-team-blue'}`}>
                {gameState.playerTeam?.toUpperCase()} team
              </span>
            </p>
          </div>
          
          {/* Score */}
          <div className="text-center">
            <div className="text-3xl font-bold space-x-4">
              <span className="text-team-red">{gameState.score.red}</span>
              <span>-</span>
              <span className="text-team-blue">{gameState.score.blue}</span>
            </div>
            <p className="text-sm text-muted-foreground">RED - BLUE</p>
          </div>

          {/* Controls */}
          <div className="text-right space-y-2">
            {gameState.gameStatus === 'waiting' && (
              <Button onClick={startGame}>Start Game</Button>
            )}
            <div className="text-xs text-muted-foreground">
              {gameState.playerTeam === 'red' ? 'W/S to move' : '↑/↓ to move'}
            </div>
          </div>
        </div>

        {/* Game Canvas */}
        <Card className="p-4 bg-foosball-table">
          <canvas
            ref={canvasRef}
            width={FIELD_WIDTH}
            height={FIELD_HEIGHT}
            className="border-2 border-foosball-lines rounded-lg mx-auto block bg-foosball-field"
          />
        </Card>

        {/* Instructions */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-semibold text-team-red mb-2">Red Team Controls:</h3>
              <p>W - Move players up</p>
              <p>S - Move players down</p>
            </div>
            <div>
              <h3 className="font-semibold text-team-blue mb-2">Blue Team Controls:</h3>
              <p>↑ - Move players up</p>
              <p>↓ - Move players down</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};