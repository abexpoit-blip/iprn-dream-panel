-- Extend bots table
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS number_panel_type TEXT;

-- Number Panels table (for separate pooling login)
CREATE TABLE IF NOT EXISTS public.number_panels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    panel_url TEXT NOT NULL,
    username TEXT,
    password TEXT,
    status TEXT DEFAULT 'offline',
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Update number_pool to link to panels
ALTER TABLE public.number_pool ADD COLUMN IF NOT EXISTS number_panel_id UUID REFERENCES public.number_panels(id) ON DELETE SET NULL;

-- Permissions
GRANT ALL ON public.number_panels TO service_role;
GRANT ALL ON public.number_panels TO authenticated;

-- RLS
ALTER TABLE public.number_panels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage number panels" ON public.number_panels
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
