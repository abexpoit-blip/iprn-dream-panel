-- Add automation flags to bots
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS session_keep_alive BOOLEAN DEFAULT true;
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS auto_relogin BOOLEAN DEFAULT true;

-- Add automation flags to number_panels
ALTER TABLE public.number_panels ADD COLUMN IF NOT EXISTS session_keep_alive BOOLEAN DEFAULT true;
ALTER TABLE public.number_panels ADD COLUMN IF NOT EXISTS auto_relogin BOOLEAN DEFAULT true;
ALTER TABLE public.number_panels ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Update number_pool for better state management
ALTER TABLE public.number_pool ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.number_pool ADD COLUMN IF NOT EXISTS reserved_for UUID REFERENCES auth.users(id);

-- Ensure status has correct values if not already constrained
-- (We use text but aim for available, reserved, used, expired)
UPDATE public.number_pool SET status = 'available' WHERE status IS NULL;
