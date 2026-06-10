import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { IMSDataTable, type IMSColumn } from "@/components/ims/IMSDataTable";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/api-url";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_dashboard/stats/sms")({
  component: StatsSmsPage,
});

function pad(n: number) { return String(n).padStart(2, "0"); }
function formatLocal(iso: string | null | undefined): string {
  if (!iso) return "—";
  const match = String(iso).match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/);
  if (match) return `${match[1]} ${match[2]}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Row = {
  date: string;
  range: string;
  number: string;
  cli: string;
  client: string;
  sms: string;
  payout: number;
};

function StatsSmsPage() {
  const cdr = useQuery({
    queryKey: ["sms_stats_cdr"],
    queryFn: async () => {
      const token = localStorage.getItem("nexus_token");
      const res = await fetch(apiUrl("/api/reports/sms-summary"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "SMS summary failed");
      return (payload.latest ?? [])
        .filter((r: any) => (r.message && String(r.message).trim()) || (r.number && String(r.number).trim()))
        .map((r: any) => ({
          date: formatLocal(r.received_at),
          range: r.prefix ?? "-",
          number: r.number ?? "-",
          cli: r.message?.match(/from\s+(\S+)/i)?.[1] ?? "-",
          client: r.client_name ?? "-",
          sms: r.message ?? "",
          payout: Number(r.payout ?? 0),
        })) as Row[];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  // Scrape summary from otp_audit_log (last 24h)
  const audit = useQuery({
    queryKey: ["sms_stats_audit_24h"],
    queryFn: async () => {
      const token = localStorage.getItem("nexus_token");
      const res = await fetch(apiUrl("/api/reports/sms-summary"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "SMS summary failed");
      const s = payload.summary || { rows: 0, billed: 0, duplicates: 0, last_scrape: null };
      const syntheticRows = [
        ...Array.from({ length: Number(s.billed || 0) }, () => ({ outcome: "billed", created_at: s.last_scrape, source: "ims" })),
        ...Array.from({ length: Number(s.duplicates || 0) }, () => ({ outcome: "duplicate", created_at: s.last_scrape, source: "ims" })),
        ...Array.from({ length: Math.max(0, Number(s.rows || 0) - Number(s.billed || 0) - Number(s.duplicates || 0)) }, () => ({ outcome: "other", created_at: s.last_scrape, source: "ims" })),
      ];
      return syntheticRows;
    },
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });

  const rows = audit.data ?? [];
  const billed = rows.filter((r: any) => r.outcome === "billed").length;
  const dup = rows.filter((r: any) => r.outcome === "duplicate" || r.outcome === "dup").length;
  const total = rows.length;
  const lastEvent = rows.reduce(
    (acc: string | null, r: any) => (!acc || r.created_at > acc ? r.created_at : acc),
    null as string | null,
  );

  const columns: IMSColumn<Row>[] = [
    { key: "date", header: "Date", value: (r) => r.date },
    { key: "range", header: "Range", value: (r) => r.range },
    { key: "number", header: "Number", value: (r) => r.number },
    { key: "cli", header: "CLI", value: (r) => r.cli },
    { key: "client", header: "Client", value: (r) => r.client },
    {
      key: "sms",
      header: "SMS",
      value: (r) => r.sms,
      cell: (r) => (
        <span className="block max-w-[520px] whitespace-pre-wrap break-words text-[12px] text-[#2b3a4a]">
          {r.sms || "—"}
        </span>
      ),
    },
    { key: "currency", header: "Currency", value: () => "USD" },
    {
      key: "payout",
      header: "Payout",
      value: (r) => r.payout.toFixed(4),
      cell: (r) => <span className="font-bold text-green-600">${r.payout.toFixed(4)}</span>,
      className: "text-right",
    },
  ];

  const refreshAll = () => { cdr.refetch(); audit.refetch(); };
  const fetching = cdr.isFetching || audit.isFetching;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Rows (24h)" value={total} color="text-[#0061f2]" />
        <StatCard label="Billed (24h)" value={billed} color="text-emerald-600" />
        <StatCard label="Duplicates (24h)" value={dup} color="text-amber-600" />
        <StatCard
          label="Last Scrape"
          value={lastEvent ? formatDistanceToNow(new Date(lastEvent), { addSuffix: true }) : "—"}
          color="text-[#2b3a4a]"
          small
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={refreshAll} variant="outline" className="h-9 text-xs font-bold uppercase">
          <RefreshCw size={14} className={cn("mr-2", fetching && "animate-spin")} />
          {fetching ? "Refreshing…" : "Refresh Now"}
        </Button>
      </div>

      <IMSDataTable
        title="SMS Stats"
        subtitle="Latest SMS records (auto-refresh every 30s)"
        columns={columns}
        rows={cdr.data}
        loading={cdr.isLoading}
        exportName="SMSStats"
        defaultPageSize={25}
      />
    </div>
  );
}

function StatCard({
  label, value, color, small,
}: { label: string; value: string | number; color: string; small?: boolean }) {
  return (
    <Card className="p-4 bg-white rounded-2xl border border-[#e3e6ec] shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-widest text-[#69707a] opacity-70">
        {label}
      </div>
      <div className={cn("font-black tracking-tight mt-1", color, small ? "text-sm" : "text-2xl")}>
        {value}
      </div>
    </Card>
  );
}
