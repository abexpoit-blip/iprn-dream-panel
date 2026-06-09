import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/client/stats/sms")({
  component: ClientSmsStatsPage,
});

// RLS on otp_audit_log restricts this query to OTPs delivered on numbers
// where number_pool.assigned_client belongs to the signed-in client.
function ClientSmsStatsPage() {
  const { data: rows, isLoading } = useQuery({
    queryKey: ["client_otp_audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("otp_audit_log")
        .select("id,phone_number,cli,otp_code,sms_text,outcome,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">My OTPs</h1>
        <p className="text-[#69707a] text-[13px] font-medium mt-0.5">
          OTPs received on numbers allocated to you.
        </p>
      </div>

      <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc]">
          <h3 className="font-black text-[#69707a] uppercase text-[11px] tracking-widest">
            Recent OTP Log
          </h3>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-none bg-[#f8f9fc] hover:bg-[#f8f9fc]">
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Time</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Number</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">CLI</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">OTP</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Message</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16">
                      <div className="w-8 h-8 border-4 border-[#0061f2] border-t-transparent rounded-full animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : !rows || rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16 text-[#69707a] text-[13px] italic font-medium">
                      No OTPs yet for your allocated numbers.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r: any, idx: number) => (
                    <TableRow
                      key={r.id}
                      className={cn(
                        "border-b border-[#f2f4f8] hover:bg-gray-50/50",
                        idx % 2 === 0 ? "bg-white" : "bg-[#fcfcfd]",
                      )}
                    >
                      <TableCell className="px-6 py-4 text-[12px] text-[#69707a]">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-[13px] font-bold text-[#2b3a4a]">
                        {r.phone_number || "—"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-[12px] text-[#2b3a4a]">{r.cli || "—"}</TableCell>
                      <TableCell className="px-6 py-4 text-[13px] font-mono font-bold text-[#0061f2]">
                        {r.otp_code || "—"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-[12px] text-[#69707a] max-w-[380px]">
                        <span className="line-clamp-2 block">{r.sms_text || "—"}</span>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider",
                            r.outcome === "billed" ? "bg-emerald-500 text-white" : "bg-gray-400 text-white",
                          )}
                        >
                          {r.outcome || "—"}
                        </span>
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
