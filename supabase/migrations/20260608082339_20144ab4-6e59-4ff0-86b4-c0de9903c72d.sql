ALTER TABLE public.number_pool
  ADD COLUMN IF NOT EXISTS range_name TEXT,
  ADD COLUMN IF NOT EXISTS prefix TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS panel_payout NUMERIC;

CREATE INDEX IF NOT EXISTS idx_number_pool_range ON public.number_pool(range_name);
CREATE INDEX IF NOT EXISTS idx_number_pool_country ON public.number_pool(country);