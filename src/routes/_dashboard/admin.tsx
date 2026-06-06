import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, ShieldCheck, Settings, BarChart3, Bot, DollarSign, Ban, Search, CheckCircle2, XCircle, LogIn } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PayoutsTab } from "@/components/admin/PayoutsTab";
import { BotsTab } from "@/components/admin/BotsTab";
import { BannedWatchTab } from "@/components/admin/BannedWatchTab";

export const Route = createFileRoute("/_dashboard/admin")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/login" }); return; }
      
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single();
      if (!profile?.is_admin) {
        toast.error("Access Denied");
        navigate({ to: "/dashboard" });
        return;
      }
      fetchData();
    };
    checkAdmin();
  }, [navigate]);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setAgents(data || []);
    setLoading(false);
  };

  const handleImpersonate = (agentId: string) => {
    sessionStorage.setItem('impersonated_agent_id', agentId);
    toast.success("Impersonating agent mode enabled");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-[#2b3a4a] tracking-tighter uppercase">Admin Control Panel</h1>
          <p className="text-[#69707a] text-[13px] font-medium mt-1">Manage infrastructure, agents, and payouts</p>
        </div>
      </div>

      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList className="bg-white border border-[#e3e6ec] p-1 h-12 rounded-xl shadow-sm">
          <TabsTrigger value="agents" className="data-[state=active]:bg-[#0061f2] data-[state=active]:text-white font-bold uppercase text-[11px] px-6 h-full">Agents</TabsTrigger>
          <TabsTrigger value="payouts" className="data-[state=active]:bg-[#0061f2] data-[state=active]:text-white font-bold uppercase text-[11px] px-6 h-full">Payouts</TabsTrigger>
          <TabsTrigger value="bots" className="data-[state=active]:bg-[#0061f2] data-[state=active]:text-white font-bold uppercase text-[11px] px-6 h-full">Bots & Pool</TabsTrigger>
          <TabsTrigger value="banned" className="data-[state=active]:bg-[#0061f2] data-[state=active]:text-white font-bold uppercase text-[11px] px-6 h-full">Banned Watch</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
             <CardContent className="p-0">
               <table className="w-full text-left">
                  <thead className="bg-[#f8f9fc] border-b border-[#e3e6ec]">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-[#69707a]">Agent</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-[#69707a]">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-[#69707a] text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent) => (
                      <tr key={agent.id} className="border-b border-[#f2f4f8]">
                        <td className="px-6 py-4 font-bold text-[#2b3a4a]">{agent.username}</td>
                        <td className="px-6 py-4"><span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold uppercase">{agent.status || 'Active'}</span></td>
                        <td className="px-6 py-4 text-center">
                          <Button 
                            onClick={() => handleImpersonate(agent.id)}
                            variant="ghost" size="sm" 
                            className="text-[#0061f2] hover:bg-blue-50 font-bold uppercase text-[10px]"
                          >
                            <LogIn size={14} className="mr-1" /> Login As
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
             </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts">
          <PayoutsTab />
        </TabsContent>

        <TabsContent value="bots">
          <BotsTab />
        </TabsContent>

        <TabsContent value="banned">
          <BannedWatchTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
