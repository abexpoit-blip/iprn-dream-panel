
REVOKE EXECUTE ON FUNCTION public.current_client_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_client_id() TO authenticated;
