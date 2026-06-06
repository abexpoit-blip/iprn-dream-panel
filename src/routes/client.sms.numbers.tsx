import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/client/sms/numbers")({
  component: ClientSmsNumbersPage,
});

function ClientSmsNumbersPage() {
  const [search, setSearch] = useState("");
  const { data: numbers, isLoading } = useQuery({
    queryKey: ["client_sms_numbers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_logs")
        .select("number, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const unique = Array.from(new Set(data.map((n) => n.number))).map((num) =>
        data.find((n) => n.number === num)
      );
      return unique;
    },
  });

  const filtered = numbers?.filter((n) =>
    !search ? true : (n?.number || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">SMS Numbers</h1>
        <p className="text-[#69707a] text-[13px] font-medium mt-0.5">
          Numbers from your recent SMS activity
        </p>
      </div>

      <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc] flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="font-black text-[#69707a] uppercase text-[11px] tracking-widest">
            Numbers List
          </h3>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-[11px] font-black text-[#69707a] uppercase whitespace-nowrap">
              Search:
            </span>
            <Input
              className="h-9 w-full sm:w-64 bg-white border-[#e3e6ec] text-[13px] rounded-lg"
              placeholder="Type to search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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
                    Status
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">
                    Last Seen
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-16">
                      <div className="w-8 h-8 border-4 border-[#0061f2] border-t-transparent rounded-full animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filtered?.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center py-16 text-[#69707a] text-[13px] italic font-medium"
                    >
                      No numbers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered?.map((n, idx) => (
                    <TableRow
                      key={(n?.number || "") + idx}
                      className={cn(
                        "border-b border-[#f2f4f8] hover:bg-gray-50/50",
                        idx % 2 === 0 ? "bg-white" : "bg-[#fcfcfd]"
                      )}
                    >
                      <TableCell className="px-6 py-4 text-[13px] font-bold text-[#2b3a4a]">
                        {n?.number}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider",
                            n?.status === "delivered" || n?.status === "Active"
                              ? "bg-green-500 text-white"
                              : "bg-gray-400 text-white"
                          )}
                        >
                          {n?.status || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-[13px] text-[#69707a]">
                        {n?.created_at ? new Date(n.created_at).toLocaleString() : "—"}
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
