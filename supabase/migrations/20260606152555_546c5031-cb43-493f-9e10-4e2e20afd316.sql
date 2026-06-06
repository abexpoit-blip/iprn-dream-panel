-- Add is_admin column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create admin routes/views can be handled in frontend, but we need the data layer.
-- Ensure we have a way to track which agent managed which client (already exists via agent_id)

-- Let's add a comment for clarification
COMMENT ON COLUMN public.profiles.is_admin IS 'Flag to identify if a user has administrative privileges';

-- Grant permissions (standard procedure)
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
