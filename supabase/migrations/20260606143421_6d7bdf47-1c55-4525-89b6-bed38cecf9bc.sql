ALTER TABLE public.sms_ranges ADD COLUMN IF NOT EXISTS name TEXT;
UPDATE public.sms_ranges SET name = memo WHERE name IS NULL;
