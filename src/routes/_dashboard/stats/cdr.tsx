import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
          <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">SMS CDR</h1>
          <p className="text-[#69707a] text-[13px] font-medium mt-0.5">Call Detail Records - Detailed SMS logs</p>
        </div>
      </div>
      
      <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc]">
            <h3 className="font-black text-[#69707a] uppercase text-[11px] tracking-widest">Transaction Logs</h3>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-none bg-[#f8f9fc] hover:bg-[#f8f9fc]">
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Phone Number</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">OTP Code</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">CLI/Source</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Amount (BDT)</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Status</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Received At</TableHead>
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
                      <TableCell className="text-[13px] font-bold text-[#2b3a4a] px-6 py-4">{log.phone_number}</TableCell>
                      <TableCell className="text-[13px] font-black text-[#e81500] px-6 py-4">{log.otp_code || 'PENDING'}</TableCell>
                      <TableCell className="text-[13px] text-[#69707a] px-6 py-4">{log.cli || '-'}</TableCell>
                      <TableCell className="text-[13px] font-bold text-[#0061f2] px-6 py-4">{log.price_bdt} BDT</TableCell>
                      <TableCell className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                          log.status === 'success' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}>
                          {log.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-[11px] font-medium text-[#69707a] px-6 py-4">
                        {log.received_at ? new Date(log.received_at).toLocaleString() : '-'}
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

