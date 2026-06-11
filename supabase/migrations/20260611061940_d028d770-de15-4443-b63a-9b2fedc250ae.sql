CREATE INDEX IF NOT EXISTS idx_otp_audit_created_at_desc ON public.otp_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_audit_cli ON public.otp_audit_log (cli);
CREATE INDEX IF NOT EXISTS idx_otp_audit_outcome ON public.otp_audit_log (outcome);