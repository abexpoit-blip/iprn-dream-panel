import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_dashboard/stats/cdr")({
  component: StatsCDRPage,
});

function StatsCDRPage() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['sms_cdr'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sms_cdr')
        .select('*')
        .order('received_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">SMS CDR Reports</h1>
          <p className="text-[#69707a] text-[13px] font-medium mt-0.5">Call Detail Records - Detailed SMS logs</p>
        </div>
      </div>

      <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc]">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-[#69707a]">Start Date</label>
                <input type="datetime-local" className="w-full h-9 border rounded-lg px-3 text-xs" />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-[#69707a]">End Date</label>
                <input type="datetime-local" className="w-full h-9 border rounded-lg px-3 text-xs" />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-[#69707a]">Filter Range</label>
                <select className="w-full h-9 border rounded-lg px-3 text-xs"><option>All Ranges</option></select>
             </div>
             <div className="flex items-end gap-2">
                <Button className="bg-[#0061f2] h-9 text-xs font-bold uppercase flex-1">Show Report</Button>
                <Button variant="outline" className="h-9 text-xs font-bold uppercase border-amber-500 text-amber-600">Excel</Button>
             </div>
          </div>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-none bg-[#f8f9fc] hover:bg-[#f8f9fc]">
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Date</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Range</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Number</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">CLI</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Client</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">SMS</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Currency</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">My Payout</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Client Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-[#0061f2] border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm text-[#69707a] font-medium">Loading transaction logs...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : logs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-[#69707a] text-[13px] italic font-medium">
                      No transaction logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs?.map((log: any, idx: number) => (
                    <TableRow key={log.id} className={cn("border-b border-[#f2f4f8] hover:bg-gray-50/50 transition-colors", idx % 2 === 0 ? "bg-white" : "bg-[#fcfcfd]")}>
                      <TableCell className="text-[12px] font-medium text-[#69707a] px-6 py-4">{new Date(log.received_at || log.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-[12px] font-bold text-[#2b3a4a] px-6 py-4">{log.range || '-'}</TableCell>
                      <TableCell className="text-[12px] font-bold text-[#0061f2] px-6 py-4">{log.phone_number || log.number}</TableCell>
                      <TableCell className="text-[12px] font-medium text-[#69707a] px-6 py-4">{log.cli || '-'}</TableCell>
                      <TableCell className="text-[12px] font-bold text-[#2b3a4a] px-6 py-4">{log.client_name || 'Agent'}</TableCell>
                      <TableCell className="text-[12px] text-[#69707a] px-6 py-4 max-w-xs truncate">{log.message || log.sms_text || log.otp_code}</TableCell>
                      <TableCell className="text-[12px] font-bold text-[#69707a] px-6 py-4">USD</TableCell>
                      <TableCell className="text-[12px] font-black text-green-600 px-6 py-4">${log.my_payout || '0.00'}</TableCell>
                      <TableCell className="text-[12px] font-black text-[#e81500] px-6 py-4">${log.client_payout || '0.00'}</TableCell>
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

