import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { RefreshCw, Database, CheckCircle2, Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/client/pool")({
  component: ClientPoolPage,
});

function fmt(d?: string | null) {
  if (!d) return "—";
  const t = new Date(d);
  return isNaN(t.getTime()) ? "—" : t.toLocaleString();
}

function relative(d?: string | null) {
  if (!d) return "never";
  const diff = Date.now() - new Date(d).getTime();
  if (isNaN(diff)) return "never";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ClientPoolPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["client_number_pool"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user?.id;
      if (!uid) return { rows: [], clientId: null };

      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", uid)
        .maybeSingle();

      const clientId = client?.id ?? null;

      let q = supabase
        .from("number_pool")
        .select(
          "number, status, country, range_name, prefix, panel_payout, client_rate, reserved_at, expires_at, updated_at, created_at"
        )
        .order("updated_at", { ascending: false })
        .limit(5000);

      if (clientId) {
        q = q.or(`assigned_client.eq.${clientId},reserved_for.eq.${uid},user_id.eq.${uid}`);
      } else {
        q = q.or(`reserved_for.eq.${uid},user_id.eq.${uid}`);
      }

      const { data: rows, error } = await q;
      if (error) throw error;
      return { rows: rows || [], clientId };
    },
    refetchInterval: 30000,
  });

  const rows = data?.rows || [];
  const filtered = rows.filter((r: any) =>
    !search
      ? true
      : `${r.number} ${r.country ?? ""} ${r.range_name ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
  );

  const total = rows.length;
  const available = rows.filter((r: any) => r.status === "available" || r.status === "active").length;
  const reserved = rows.filter((r: any) => r.status === "reserved").length;
  const used = rows.filter((r: any) => r.status === "used").length;
  let lastScrape: string | null = null;
  for (const r of rows as any[]) {
    const v = r.updated_at || r.created_at;
    if (v && (!lastScrape || new Date(v) > new Date(lastScrape))) lastScrape = v;
  }

  const stats = [
    { label: "Total Numbers", value: total, icon: Database, color: "bg-[#0061f2]" },
    { label: "Available", value: available, icon: CheckCircle2, color: "bg-[#00ac69]" },
    { label: "Reserved", value: reserved, icon: Lock, color: "bg-[#f7b801]" },
    { label: "Used", value: used, icon: Clock, color: "bg-[#69707a]" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">My Number Pool</h1>
          <p className="text-[#69707a] text-[13px] font-medium mt-0.5">
            Numbers assigned to your client account
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] font-black uppercase text-[#69707a] tracking-wider">
              Last Scrape
            </p>
            <p className="text-[13px] font-bold text-[#2b3a4a]">{relative(lastScrape)}</p>
            <p className="text-[10px] text-[#69707a]">{fmt(lastScrape)}</p>
          </div>
          <Button
            onClick={() => refetch()}
            disabled={isFetching}
            className="bg-[#0061f2] hover:bg-[#004fc4] gap-2"
          >
            <RefreshCw size={14} className={cn(isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="shadow-sm border-[#e3e6ec] rounded-xl">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white", s.color)}>
                <s.icon size={22} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-[#69707a]">
                  {s.label}
                </p>
                <p className="text-2xl font-bold text-[#2b3a4a] leading-tight">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc] flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="font-black text-[#69707a] uppercase text-[11px] tracking-widest">
            Pool Numbers ({filtered.length})
          </h3>
          <Input
            className="h-9 w-full sm:w-64 bg-white border-[#e3e6ec] text-[13px] rounded-lg"
            placeholder="Search number / country / range..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-none bg-[#f8f9fc] hover:bg-[#f8f9fc]">
                  {["Number", "Country", "Range", "Status", "Rate", "Reserved", "Last Update"].map((h) => (
                    <TableHead
                      key={h}
                      className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4"
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16">
                      <div className="w-8 h-8 border-4 border-[#0061f2] border-t-transparent rounded-full animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-16 text-[#69707a] text-[13px] italic font-medium"
                    >
                      No numbers in your pool yet
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((n: any, idx: number) => (
                    <TableRow
                      key={n.number + idx}
                      className={cn(
                        "border-b border-[#f2f4f8] hover:bg-gray-50/50",
                        idx % 2 === 0 ? "bg-white" : "bg-[#fcfcfd]"
                      )}
                    >
                      <TableCell className="px-6 py-4 text-[13px] font-bold text-[#2b3a4a]">
                        {n.number}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-[13px] text-[#2b3a4a]">
                        {n.country || "—"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-[13px] text-[#69707a]">
                        {n.range_name || "—"}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider",
                            n.status === "available" || n.status === "active"
                              ? "bg-[#00ac69] text-white"
                              : n.status === "reserved"
                              ? "bg-[#f7b801] text-white"
                              : n.status === "used"
                              ? "bg-[#69707a] text-white"
                              : "bg-gray-300 text-white"
                          )}
                        >
                          {n.status || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-[13px] text-[#2b3a4a]">
                        {n.client_rate ?? n.panel_payout ?? "—"}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-[12px] text-[#69707a]">
                        {fmt(n.reserved_at)}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-[12px] text-[#69707a]">
                        {relative(n.updated_at || n.created_at)}
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
