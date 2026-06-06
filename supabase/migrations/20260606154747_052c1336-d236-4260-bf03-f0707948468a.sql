
-- Link clients to auth users
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clients_user_id_unique ON public.clients(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clients_username_unique ON public.clients(lower(username));

-- Helper: get the clients.id for the currently authenticated client user
CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.clients WHERE user_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_client_id() TO authenticated;

-- Extend sms_logs RLS so clients see their own rows
DROP POLICY IF EXISTS "Clients can view own sms_logs" ON public.sms_logs;
CREATE POLICY "Clients can view own sms_logs" ON public.sms_logs
  FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());

-- Extend sms_cdr RLS so clients see their own rows
DROP POLICY IF EXISTS "Clients can view own sms_cdr" ON public.sms_cdr;
CREATE POLICY "Clients can view own sms_cdr" ON public.sms_cdr
  FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());

-- Allow clients to read their own row in clients table
DROP POLICY IF EXISTS "Clients can view own row" ON public.clients;
CREATE POLICY "Clients can view own row" ON public.clients
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
