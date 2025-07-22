-- Update RLS policy to allow finding rooms by room code for joining
DROP POLICY IF EXISTS "Users can view rooms they are part of" ON public.rooms;

CREATE POLICY "Users can view rooms they are part of or find by room code" 
ON public.rooms 
FOR SELECT 
USING (
  (auth.uid() = creator_id) OR 
  (auth.uid() = opponent_id) OR 
  (room_code IS NOT NULL AND opponent_id IS NULL)
);