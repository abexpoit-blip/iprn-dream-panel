-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'agent' CHECK (role IN ('admin', 'agent', 'client')),
  skype_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create sms_ranges table
CREATE TABLE public.sms_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix TEXT NOT NULL,
  test_number TEXT,
  currency TEXT DEFAULT 'USD',
  payout_1_1 NUMERIC(10, 4) DEFAULT 0,
  payout_7_1 NUMERIC(10, 4) DEFAULT 0,
  payout_7_7 NUMERIC(10, 4) DEFAULT 0,
  payout_30_45 NUMERIC(10, 4) DEFAULT 0,
  memo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT ON public.sms_ranges TO authenticated;
GRANT ALL ON public.sms_ranges TO service_role;
ALTER TABLE public.sms_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view ranges" ON public.sms_ranges
  FOR SELECT TO authenticated USING (true);

-- Create clients table (Agent sub-accounts)
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.profiles(id),
  username TEXT NOT NULL,
  email TEXT,
  skype_id TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can manage their own clients" ON public.clients
  FOR ALL USING (auth.uid() = agent_id);

-- Create sms_logs table
CREATE TABLE public.sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id),
  agent_id UUID REFERENCES public.profiles(id),
  number TEXT NOT NULL,
  otp_code TEXT,
  payout NUMERIC(10, 4) DEFAULT 0.01,
  status TEXT DEFAULT 'success',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT ON public.sms_logs TO authenticated;
GRANT ALL ON public.sms_logs TO service_role;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view logs for their clients" ON public.sms_logs
  FOR SELECT USING (auth.uid() = agent_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
