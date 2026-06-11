import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Zap, UserPlus } from "lucide-react";
import { AssignDialog } from "@/components/numbers/AssignDialog";
import { IMSDataTable, type IMSColumn } from "@/components/ims/IMSDataTable";
import { fetchSelfHostedJson, isSelfHosted } from "@/lib/self-hosted-api";

const API_URL = import.meta.env.VITE_API_URL || "https://X.nexus-x.site/api";

export const Route = createFileRoute("/_dashboard/sms/numbers")({
  component: SmsNumbersPage,
});

type Row = {
  id: string;
  number: string;
  country: string | null;
  range_name: string | null;
  prefix: string | null;
  panel_payout: number | null;
  agent_rate: number | null;
  client_rate: number | null;
  assigned_agent: string | null;
  assigned_client: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
};

function SmsNumbersPage() {
  const [filterRange, setFilterRange] = useState("All Ranges");
  const [autoPooling, setAutoPooling] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  // Lightweight range list (just names) — cheap and cached long
  const { data: rangeOptions = [] } = useQuery<string[]>({
    queryKey: ["number_pool_ranges"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data } = await supabase
        .from("number_pool")
        .select("range_name")
        .not("range_name", "is", null)
        .limit(5000);
      const names: string[] = (data || [])
        .map((r: any) => String(r.range_name || ""))
        .filter((v: string) => v.length > 0);
      return Array.from(new Set(names)).sort();
    },
  });

  const { data, isLoading } = useQuery<{ rows: Row[]; total: number }>({
    queryKey: ["number_pool_view", page, pageSize, search, filterRange],
    placeholderData: (prev) => prev,
    staleTime: 15_000,
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      if (isSelfHosted) {
        const res = await fetchSelfHostedJson<{ rows: Row[]; total: number }>("/reports/numbers", {
          limit: pageSize,
          offset: from,
          search: search.trim(),
          range_name: filterRange !== "All Ranges" ? filterRange : "",
        });
        return { rows: res.rows || [], total: res.total || 0 };
      }

      let q = supabase
        .from("number_pool")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (filterRange !== "All Ranges") q = q.eq("range_name", filterRange);
      if (search.trim()) {
        const s = search.trim();
        q = q.or(`number.ilike.%${s}%,country.ilike.%${s}%,range_name.ilike.%${s}%,prefix.ilike.%${s}%`);
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data || []) as Row[], total: count || 0 };
    },
  });

  const filtered = data?.rows || [];

  const allSelected =
    filtered.length > 0 && filtered.every((n) => selectedIds.includes(n.id));
  const toggleAll = () =>
    setSelectedIds(allSelected ? [] : filtered.map((n) => n.id));

  const handleAutoPool = async () => {
    setAutoPooling(true);
    try {
      const token = localStorage.getItem("nexus_token");
      const res = await fetch(`${API_URL}/numbers/auto-pool`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Auto Pool failed");
      toast.success(data.message || "Auto Pool started — scraping number panels...");
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["number_pool_view"] }), 4000);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["number_pool_view"] }), 12000);
    } catch (e: any) {
      toast.error(`Auto Pool failed: ${e.message}`);
    } finally {
      setTimeout(() => setAutoPooling(false), 4000);
    }
  };

  const columns: IMSColumn<Row>[] = [
    {
      key: "sel",
      header: (
        <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
      ),
      value: () => "",
      cell: (r) => (
        <Checkbox
          checked={selectedIds.includes(r.id)}
          onCheckedChange={(v) =>
            setSelectedIds((prev) =>
              v ? [...prev, r.id] : prev.filter((x) => x !== r.id),
            )
          }
        />
      ),
      exportable: false,
      className: "w-10",
    },
    {
      key: "number",
      header: "Phone Number",
      value: (r) => r.number,
      cell: (r) => <span className="font-bold text-[#2b3a4a]">{r.number}</span>,
    },
    { key: "country", header: "Country", value: (r) => r.country ?? "—" },
    {
      key: "range",
      header: "Range",
      value: (r) => r.range_name ?? "—",
      cell: (r) => <span className="text-[#69707a]">{r.range_name ?? "—"}</span>,
    },
    {
      key: "prefix",
      header: "Prefix",
      value: (r) => (r.prefix ? `+${r.prefix}` : "—"),
    },
    {
      key: "payout",
      header: "Panel Payout",
      value: (r) => (r.panel_payout != null ? Number(r.panel_payout).toFixed(2) : "—"),
      cell: (r) => (
        <span className="font-bold text-[#0061f2]">
          {r.panel_payout != null ? Number(r.panel_payout).toFixed(2) : "—"}
        </span>
      ),
    },
    {
      key: "agent_rate",
      header: "Agent Rate",
      value: (r) => (r.agent_rate != null ? Number(r.agent_rate).toFixed(2) : "—"),
      cell: (r) => (
        <span className="font-bold text-emerald-600">
          {r.agent_rate != null ? Number(r.agent_rate).toFixed(2) : "—"}
        </span>
      ),
    },
    {
      key: "client_rate",
      header: "Client Rate",
      value: (r) => (r.client_rate != null ? Number(r.client_rate).toFixed(2) : "—"),
      cell: (r) => (
        <span className="font-bold text-purple-600">
          {r.client_rate != null ? Number(r.client_rate).toFixed(2) : "—"}
        </span>
      ),
    },
    {
      key: "assign",
      header: "Assignment",
      value: (r) =>
        r.assigned_client ? "Client" : r.assigned_agent ? "Agent" : "Unassigned",
      cell: (r) =>
        r.assigned_client ? (
          <span className="text-purple-700 font-bold">→ Client</span>
        ) : r.assigned_agent ? (
          <span className="text-emerald-700 font-bold">→ Agent</span>
        ) : (
          <span className="text-gray-400">Unassigned</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      value: (r) => r.status,
      cell: (r) => (
        <span
          className={cn(
            "px-2 py-0.5 text-white text-[10px] font-bold rounded uppercase",
            r.status === "available"
              ? "bg-green-500"
              : r.status === "reserved"
                ? "bg-amber-500"
                : "bg-slate-500",
          )}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: "updated",
      header: "Updated",
      value: (r) => new Date(r.updated_at || r.created_at).toLocaleString(),
    },
  ];

  return (
    <>
      <AssignDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        mode="agent"
        numberIds={selectedIds}
        onDone={() => {
          setSelectedIds([]);
          queryClient.invalidateQueries({ queryKey: ["number_pool_view"] });
        }}
      />

      <IMSDataTable<Row>
        title="SMS Numbers Inventory"
        subtitle="All numbers scraped from connected panels"
        columns={columns}
        rows={filtered}
        loading={isLoading}
        exportName="SMSNumbers"
        rowKey={(r) => r.id}
        totalCount={data?.total ?? 0}
        defaultPageSize={pageSize}
        onParamsChange={(p) => {
          setPage(p.page);
          setPageSize(p.pageSize);
          setSearch(p.search);
        }}
        rightSlot={
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <Button
                onClick={() => setAssignOpen(true)}
                className="bg-[#0061f2] hover:bg-[#0052ce] text-white font-bold uppercase tracking-wider text-xs gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Assign {selectedIds.length} to Agent
              </Button>
            )}
            <Button
              onClick={handleAutoPool}
              disabled={autoPooling}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold uppercase tracking-wider text-xs gap-2"
            >
              {autoPooling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {autoPooling ? "Pooling…" : "Start Auto Pool"}
            </Button>
          </div>
        }
        filters={
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-black uppercase text-[#69707a]">
              Range:
            </span>
            <select
              value={filterRange}
              onChange={(e) => setFilterRange(e.target.value)}
              className="h-8 border border-[#c5ccd6] rounded-md px-2 text-xs focus:ring-1 focus:ring-[#0061f2] outline-none"
            >
              <option>All Ranges</option>
              {rangeOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        }
      />
    </>
  );
}
