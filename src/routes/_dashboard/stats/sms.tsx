import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { IMSDataTable, type IMSColumn } from "@/components/ims/IMSDataTable";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_dashboard/stats/sms")({
  component: StatsSmsPage,
});

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
      const { data, error } = await supabase
        .from("sms_cdr")
        .select("received_at,prefix,number,message,payout,clients(name)")
        .order("received_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        date: new Date(r.received_at).toLocaleString(),
        range: r.prefix ?? "-",
        number: r.number,
        cli: r.message?.match(/from\s+(\S+)/i)?.[1] ?? "-",
        client: r.clients?.name ?? "-",
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
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("otp_audit_log")
        .select("outcome,created_at,source")
        .gte("created_at", since);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });

  const rows = audit.data ?? [];
  const billed = rows.filter((r: any) => r.outcome === "billed").length;
  const dup = rows.filter((r: any) => r.outcome === "duplicate" || r.outcome === "dup").length;
  const total = rows.length;
  const lastEvent = rows.reduce<string | null>(
    (acc: string | null, r: any) => (!acc || r.created_at > acc ? r.created_at : acc),
    null,
  );

  const columns: IMSColumn<Row>[] = [
    { key: "date", header: "Date", value: (r) => r.date },
    { key: "range", header: "Range", value: (r) => r.range },
    { key: "number", header: "Number", value: (r) => r.number },
    { key: "cli", header: "CLI", value: (r) => r.cli },
    { key: "client", header: "Client", value: (r) => r.client },
    { key: "sms", header: "SMS", value: (r) => r.sms },
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
