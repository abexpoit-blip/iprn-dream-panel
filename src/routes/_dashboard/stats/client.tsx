import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getEffectiveUserId } from "@/lib/auth-helpers";

export const Route = createFileRoute("/_dashboard/stats/client")({
  component: StatsClientPage,
});

function StatsClientPage() {
  const { data: clientStats, isLoading } = useQuery({
    queryKey: ['client_performance_stats'],
    queryFn: async () => {
      const userId = await getEffectiveUserId();
      if (!userId) return [];

      // Fetch clients and their SMS activity
      const { data: clients } = await supabase
        .from('clients')
        .select('id, username')
        .eq('agent_id', userId);

      if (!clients) return [];

      // For each client, calculate stats
      const stats = await Promise.all(clients.map(async (client: any) => {
        const { count } = await supabase
          .from('sms_logs')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', client.id);
        
        return {
          username: client.username,
          total_sms: count || 0,
        };
      }));

      return stats.sort((a, b) => b.total_sms - a.total_sms);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">Client Stats</h1>
          <p className="text-[#69707a] text-[13px] font-medium mt-0.5">Performance ranking by client</p>
        </div>
      </div>

      <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc]">
          <h3 className="font-black text-[#69707a] uppercase text-[11px] tracking-widest">Client Leaderboard</h3>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-[#f8f9fc]">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Rank</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Client Username</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Total SMS Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-20">Calculating stats...</TableCell></TableRow>
              ) : clientStats?.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-20 italic">No client data found</TableCell></TableRow>
              ) : clientStats?.map((stat: any, idx: number) => (
                <TableRow key={idx} className="border-b border-[#f2f4f8]">
                  <TableCell className="px-6 py-4">
                    <span className={cn(
                      "w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black text-white",
                      idx === 0 ? "bg-amber-400" : idx === 1 ? "bg-slate-400" : idx === 2 ? "bg-amber-700" : "bg-[#69707a]"
                    )}>
                      {idx + 1}
                    </span>
                  </TableCell>
                  <TableCell className="text-[13px] font-bold text-[#2b3a4a] px-6 py-4">{stat.username}</TableCell>
                  <TableCell className="text-[13px] font-black text-[#0061f2] px-6 py-4">{stat.total_sms.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

