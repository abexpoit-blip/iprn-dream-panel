
ALTER TABLE public.number_pool ADD COLUMN IF NOT EXISTS assigned_agent UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.number_pool ADD COLUMN IF NOT EXISTS assigned_client UUID REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.number_pool ADD COLUMN IF NOT EXISTS agent_rate NUMERIC;
ALTER TABLE public.number_pool ADD COLUMN IF NOT EXISTS client_rate NUMERIC;

CREATE INDEX IF NOT EXISTS idx_number_pool_assigned_agent  ON public.number_pool(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_number_pool_assigned_client ON public.number_pool(assigned_client);

CREATE TABLE IF NOT EXISTS public.number_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number_pool_id UUID NOT NULL REFERENCES public.number_pool(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('agent','client')),
  from_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_user_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_client_id UUID REFERENCES public.clients(id)  ON DELETE SET NULL,
  base_rate  NUMERIC,
  markup     NUMERIC,
  final_rate NUMERIC,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','released')),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
  released_at TIMESTAMP WITH TIME ZONE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.number_allocations TO authenticated;
GRANT ALL ON public.number_allocations TO service_role;
ALTER TABLE public.number_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read allocations"
  ON public.number_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manages allocations"
  ON public.number_allocations FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_alloc_number ON public.number_allocations(number_pool_id);
CREATE INDEX IF NOT EXISTS idx_alloc_agent  ON public.number_allocations(to_user_id)   WHERE tier='agent'  AND status='active';
CREATE INDEX IF NOT EXISTS idx_alloc_client ON public.number_allocations(to_client_id) WHERE tier='client' AND status='active';

CREATE TABLE IF NOT EXISTS public.commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  otp_audit_id UUID,
  number_pool_id UUID,
  phone_number TEXT,
  tier TEXT NOT NULL,
  user_id UUID,
  client_id UUID,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
GRANT SELECT ON public.commission_ledger TO authenticated;
GRANT ALL ON public.commission_ledger TO service_role;
ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read ledger"
  ON public.commission_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role writes ledger"
  ON public.commission_ledger FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_commission_user   ON public.commission_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_client ON public.commission_ledger(client_id);
CREATE INDEX IF NOT EXISTS idx_commission_number ON public.commission_ledger(number_pool_id);
