import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/_dashboard/stats/sms")({
  component: StatsSmsPage,
});

function StatsSmsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['sms_stats_report'],
    queryFn: async () => {
      // Fetch recent logs
      const { data, error } = await supabase
        .from('sms_logs')
        .select('*')
        .limit(1000);
      
      if (error) throw error;

      const aggregated = (data || []).reduce((acc: any, log: any) => {
        const date = new Date(log.created_at).toLocaleDateString();
        if (!acc[date]) acc[date] = { date, count: 0, payout: 0 };
        acc[date].count += 1;
        acc[date].payout += Number(log.payout || 0);
        return acc;
      }, {});

      return Object.values(aggregated).slice(0, 15);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">SMS Stats Report</h1>
          <p className="text-[#69707a] text-[13px] font-medium mt-0.5">Daily SMS traffic and payout performance</p>
        </div>
      </div>

      <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc]">
          <h3 className="font-black text-[#69707a] uppercase text-[11px] tracking-widest">Daily Performance</h3>
        </div>
        <CardContent className="p-6">
          <div className="h-[300px] w-full mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e6ec" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#69707a' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#69707a' }} />
                <Tooltip />
                <Bar dataKey="count" name="SMS Count" fill="#0061f2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="border border-[#e3e6ec] rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-[#f8f9fc]">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Date</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Total SMS</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Total Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-10">Loading...</TableCell></TableRow>
                ) : stats?.map((s: any, idx: number) => (
                  <TableRow key={idx} className="border-b border-[#f2f4f8]">
                    <TableCell className="text-[13px] font-medium text-[#2b3a4a] px-6 py-4">{s.date}</TableCell>
                    <TableCell className="text-[13px] font-bold text-[#0061f2] px-6 py-4">{s.count}</TableCell>
                    <TableCell className="text-[13px] font-bold text-[#00ac69] px-6 py-4">${s.payout.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

