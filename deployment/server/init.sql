-- Core Tables for Nexus-X Panel

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles (Auth replacement)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    skype_id TEXT,
    role TEXT DEFAULT 'agent', -- 'admin', 'agent', 'client'
    is_admin BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'approved', -- 'pending', 'approved', 'suspended'
    balance NUMERIC(12,2) DEFAULT 0,
    last_payout_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Idempotent column additions for existing deployments
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skype_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_payout_at TIMESTAMP WITH TIME ZONE;

-- Bots table
CREATE TABLE IF NOT EXISTS bots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    bot_type TEXT DEFAULT 'ims', -- ims, smshadi
    status TEXT DEFAULT 'offline',
    last_seen TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    session_keep_alive BOOLEAN DEFAULT true,
    auto_relogin BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Bot Settings
CREATE TABLE IF NOT EXISTS bot_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    is_secret BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(bot_id, setting_key)
);
ALTER TABLE bot_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Number Panels
CREATE TABLE IF NOT EXISTS number_panels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    panel_url TEXT NOT NULL,
    username TEXT,
    password TEXT,
    status TEXT DEFAULT 'offline',
    last_login TIMESTAMP WITH TIME ZONE,
    session_keep_alive BOOLEAN DEFAULT true,
    auto_relogin BOOLEAN DEFAULT true,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Number Pool
