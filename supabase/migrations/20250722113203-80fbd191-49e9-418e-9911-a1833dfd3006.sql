-- Create rooms table for multiplayer games
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT NOT NULL UNIQUE,
  creator_id UUID NOT NULL,
  opponent_id UUID DEFAULT NULL,
  game_state JSONB NOT NULL DEFAULT '{"player1_score": 0, "player2_score": 0, "current_player": 1, "game_status": "waiting"}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Create policies for rooms
CREATE POLICY "Users can view rooms they are part of" 
ON public.rooms 
FOR SELECT 
USING (auth.uid() = creator_id OR auth.uid() = opponent_id);

CREATE POLICY "Users can create rooms" 
ON public.rooms 
FOR INSERT 
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Room participants can update game state" 
ON public.rooms 
FOR UPDATE 
USING (auth.uid() = creator_id OR auth.uid() = opponent_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_rooms_updated_at
BEFORE UPDATE ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for rooms table
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.rooms;