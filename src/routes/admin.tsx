import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminRedirect,
});

function AdminRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/login" });
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single();
      if (profile?.is_admin) {
        navigate({ to: "/admin" });
      } else {
        toast.error("Access Denied");
        navigate({ to: "/dashboard" });
      }
    };
    checkAdmin();
  }, [navigate]);

  return <div className="p-8 text-center text-slate-500 font-bold uppercase text-xs tracking-widest animate-pulse">Redirecting to Admin Panel...</div>;
}
