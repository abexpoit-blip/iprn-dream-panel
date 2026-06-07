import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_dashboard/stats/range")({
  component: StatsRangePage,
});

function StatsRangePage() {
  const { data: rangeStats, isLoading } = useQuery({
    queryKey: ['range_performance_stats'],
    queryFn: async () => {
      // Fetch ranges and their SMS activity
      const { data: ranges } = await supabase
        .from('sms_ranges')
        .select('id, prefix, name, memo');

      if (!ranges) return [];

      const stats = await Promise.all(ranges.map(async (range: any) => {
        const res = await supabase
          .from('sms_logs')
          .select('*', { count: 'exact' })
          .ilike('number', `${range.prefix}%`);
        
        return {
          name: range.name || range.memo || range.prefix,
          prefix: range.prefix,
          total_sms: res.count || 0,
        };
      }));

      return stats.sort((a, b) => b.total_sms - a.total_sms);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">Range Stats</h1>
          <p className="text-[#69707a] text-[13px] font-medium mt-0.5">Traffic volume by number range/prefix</p>
        </div>
      </div>

      <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc]">
          <h3 className="font-black text-[#69707a] uppercase text-[11px] tracking-widest">Range Performance</h3>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-[#f8f9fc]">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Prefix</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Range Name</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Total SMS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-20">Analyzing traffic...</TableCell></TableRow>
              ) : rangeStats?.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-20 italic">No range data found</TableCell></TableRow>
              ) : rangeStats?.map((stat: any, idx: number) => (
                <TableRow key={idx} className="border-b border-[#f2f4f8]">
                  <TableCell className="text-[13px] font-black text-[#e81500] px-6 py-4">{stat.prefix}</TableCell>
                  <TableCell className="text-[13px] font-bold text-[#2b3a4a] px-6 py-4">{stat.name}</TableCell>
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

