import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, LogIn, LogOut, ArrowLeft } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    try {
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      // Filter out self and handle admin view
      setAgents(data?.filter((a: any) => a.role !== 'admin') || []);
    } catch (err) {
      console.error("Fetch agents error:", err);
    }
    setLoading(false);
  };

  const handleImpersonate = (agentId: string) => {
    sessionStorage.setItem('impersonated_agent_id', agentId);
    toast.success("Impersonating agent mode enabled");
    navigate({ to: "/dashboard" });
  };

  const handleExitAdmin = async () => {
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-[#f8f9fc] p-6 rounded-2xl border border-[#e3e6ec] shadow-sm">
        <div className="flex items-center gap-4">
           <div className="bg-[#0061f2] p-3 rounded-xl shadow-lg shadow-blue-100">
              <Users className="text-white" size={24} />
           </div>
           <div>
              <h1 className="text-2xl font-black text-[#2b3a4a] tracking-tighter uppercase">Admin Central</h1>
              <p className="text-[#69707a] text-[11px] font-black uppercase tracking-widest mt-1 opacity-70">Infrastructure & Logistics Control</p>
           </div>
        </div>
        <Button onClick={handleExitAdmin} variant="outline" className="h-11 border-slate-200 text-slate-600 font-black uppercase text-[11px] px-6 rounded-xl hover:bg-white shadow-sm transition-all group">
           <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Exit to Dashboard
        </Button>
      </div>

      <Tabs defaultValue="agents" className="space-y-6">
        <TabsList className="bg-white border border-[#e3e6ec] p-1.5 h-14 rounded-2xl shadow-lg inline-flex w-full md:w-auto">
          <TabsTrigger value="agents" className="data-[state=active]:bg-[#0061f2] data-[state=active]:text-white font-black uppercase text-[10px] px-8 h-full rounded-xl transition-all">Agents</TabsTrigger>
          <TabsTrigger value="payouts" className="data-[state=active]:bg-[#0061f2] data-[state=active]:text-white font-black uppercase text-[10px] px-8 h-full rounded-xl transition-all">Payouts</TabsTrigger>
          <TabsTrigger value="bots" className="data-[state=active]:bg-[#0061f2] data-[state=active]:text-white font-black uppercase text-[10px] px-8 h-full rounded-xl transition-all">Bots & Ingest</TabsTrigger>
          <TabsTrigger value="banned" className="data-[state=active]:bg-[#e81500] data-[state=active]:text-white font-black uppercase text-[10px] px-8 h-full rounded-xl transition-all">Banned Watch</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4 outline-none">
          <Card className="shadow-2xl border-[#e3e6ec] rounded-2xl overflow-hidden border-none">
             <CardContent className="p-0">
               <Table>
                  <TableHeader>
                    <TableRow className="bg-[#f8f9fc] hover:bg-[#f8f9fc]">
                      <TableHead className="px-6 py-5 text-[10px] font-black uppercase text-[#69707a] tracking-widest">Agent Username</TableHead>
                      <TableHead className="px-6 py-5 text-[10px] font-black uppercase text-[#69707a] tracking-widest">Account Status</TableHead>
                      <TableHead className="px-6 py-5 text-[10px] font-black uppercase text-[#69707a] tracking-widest">Joined</TableHead>
                      <TableHead className="px-6 py-5 text-[10px] font-black uppercase text-[#69707a] tracking-widest text-center">Admin Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-20"><div className="w-8 h-8 border-4 border-[#0061f2] border-t-transparent rounded-full animate-spin mx-auto"></div></TableCell></TableRow>
                    ) : agents.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-20 text-[#69707a] italic">No agents registered yet</TableCell></TableRow>
                    ) : (
                      agents.map((agent) => (
                        <tr key={agent.id} className="border-b border-[#f2f4f8] hover:bg-[#f8f9fc]/50 transition-colors">
                          <td className="px-6 py-4">
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs uppercase border border-slate-200">
                                   {agent.username?.substring(0, 2)}
                                </div>
                                <span className="font-bold text-[#2b3a4a] text-sm">{agent.username}</span>
                             </div>
                          </td>
                          <td className="px-6 py-4">
                             <span className="bg-green-50 text-green-600 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border border-green-100 shadow-sm">{agent.status || 'Active'}</span>
                          </td>
                          <td className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-tighter">
                             {new Date(agent.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Button 
                              onClick={() => handleImpersonate(agent.id)}
                              variant="ghost" size="sm" 
                              className="text-[#0061f2] hover:bg-blue-50 font-black uppercase text-[10px] px-4 h-9 rounded-xl border border-transparent hover:border-blue-100 transition-all"
                            >
                              <LogIn size={14} className="mr-2" /> Login As Agent
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </TableBody>
               </Table>
             </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts" className="outline-none">
          <PayoutsTab />
        </TabsContent>

        <TabsContent value="bots" className="outline-none">
          <BotsTab />
        </TabsContent>

        <TabsContent value="banned" className="outline-none">
          <BannedWatchTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

