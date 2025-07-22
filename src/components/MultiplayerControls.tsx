import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Copy, Users, Wifi } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MultiplayerControlsProps {
  onCreateRoom: () => void;
  onJoinRoom: (roomCode: string) => void;
  roomCode?: string;
  isConnected: boolean;
  isWaiting: boolean;
  onLeaveRoom: () => void;
}

export const MultiplayerControls = ({
  onCreateRoom,
  onJoinRoom,
  roomCode,
  isConnected,
  isWaiting,
  onLeaveRoom,
}: MultiplayerControlsProps) => {
  const [joinCode, setJoinCode] = useState('');
  const { toast } = useToast();

  const copyRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      toast({
        title: "Room Code Copied",
        description: "Share this code with your opponent",
      });
    }
  };

  const handleJoinRoom = () => {
    if (joinCode.trim()) {
      onJoinRoom(joinCode.trim());
      setJoinCode('');
    }
  };

  if (isConnected) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Wifi className="w-5 h-5 text-green-500" />
            Connected to Room
          </CardTitle>
          {roomCode && (
            <CardDescription>
              Room Code: <span className="font-mono font-bold text-lg">{roomCode}</span>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isWaiting && (
            <div className="text-center py-4">
              <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground animate-pulse" />
              <p className="text-muted-foreground">Waiting for opponent to join...</p>
              {roomCode && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={copyRoomCode}
                  className="mt-2"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Room Code
                </Button>
              )}
            </div>
          )}
          
          <Button 
            onClick={onLeaveRoom} 
            variant="destructive" 
            className="w-full"
          >
            Leave Room
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle>Multiplayer Mode</CardTitle>
        <CardDescription>Create or join a room to play with friends</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={onCreateRoom} className="w-full" size="lg">
          Create Room
        </Button>
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <Input
            placeholder="Enter room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="text-center font-mono"
          />
          <Button 
            onClick={handleJoinRoom} 
            variant="outline" 
            className="w-full"
            disabled={!joinCode.trim()}
          >
            Join Room
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};