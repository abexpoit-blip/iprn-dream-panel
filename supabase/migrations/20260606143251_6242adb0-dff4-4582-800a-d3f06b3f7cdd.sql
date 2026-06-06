CREATE TABLE public.active_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country TEXT NOT NULL,
    provider TEXT NOT NULL,
    type TEXT NOT NULL, -- e.g. TF, JV
    rate DECIMAL(10,3) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.active_rates TO authenticated;
GRANT ALL ON public.active_rates TO service_role;
ALTER TABLE public.active_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view active rates" ON public.active_rates FOR SELECT TO authenticated USING (true);

-- Insert some dummy data matching the screenshot
INSERT INTO public.active_rates (country, provider, type, rate) VALUES
('Sudan', 'Sudatel', 'TF', 0.017),
('Sudan', 'Sudatel', 'JV', 0.017),
('Mozambique', 'Movitel', 'TF', 0.016),
('Mozambique', 'Movitel', 'JV', 0.016),
('Mozambique', 'Tmcel', 'TF', 0.016),
('Mozambique', 'Tmcel', 'JV', 0.016),
('Zambia', 'Zamtel', 'TF', 0.015),
('Zambia', 'Zamtel', 'JV', 0.015);

-- SMS CDR (Call Detail Records / SMS Logs)
CREATE TABLE public.sms_cdr (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.profiles(id),
    client_id UUID REFERENCES public.clients(id),
    number TEXT NOT NULL,
    prefix TEXT,
    message TEXT,
    payout DECIMAL(10,3) DEFAULT 0.010,
    status TEXT DEFAULT 'success',
    received_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_cdr TO authenticated;
GRANT ALL ON public.sms_cdr TO service_role;
ALTER TABLE public.sms_cdr ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents see their own CDR" ON public.sms_cdr FOR SELECT USING (auth.uid() = agent_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Add some dummy data for CDR
INSERT INTO public.sms_cdr (number, prefix, message, payout, status)
SELECT 
    '+234' || (random()*1000000000)::bigint,
    '234',
    'Your OTP is ' || (random()*10000)::int,
    0.01,
    'success'
FROM generate_series(1, 50);
