-- Update RLS for profiles: admins see all, agents see only self
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Profiles are viewable by self or admin" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Update RLS for sms_ranges: viewable by all authenticated
-- No changes needed as it's already "Anyone authenticated can view ranges"

-- Update RLS for clients: agents see their own, admins see all
DROP POLICY IF EXISTS "Agents can manage their own clients" ON public.clients;
CREATE POLICY "Clients management" ON public.clients
  FOR ALL USING (
    auth.uid() = agent_id OR 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Update RLS for sms_logs: agents see their own, admins see all
DROP POLICY IF EXISTS "Agents can view logs for their clients" ON public.sms_logs;
CREATE POLICY "SMS Logs access" ON public.sms_logs
  FOR SELECT USING (
    auth.uid() = agent_id OR 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
