-- Add status to profiles to handle approval workflow
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Update RLS for profiles to allow self-signup but require approval for dashboard access
-- (Handled in application logic, but adding status column is necessary)

-- Ensure agents can only manage their own clients
-- (Already exists in current schema, but verifying/enhancing)

GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
