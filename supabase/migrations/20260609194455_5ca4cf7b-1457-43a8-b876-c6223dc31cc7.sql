
-- 1) Hard dedup at the DB layer
CREATE UNIQUE INDEX IF NOT EXISTS uq_otp_audit_source_msgid
  ON public.otp_audit_log (source, source_msg_id)
  WHERE source_msg_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_otp_audit_phone
  ON public.otp_audit_log (phone_number);

-- 2) Tier-based read access
DROP POLICY IF EXISTS "Agents view OTPs for their assigned numbers" ON public.otp_audit_log;
CREATE POLICY "Agents view OTPs for their assigned numbers"
ON public.otp_audit_log
FOR SELECT
TO authenticated
USING (
  phone_number IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.number_pool np
    WHERE np.assigned_agent = auth.uid()
      AND (
        np.number = otp_audit_log.phone_number
        OR np.number LIKE '%' || RIGHT(otp_audit_log.phone_number, 9)
      )
  )
);

DROP POLICY IF EXISTS "Clients view OTPs for their assigned numbers" ON public.otp_audit_log;
CREATE POLICY "Clients view OTPs for their assigned numbers"
ON public.otp_audit_log
FOR SELECT
TO authenticated
USING (
  phone_number IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.number_pool np
    JOIN public.clients c ON c.id = np.assigned_client
    WHERE c.user_id = auth.uid()
      AND (
        np.number = otp_audit_log.phone_number
        OR np.number LIKE '%' || RIGHT(otp_audit_log.phone_number, 9)
      )
  )
);
