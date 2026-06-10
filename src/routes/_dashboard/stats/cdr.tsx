import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { IMSDataTable, type IMSColumn } from "@/components/ims/IMSDataTable";
import { Button } from "@/components/ui/button";

const API_URL = import.meta.env.VITE_API_URL || "https://x.nexus-x.site/api";

export const Route = createFileRoute("/_dashboard/stats/cdr")({
  component: StatsCDRPage,
});

type CDR = {
  id: string;
  received_at: string;
  number: string;
  prefix: string | null;
  message: string | null;
  payout: number | null;
  status: string | null;
  client_id: string | null;
  agent_id: string | null;
};

function StatsCDRPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(`${today}T00:00`);
  const [endDate, setEndDate] = useState(`${today}T23:59`);
  const [prefix, setPrefix] = useState("");
  const [clientId, setClientId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [numberSearch, setNumberSearch] = useState("");

  const [applied, setApplied] = useState({
    start: startDate,
    end: endDate,
    prefix: "",
    clientId: "",
    agentId: "",
    number: "",
  });

  // dropdown sources
  const clients = useQuery({
    queryKey: ["clients_options"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id,name,username").order("name");
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
  const agents = useQuery({
    queryKey: ["agents_options"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,username")
        .eq("role", "agent")
        .order("username");
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["sms_cdr_report", applied],
    queryFn: async () => {
      const params = new URLSearchParams({
        start: new Date(applied.start).toISOString(),
        end: new Date(applied.end).toISOString(),
        limit: "500",
      });
      if (applied.prefix) params.set("prefix", applied.prefix);
      if (applied.clientId) params.set("client_id", applied.clientId);
      if (applied.agentId) params.set("agent_id", applied.agentId);
      if (applied.number) params.set("number", applied.number);
      const token = localStorage.getItem("nexus_token");
      const res = await fetch(`${API_URL}/api/reports/cdr?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "CDR report failed");
      return (payload.rows || []).map((r: any) => ({
        ...r,
        clients: r.client_name ? { name: r.client_name } : null,
      })) as (CDR & { clients: { name: string } | null })[];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const totals = useMemo(() => {
    const rows = data ?? [];
    const sum = rows.reduce((a, r) => a + Number(r.payout ?? 0), 0);
    return { count: rows.length, payout: sum };
  }, [data]);

  const columns: IMSColumn<CDR & { clients: { name: string } | null }>[] = [
    {
      key: "date",
      header: "Received At",
      value: (r) => new Date(r.received_at).toISOString(),
      cell: (r) => new Date(r.received_at).toLocaleString(),
    },
    { key: "range", header: "Range", value: (r) => r.prefix ?? "-" },
    {
      key: "number",
      header: "Number",
      value: (r) => r.number,
      cell: (r) => <span className="font-bold">{r.number}</span>,
    },
    {
      key: "cli",
      header: "CLI",
      value: (r) => (r.message?.match(/from\s+(\S+)/i)?.[1] ?? "-"),
    },
    { key: "client", header: "Client", value: (r) => r.clients?.name ?? "-" },
    {
      key: "sms",
      header: "SMS",
      value: (r) => r.message ?? "",
      cell: (r) => (
        <span className="font-mono text-[11px] text-[#4d5875]">{r.message ?? ""}</span>
      ),
    },
    { key: "currency", header: "Currency", value: () => "USD" },
    {
      key: "payout",
      header: "Payout",
      value: (r) => Number(r.payout ?? 0).toFixed(4),
      cell: (r) => (
        <span className="font-bold text-green-600">
          ${Number(r.payout ?? 0).toFixed(4)}
        </span>
      ),
      className: "text-right",
    },
  ];

  const inputCls =
    "w-full h-9 border border-[#c5ccd6] rounded px-3 text-xs focus:ring-1 focus:ring-[#0061f2] outline-none bg-white";

  const filters = (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="text-[10px] font-bold uppercase text-[#69707a] block mb-1">Start</label>
          <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-[#69707a] block mb-1">End</label>
          <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-[#69707a] block mb-1">Prefix / Range</label>
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g. 44" className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-[#69707a] block mb-1">Number</label>
          <input value={numberSearch} onChange={(e) => setNumberSearch(e.target.value)} placeholder="contains…" className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-[#69707a] block mb-1">Client</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
            <option value="">All Clients</option>
            {(clients.data ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>{c.name || c.username}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-[#69707a] block mb-1">Agent</label>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={inputCls}>
            <option value="">All Agents</option>
            {(agents.data ?? []).map((a: any) => (
              <option key={a.id} value={a.id}>{a.username}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2 flex items-end gap-2">
          <Button
            onClick={() =>
              setApplied({
                start: startDate, end: endDate,
                prefix: prefix.trim(), clientId, agentId,
                number: numberSearch.trim(),
              })
            }
            className="h-9 bg-[#0061f2] hover:bg-[#0052ce] text-xs font-bold uppercase"
          >
            Apply Filters
          </Button>
          <Button
            onClick={() => {
              setPrefix(""); setClientId(""); setAgentId(""); setNumberSearch("");
              setApplied({ start: startDate, end: endDate, prefix: "", clientId: "", agentId: "", number: "" });
            }}
            variant="outline"
            className="h-9 text-xs font-bold uppercase"
          >
            Reset
          </Button>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="h-9 text-xs font-bold uppercase"
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-[11px] font-bold uppercase tracking-wider text-[#69707a]">
        <span>Rows: <span className="text-[#0061f2]">{totals.count}</span></span>
        <span>Total Payout: <span className="text-green-600">${totals.payout.toFixed(4)}</span></span>
        {dataUpdatedAt > 0 && (
          <span>Updated: <span className="text-[#2b3a4a]">{new Date(dataUpdatedAt).toLocaleTimeString()}</span></span>
        )}
      </div>
    </div>
  );

  return (
    <IMSDataTable
      title="SMS CDR Reports"
      subtitle="Detailed Call Detail Records — filter, search & CSV export"
      columns={columns}
      rows={data}
      loading={isLoading}
      exportName={`SMSCDR_${applied.start}_${applied.end}`}
      filters={filters}
      defaultPageSize={25}
      rowKey={(r) => r.id}
    />
  );
}
