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

export const Route = createFileRoute("/_client/stats/sms")({
  component: ClientSmsStatsPage,
});

function ClientSmsStatsPage() {
  const { data: rows, isLoading } = useQuery({
    queryKey: ["client_sms_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">SMS Stats</h1>
        <p className="text-[#69707a] text-[13px] font-medium mt-0.5">
          Recent SMS / OTP delivery logs
        </p>
      </div>

      <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc]">
          <h3 className="font-black text-[#69707a] uppercase text-[11px] tracking-widest">
            SMS Log
          </h3>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-none bg-[#f8f9fc] hover:bg-[#f8f9fc]">
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">
                    Number
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">
                    OTP
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">
                    Payout
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">
                    Status
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">
                    Time
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16">
                      <div className="w-8 h-8 border-4 border-[#0061f2] border-t-transparent rounded-full animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : rows?.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-16 text-[#69707a] text-[13px] italic font-medium"
                    >
                      No SMS logs yet
                    </TableCell>
                  </TableRow>
                ) : (
                  rows?.map((r: any, idx: number) => (
                    <TableRow
                      key={r.id}
                      className={cn(
                        "border-b border-[#f2f4f8] hover:bg-gray-50/50",
                        idx % 2 === 0 ? "bg-white" : "bg-[#fcfcfd]"
                      )}
                    >
                      <TableCell className="px-6 py-4 text-[13px] font-bold text-[#2b3a4a]">
                        {r.number}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-[13px] font-mono font-bold text-[#0061f2]">
                        {r.otp_code || "—"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-[13px] font-bold text-[#00ac69]">
                        ${Number(r.payout || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider",
                            r.status === "delivered"
                              ? "bg-green-500 text-white"
                              : "bg-gray-400 text-white"
                          )}
                        >
                          {r.status || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-[13px] text-[#69707a]">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
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
