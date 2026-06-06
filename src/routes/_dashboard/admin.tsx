import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  ShieldCheck, 
  Settings, 
  BarChart3, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Search
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_dashboard/admin")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/login" });
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

      if (!profile?.is_admin) {
        toast.error("Access Denied", {
          description: "You do not have administrator privileges."
        });
        navigate({ to: "/dashboard" });
        return;
      }

      fetchAgents();
    };

    checkAdmin();
  }, [navigate]);

  const fetchAgents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error("Error fetching agents");
    } else {
      setAgents(data || []);
    }
    setLoading(false);
  };

  const handleStatusChange = async (agentId: string, newStatus: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', agentId);

    if (error) {
      toast.error("Update failed");
    } else {
      toast.success(`Agent ${newStatus} successfully`);
      fetchAgents();
    }
  };

  const filteredAgents = agents.filter(agent => 
    agent.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = [
    { label: "Total Agents", value: agents.length, icon: Users, color: "blue" },
    { label: "Pending Approval", value: agents.filter(a => a.status === 'pending').length, icon: AlertCircle, color: "amber" },
    { label: "Approved Agents", value: agents.filter(a => a.status === 'approved').length, icon: CheckCircle2, color: "green" },
    { label: "Admin Users", value: agents.filter(a => a.is_admin).length, icon: ShieldCheck, color: "indigo" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">Admin Control Panel</h1>
          <p className="text-[#69707a] text-[13px] font-medium mt-0.5">Manage agents and system-wide settings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="text-xs font-bold uppercase border-[#e3e6ec] h-9 px-4">
            <Settings size={14} className="mr-2" />
            System Config
          </Button>
          <Button className="bg-[#0061f2] hover:bg-[#0052ce] text-white text-xs font-bold uppercase h-9 px-4">
            <BarChart3 size={14} className="mr-2" />
            Global Reports
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <Card key={idx} className="border-none shadow-md overflow-hidden bg-white hover:shadow-lg transition-all duration-300 group">
            <CardContent className="p-0">
              <div className="flex items-stretch h-24">
                <div className={cn(
                  "w-1.5",
                  stat.color === 'blue' && "bg-[#0061f2]",
                  stat.color === 'amber' && "bg-amber-500",
                  stat.color === 'green' && "bg-green-500",
                  stat.color === 'indigo' && "bg-indigo-600"
                )}></div>
                <div className="flex-1 p-5 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase text-[#69707a] tracking-widest mb-1">{stat.label}</p>
                    <h3 className="text-2xl font-black text-[#2b3a4a]">{stat.value}</h3>
                  </div>
                  <div className={cn(
                    "p-3 rounded-xl transition-transform group-hover:scale-110 duration-300",
                    stat.color === 'blue' && "bg-blue-50 text-[#0061f2]",
                    stat.color === 'amber' && "bg-amber-50 text-amber-500",
                    stat.color === 'green' && "bg-green-50 text-green-500",
                    stat.color === 'indigo' && "bg-indigo-50 text-indigo-600"
                  )}>
                    <stat.icon size={24} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc] flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="font-black text-[#69707a] uppercase text-[11px] tracking-widest">Agent Management</h3>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Input 
                className="h-9 bg-white border-[#e3e6ec] text-[13px] pl-9 pr-3 focus:ring-[#0061f2] rounded-lg"
                placeholder="Search agents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7aeb8]">
                <Search size={14} />
              </div>
            </div>
          </div>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-none bg-[#f8f9fc] hover:bg-[#f8f9fc]">
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Agent Name</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Role / Type</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Status</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Joined</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20">
                      <div className="w-8 h-8 border-4 border-[#0061f2] border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </TableCell>
                  </TableRow>
                ) : filteredAgents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-[#69707a] text-[13px] italic">No agents found</TableCell>
                  </TableRow>
                ) : (
                  filteredAgents.map((agent, idx) => (
                    <TableRow key={agent.id} className={cn("border-b border-[#f2f4f8] transition-colors", idx % 2 === 0 ? "bg-white" : "bg-[#fcfcfd]")}>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs uppercase",
                            agent.is_admin ? "bg-indigo-100 text-indigo-700" : "bg-blue-100 text-[#0061f2]"
                          )}>
                            {agent.username?.[0] || 'A'}
                          </div>
                          <div>
                            <p className="text-[13px] font-bold text-[#2b3a4a]">{agent.username}</p>
                            <p className="text-[11px] text-[#69707a]">{agent.full_name}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          agent.is_admin ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-slate-50 text-slate-600 border border-slate-200"
                        )}>
                          {agent.is_admin ? 'Super Admin' : (agent.role || 'Agent')}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider uppercase shadow-sm text-white",
                          agent.status === 'approved' ? "bg-green-500" : agent.status === 'pending' ? "bg-amber-500" : "bg-red-500"
                        )}>
                          {agent.status || 'pending'}
                        </span>
                      </TableCell>
                      <TableCell className="text-[12px] font-medium text-[#69707a] px-6 py-4">
                        {new Date(agent.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          {agent.status !== 'approved' && (
                            <Button 
                              onClick={() => handleStatusChange(agent.id, 'approved')}
                              variant="ghost" 
                              size="sm" 
                              className="h-8 px-2 text-green-600 hover:bg-green-50 hover:text-green-700 font-bold text-[10px] uppercase"
                            >
                              <CheckCircle2 size={14} className="mr-1" /> Approve
                            </Button>
                          )}
                          {agent.status !== 'suspended' && (
                            <Button 
                              onClick={() => handleStatusChange(agent.id, 'suspended')}
                              variant="ghost" 
                              size="sm" 
                              className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold text-[10px] uppercase"
                            >
                              <XCircle size={14} className="mr-1" /> Suspend
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
