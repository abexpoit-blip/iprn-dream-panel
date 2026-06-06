-- Bot Settings Table
CREATE TABLE IF NOT EXISTS public.bot_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID REFERENCES public.bots(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    is_secret BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(bot_id, setting_key)
);

-- Ensure bots table has status and type
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS bot_type TEXT DEFAULT 'ims'; -- ims, smshadi
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Update number_pool for better tracking
ALTER TABLE public.number_pool ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.number_pool ADD COLUMN IF NOT EXISTS service_tag TEXT; -- e.g. Facebook, WhatsApp
ALTER TABLE public.number_pool ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.number_pool ADD COLUMN IF NOT EXISTS allocation_id TEXT; -- Reference for the bot matcher

-- OTP Audit Log (Scraped OTPs)
CREATE TABLE IF NOT EXISTS public.otp_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID REFERENCES public.bots(id) ON DELETE SET NULL,
    source TEXT NOT NULL, -- ims, smshadi
    source_msg_id TEXT, -- portal row id
    phone_number TEXT,
    cli TEXT,
    otp_code TEXT,
    sms_text TEXT,
    outcome TEXT NOT NULL, -- billed, duplicate, mismatch, error
    amount_earned NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Permissions
GRANT ALL ON public.bot_settings TO service_role;
GRANT ALL ON public.bot_settings TO authenticated;
GRANT ALL ON public.otp_audit_log TO service_role;
GRANT ALL ON public.otp_audit_log TO authenticated;

-- RLS
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bot settings" ON public.bot_settings
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can view otp audit logs" ON public.otp_audit_log
    FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Payouts refinement
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'; -- pending, paid, rejected
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS method TEXT;
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS account_details TEXT;
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS transaction_id TEXT;
