
CREATE TABLE public.bot_sync_status (
  bot_id UUID PRIMARY KEY REFERENCES public.bots(id) ON DELETE CASCADE,
  bot_type TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'cdr',
  last_sync_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error TEXT,
  rows_fetched INT NOT NULL DEFAULT 0,
  billed_count INT NOT NULL DEFAULT 0,
  dup_count INT NOT NULL DEFAULT 0,
  retry_count INT NOT NULL DEFAULT 0,
  session_alive BOOLEAN NOT NULL DEFAULT true,
  last_relogin_at TIMESTAMPTZ,
  total_syncs BIGINT NOT NULL DEFAULT 0,
  total_billed BIGINT NOT NULL DEFAULT 0,
  total_dup BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bot_sync_status TO authenticated;
GRANT ALL ON public.bot_sync_status TO service_role;

ALTER TABLE public.bot_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view bot sync status"
  ON public.bot_sync_status FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  ));

ALTER TABLE public.bot_sync_status REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_sync_status;
