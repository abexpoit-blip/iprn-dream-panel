CREATE OR REPLACE FUNCTION public.sync_number_pool_on_otp_success()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.outcome = 'billed' AND NEW.phone_number IS NOT NULL THEN
        UPDATE public.number_pool
        SET 
            status = 'used',
            updated_at = now()
        WHERE number = NEW.phone_number 
        AND status = 'reserved';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_number_pool_otp ON public.otp_audit_log;
CREATE TRIGGER tr_sync_number_pool_otp
AFTER INSERT ON public.otp_audit_log
FOR EACH ROW EXECUTE FUNCTION public.sync_number_pool_on_otp_success();