CREATE TABLE IF NOT EXISTS number_pool (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'available', -- available, reserved, used, expired
    service_tag TEXT,
    bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
    number_panel_id UUID REFERENCES number_panels(id) ON DELETE SET NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    allocation_id TEXT,
    reserved_at TIMESTAMP WITH TIME ZONE,
    reserved_for UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- OTP Audit Log
CREATE TABLE IF NOT EXISTS otp_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
    source TEXT NOT NULL,
    source_msg_id TEXT,
    phone_number TEXT,
    cli TEXT,
    otp_code TEXT,
    sms_text TEXT,
    outcome TEXT NOT NULL, -- billed, duplicate, mismatch, error
    amount_earned NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Payouts
CREATE TABLE IF NOT EXISTS payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, completed, rejected
    payment_method TEXT,
    account_details TEXT,
    transaction_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Banned Keywords
CREATE TABLE IF NOT EXISTS banned_keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword TEXT UNIQUE NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    username TEXT,
    email TEXT,
    skype_id TEXT,
    balance NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- SMS CDR (Call Detail Record)

CREATE TABLE IF NOT EXISTS sms_cdr (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    otp_code TEXT,
    cli TEXT,
    price_bdt NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'billed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Default Admin User (seed)
-- Using a simpler seed that we'll catch in the API fallback
INSERT INTO profiles (username, password_hash, role, is_admin, status)
VALUES ('admin', 'SEED_ADMIN_PLACEHOLDER', 'admin', true, 'approved')
ON CONFLICT (username) DO UPDATE SET status = 'approved', is_admin = true, role = 'admin';

-- Extra indices for performance (sms_logs indexes moved below sms_logs CREATE)
CREATE INDEX IF NOT EXISTS idx_number_pool_status ON number_pool(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);



-- Seeding from previous Lovable configuration
-- IMPORTANT: use FIXED UUIDs so re-running init.sql does not duplicate bots
INSERT INTO bots (id, name, bot_type, status)
VALUES 
    ('36fae619-2d83-4416-b243-8f7af4c33100', 'IMS Main Agent', 'ims', 'offline'),
    ('95280089-8b3e-4c88-9e49-be5fe93330a9', 'SMS Hadi Agent', 'smshadi', 'offline'),
    ('5c21b595-4260-4b83-a402-34a9e031afcf', 'Shark SMS Agent', 'shark', 'offline')
ON CONFLICT (id) DO NOTHING;

-- One-time cleanup: remove duplicate bot rows created by previous init runs
-- (keeps the canonical fixed-UUID row, deletes any extras with the same bot_type)
DELETE FROM bots b
USING bots b2
WHERE b.bot_type = b2.bot_type
  AND b.id <> b2.id
  AND b2.id IN (
    '36fae619-2d83-4416-b243-8f7af4c33100',
    '95280089-8b3e-4c88-9e49-be5fe93330a9',
    '5c21b595-4260-4b83-a402-34a9e031afcf'
  )
  AND b.id NOT IN (
    '36fae619-2d83-4416-b243-8f7af4c33100',
    '95280089-8b3e-4c88-9e49-be5fe93330a9',
    '5c21b595-4260-4b83-a402-34a9e031afcf'
  );

INSERT INTO bot_settings (bot_id, setting_key, setting_value, is_secret)
SELECT bot_id, column_name, val, is_secret FROM (
  SELECT 
    id AS bot_id,
    column_name,
    CASE 
        WHEN name = 'IMS Main Agent' AND column_name = 'username' THEN 'mamun99'
        WHEN name = 'IMS Main Agent' AND column_name = 'password' THEN 'mamun@12aa#'
        WHEN name = 'IMS Main Agent' AND column_name = 'portal_url' THEN 'https://www.imssms.org/login'
        WHEN name = 'SMS Hadi Agent' AND column_name = 'username' THEN 'mamun999'
        WHEN name = 'SMS Hadi Agent' AND column_name = 'password' THEN 'mamun999'
        WHEN name = 'SMS Hadi Agent' AND column_name = 'portal_url' THEN 'http://2.59.169.96/ints/login'
        WHEN column_name = 'interval' THEN '15'
    END AS val,
    (column_name = 'password') AS is_secret
  FROM bots
  CROSS JOIN (VALUES ('username'), ('password'), ('portal_url'), ('interval')) AS settings(column_name)
) sub
WHERE val IS NOT NULL
ON CONFLICT (bot_id, setting_key) DO NOTHING;


-- Dedupe any existing duplicate panels (keep earliest row per panel_url)
DELETE FROM number_panels a
USING number_panels b
WHERE a.panel_url = b.panel_url
  AND a.created_at > b.created_at;

-- Ensure panel_url is unique so re-running this seed is idempotent
ALTER TABLE number_panels DROP CONSTRAINT IF EXISTS number_panels_panel_url_key;
ALTER TABLE number_panels ADD CONSTRAINT number_panels_panel_url_key UNIQUE (panel_url);

INSERT INTO number_panels (name, panel_url, username, password, status)
VALUES 
    ('IMS Pool Panel', 'https://www.imssms.org/login', 'mamun99', 'mamun@12aa#', 'offline'),
    ('Hadi Pool Panel', 'http://2.59.169.96/ints/login', 'mamun999', 'mamun999', 'offline'),
    ('Shark Pool Panel', 'http://65.109.111.158/ints/login', 'mamun01', 'mamun@12#A', 'offline')
ON CONFLICT (panel_url) DO NOTHING;

-- SMS Ranges seeding
CREATE TABLE IF NOT EXISTS sms_ranges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prefix TEXT UNIQUE NOT NULL,
    name TEXT,
    test_number TEXT,
    currency TEXT DEFAULT 'USD',
    payout_1_1 NUMERIC,
    payout_7_1 NUMERIC,
    payout_7_7 NUMERIC,
    payout_30_45 NUMERIC,
    memo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- SMS Logs seeding (for stats and recent activity)
CREATE TABLE IF NOT EXISTS sms_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES profiles(id),
    client_id UUID REFERENCES clients(id),
    number TEXT NOT NULL,
    otp_code TEXT,
    payout NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'success',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_agent_id ON sms_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_client_id ON sms_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON sms_logs(created_at);


-- News seeding
CREATE TABLE IF NOT EXISTS news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Active Rates seeding
CREATE TABLE IF NOT EXISTS active_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country TEXT,
    provider TEXT,
    type TEXT,
    rate NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

