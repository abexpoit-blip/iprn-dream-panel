import { supabase } from "@/integrations/supabase/client";

export type AppRole = "agent" | "client" | "admin";

export async function getCurrentRole(): Promise<AppRole | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("role, is_admin, status")
    .eq("id", user.id)
    .single();
  if (!data) return null;
  if (data.is_admin) return "admin";
  if (data.role === "client") return "client";
  return "agent";
}
