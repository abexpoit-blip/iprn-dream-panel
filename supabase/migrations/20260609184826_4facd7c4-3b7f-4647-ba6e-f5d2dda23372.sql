CREATE OR REPLACE FUNCTION public.notify_scrape_now()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_notify('scrape_now', '');
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_scrape_now() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_scrape_now() FROM anon;