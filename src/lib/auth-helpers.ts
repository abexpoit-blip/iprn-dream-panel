import { supabase } from "@/integrations/supabase/client";

export const getEffectiveUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const impersonatedId = sessionStorage.getItem('impersonated_agent_id');
  if (impersonatedId) {
    // Verify current user is admin before allowing impersonation
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    
    if (profile?.is_admin) {
      return impersonatedId;
    }
  }

  return user.id;
};
