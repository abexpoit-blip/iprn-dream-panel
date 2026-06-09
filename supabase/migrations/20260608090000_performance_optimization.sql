-- Indexes for sms_cdr
CREATE INDEX IF NOT EXISTS idx_sms_cdr_received_at ON public.sms_cdr(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_cdr_agent_id ON public.sms_cdr(agent_id);
CREATE INDEX IF NOT EXISTS idx_sms_cdr_client_id ON public.sms_cdr(client_id);
CREATE INDEX IF NOT EXISTS idx_sms_cdr_prefix ON public.sms_cdr(prefix);

-- Indexes for sms_logs
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON public.sms_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_agent_id ON public.sms_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_client_id ON public.sms_logs(client_id);

-- Indexes for otp_audit_log
CREATE INDEX IF NOT EXISTS idx_otp_audit_log_created_at ON public.otp_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_audit_log_bot_id ON public.otp_audit_log(bot_id);
CREATE INDEX IF NOT EXISTS idx_otp_audit_log_outcome ON public.otp_audit_log(outcome);

-- Optimized summary function
CREATE OR REPLACE FUNCTION public.get_sms_summary_24h()
RETURNS TABLE (
    total_rows BIGINT,
    billed_count BIGINT,
    duplicate_count BIGINT,
    last_event_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT,
        COUNT(*) FILTER (WHERE outcome = 'billed')::BIGINT,
        COUNT(*) FILTER (WHERE outcome IN ('duplicate', 'dup'))::BIGINT,
        MAX(created_at)
    FROM public.otp_audit_log
    WHERE created_at > (now() - INTERVAL '24 hours');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
