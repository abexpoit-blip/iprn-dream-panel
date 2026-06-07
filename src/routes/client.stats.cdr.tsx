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
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/client/stats/cdr")({
  component: ClientCdrPage,
});

function ClientCdrPage() {
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: rows, isLoading } = useQuery({
    queryKey: ["client_sms_cdr"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_cdr")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const filteredRows = rows?.filter((r: any) => 
    r.number?.includes(searchTerm) || 
    r.prefix?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.message?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleExport = () => {
    const headers = ["Number", "Prefix", "Message", "Payout", "Status", "Received"];
    const csvData = filteredRows.map((r: any) => [
      r.number,
      r.prefix || "—",
      (r.message || "—").toString().replace(/,/g, " "),
      `$${Number(r.payout || 0).toFixed(2)}`,
      r.status || "—",
      r.received_at ? new Date(r.received_at).toLocaleString() : "—"
    ]);

    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Client_CDR_${new Date().toISOString()}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">SMS CDR</h1>
          <p className="text-[#69707a] text-[13px] font-medium mt-0.5">
            Call Detail Records of received SMS
          </p>
        </div>
        <Button 
          onClick={handleExport}
          className="bg-[#0061f2] h-10 text-xs font-bold uppercase shadow-md"
        >
          CSV Export
        </Button>
      </div>

      <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc] flex items-center justify-between">
          <h3 className="font-black text-[#69707a] uppercase text-[11px] tracking-widest">
            Recent CDR
          </h3>
          <input 
            placeholder="Search..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 w-64 bg-white border border-[#e3e6ec] rounded px-3 text-xs focus:ring-1 focus:ring-[#0061f2] outline-none"
          />
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
                    Prefix
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">
                    Message
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">
                    Payout
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">
                    Status
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">
                    Received
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16">
                      <div className="w-8 h-8 border-4 border-[#0061f2] border-t-transparent rounded-full animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredRows?.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-16 text-[#69707a] text-[13px] italic font-medium"
                    >
                      No CDR records yet
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows?.map((r: any, idx: number) => (
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
                      <TableCell className="px-6 py-4 text-[13px] text-[#69707a]">
                        {r.prefix || "—"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-[13px] text-[#69707a] max-w-xs truncate">
                        {r.message || "—"}
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
                        {r.received_at ? new Date(r.received_at).toLocaleString() : "—"}
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
