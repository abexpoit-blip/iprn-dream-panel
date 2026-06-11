
-- Performance indexes for heavy list queries
CREATE INDEX IF NOT EXISTS idx_clients_agent_id_created ON public.clients(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON public.clients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_number_pool_assigned_agent ON public.number_pool(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_number_pool_assigned_client ON public.number_pool(assigned_client);
CREATE INDEX IF NOT EXISTS idx_number_pool_status ON public.number_pool(status);
CREATE INDEX IF NOT EXISTS idx_number_pool_created ON public.number_pool(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_user_tier ON public.commission_ledger(user_id, tier);
CREATE INDEX IF NOT EXISTS idx_profiles_role_admin ON public.profiles(role, is_admin);

-- Server-side aggregation RPC for /agents page (one round-trip instead of 4 full-table scans)
CREATE OR REPLACE FUNCTION public.agents_overview()
RETURNS TABLE (
  id uuid,
  username text,
  full_name text,
  status text,
  balance numeric,
  created_at timestamptz,
  numbers_count bigint,
  clients_count bigint,
  otp_count bigint,
  total_payout numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.full_name,
    p.status,
    p.balance,
    p.created_at,
    COALESCE(np.cnt, 0) AS numbers_count,
    COALESCE(cl.cnt, 0) AS clients_count,
    COALESCE(cm.cnt, 0) AS otp_count,
    COALESCE(cm.total, 0) AS total_payout
  FROM public.profiles p
  LEFT JOIN (
    SELECT assigned_agent, COUNT(*)::bigint AS cnt
    FROM public.number_pool
    WHERE assigned_agent IS NOT NULL
    GROUP BY assigned_agent
  ) np ON np.assigned_agent = p.id
  LEFT JOIN (
    SELECT agent_id, COUNT(*)::bigint AS cnt
    FROM public.clients
    WHERE agent_id IS NOT NULL
    GROUP BY agent_id
  ) cl ON cl.agent_id = p.id
  LEFT JOIN (
    SELECT user_id, COUNT(*)::bigint AS cnt, COALESCE(SUM(amount), 0) AS total
    FROM public.commission_ledger
    WHERE tier = 'agent'
    GROUP BY user_id
  ) cm ON cm.user_id = p.id
  WHERE p.role = 'agent' AND p.is_admin = false
  ORDER BY p.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.agents_overview() TO authenticated;
