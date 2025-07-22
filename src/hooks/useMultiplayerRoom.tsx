import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

interface GameState {
  player1_score: number;
  player2_score: number;
  current_player: number;
  game_status: 'waiting' | 'playing' | 'finished';
}

type Room = Database['public']['Tables']['rooms']['Row'] & {
  game_state: GameState;
};

export const useMultiplayerRoom = () => {
  const [room, setRoom] = useState<Room | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  // Generate a random 6-character room code
  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // Create a new room
  const createRoom = useCallback(async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const roomCode = generateRoomCode();
    
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        room_code: roomCode,
        creator_id: user.id,
        game_state: {
          player1_score: 0,
          player2_score: 0,
          current_player: 1,
          game_status: 'waiting'
        }
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create room",
        variant: "destructive",
      });
      return;
    }

    setRoom(data as Room);
    setIsCreator(true);
    setIsConnected(true);
    
    toast({
      title: "Room Created",
      description: `Room code: ${roomCode}`,
    });
  }, [toast]);

  // Join an existing room
  const joinRoom = useCallback(async (roomCode: string) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    // First, find the room
    const { data: roomData, error: fetchError } = await supabase
      .from('rooms')
      .select()
      .eq('room_code', roomCode.toUpperCase())
      .single();

    if (fetchError || !roomData) {
      toast({
        title: "Error",
        description: "Room not found",
        variant: "destructive",
      });
      return;
    }

    if (roomData.opponent_id) {
      toast({
        title: "Error", 
        description: "Room is full",
        variant: "destructive",
      });
      return;
    }

    if (roomData.creator_id === user.id) {
      toast({
        title: "Error",
        description: "You cannot join your own room",
        variant: "destructive",
      });
      return;
    }

    // Join the room by setting opponent_id
    const { data, error } = await supabase
      .from('rooms')
      .update({ 
        opponent_id: user.id,
        game_state: {
          player1_score: 0,
          player2_score: 0,
          current_player: 1,
          game_status: 'playing'
        }
      })
      .eq('id', roomData.id)
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to join room",
        variant: "destructive",
      });
      return;
    }

    setRoom(data as Room);
    setIsCreator(false);
    setIsConnected(true);
    
    toast({
      title: "Joined Room",
      description: `Connected to room ${roomCode}`,
    });
  }, [toast]);

  // Update game state
  const updateGameState = useCallback(async (newState: Partial<GameState>) => {
    if (!room) return;

    const currentState = room.game_state as GameState;
    const updatedState = { ...currentState, ...newState };
    
    const { error } = await supabase
      .from('rooms')
      .update({ game_state: updatedState })
      .eq('id', room.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update game state",
        variant: "destructive",
      });
    }
  }, [room, toast]);

  // Leave room
  const leaveRoom = useCallback(async () => {
    if (!room) return;

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    if (isCreator) {
      // If creator leaves, delete the room
      await supabase.from('rooms').delete().eq('id', room.id);
    } else {
      // If opponent leaves, remove them from room
      await supabase
        .from('rooms')
        .update({ 
          opponent_id: null,
          game_state: {
            player1_score: 0,
            player2_score: 0,
            current_player: 1,
            game_status: 'waiting'
          }
        })
        .eq('id', room.id);
    }

    setRoom(null);
    setIsCreator(false);
    setIsConnected(false);
  }, [room, isCreator]);

  // Set up real-time subscription
  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel('room-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          setRoom(payload.new as Room);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id]);

  return {
    room,
    isCreator,
    isConnected,
    createRoom,
    joinRoom,
    updateGameState,
    leaveRoom,
  };
};