import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_dashboard/stats/number")({
  component: StatsNumberPage,
});

function StatsNumberPage() {
  const { data: numberStats, isLoading } = useQuery({
    queryKey: ['number_volume_stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sms_logs')
        .select('number, payout')
        .order('created_at', { ascending: false })
        .limit(2000);
      
      if (error) throw error;

      const aggregated = data.reduce((acc: any, log: any) => {
        if (!acc[log.number]) acc[log.number] = { number: log.number, count: 0, payout: 0 };
        acc[log.number].count += 1;
        acc[log.number].payout += Number(log.payout || 0);
        return acc;
      }, {});

      return Object.values(aggregated).sort((a: any, b: any) => b.count - a.count).slice(0, 50);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">Number Stats</h1>
          <p className="text-[#69707a] text-[13px] font-medium mt-0.5">Top performing numbers by SMS volume</p>
        </div>
      </div>

      <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc]">
          <h3 className="font-black text-[#69707a] uppercase text-[11px] tracking-widest">Top Active Numbers</h3>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-[#f8f9fc]">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Phone Number</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">SMS Received</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Total Payout</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-20">Analyzing traffic...</TableCell></TableRow>
              ) : numberStats?.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-20 italic">No activity data found</TableCell></TableRow>
              ) : numberStats?.map((stat: any, idx: number) => (
                <TableRow key={idx} className="border-b border-[#f2f4f8]">
                  <TableCell className="text-[13px] font-bold text-[#2b3a4a] px-6 py-4">{stat.number}</TableCell>
                  <TableCell className="text-[13px] font-black text-[#0061f2] px-6 py-4">{stat.count}</TableCell>
                  <TableCell className="text-[13px] font-bold text-[#00ac69] px-6 py-4">${stat.payout.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

