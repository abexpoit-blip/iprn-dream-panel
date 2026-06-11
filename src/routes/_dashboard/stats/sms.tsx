import { createFileRoute } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { IMSDataTable, type IMSColumn } from "@/components/ims/IMSDataTable";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fetchSelfHostedJson, isSelfHosted } from "@/lib/self-hosted-api";

export const Route = createFileRoute("/_dashboard/stats/sms")({
  component: StatsSmsPage,
});

function pad(n: number) { return String(n).padStart(2, "0"); }
function formatLocal(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Row = {
  id: string;
  phone_number: string | null;
  cli: string | null;
  otp_code: string | null;
  sms_text: string | null;
  outcome: string;
  source: string | null;
  created_at: string;
};

function StatsSmsPage() {
  const [params, setParams] = useState({ page: 1, pageSize: 25, search: "" });

  // Paged OTP rows (server-side via Supabase, RLS scopes per role)
  const paged = useQuery({
    queryKey: ["sms_otp_paged", params],
    queryFn: async () => {
      const from = (params.page - 1) * params.pageSize;
      const to = from + params.pageSize - 1;

      if (isSelfHosted) {
        const res = await fetchSelfHostedJson<{ rows: Row[]; total: number }>("/reports/otps", {
          limit: params.pageSize,
          offset: from,
          search: params.search.trim(),
        });
        return { rows: res.rows || [], total: res.total || 0 };
      }

      let q = supabase
        .from("otp_audit_log")
        .select("id,phone_number,cli,otp_code,sms_text,outcome,source,created_at", { count: "exact" });

      const s = params.search.trim();
      if (s) {
        q = q.or(
          `phone_number.ilike.%${s}%,cli.ilike.%${s}%,otp_code.ilike.%${s}%,sms_text.ilike.%${s}%`,
        );
      }

      const { data, error, count } = await q
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { rows: (data || []) as Row[], total: count ?? 0 };
    },
    placeholderData: keepPreviousData,
    refetchInterval: 30000,
  });

  // 24h summary stats
  const stats = useQuery({
    queryKey: ["sms_otp_stats_24h"],
    queryFn: async () => {
      if (isSelfHosted) {
        const res = await fetchSelfHostedJson<{ summary: { total: number; billed: number; duplicates: number; last: string | null } }>("/reports/otps", { limit: 1, offset: 0 });
        return { total: res.summary?.total ?? 0, billed: res.summary?.billed ?? 0, duplicates: res.summary?.duplicates ?? 0, last: res.summary?.last ?? null };
      }

      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const [tot, bil, dup, last] = await Promise.all([
        supabase.from("otp_audit_log").select("id", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("otp_audit_log").select("id", { count: "exact", head: true }).gte("created_at", since).eq("outcome", "billed"),
        supabase.from("otp_audit_log").select("id", { count: "exact", head: true }).gte("created_at", since).eq("outcome", "duplicate"),
        supabase.from("otp_audit_log").select("created_at").order("created_at", { ascending: false }).limit(1),
      ]);
      return {
        total: tot.count ?? 0,
        billed: bil.count ?? 0,
        duplicates: dup.count ?? 0,
        last: last.data?.[0]?.created_at ?? null,
      };
    },
    refetchInterval: 30000,
  });

  const columns: IMSColumn<Row>[] = [
    { key: "date", header: "Date", value: (r) => formatLocal(r.created_at) },
    {
      key: "number",
      header: "Number",
      value: (r) => r.phone_number ?? "—",
      cell: (r) => <span className="font-bold text-[#2b3a4a]">{r.phone_number ?? "—"}</span>,
    },
    { key: "cli", header: "CLI", value: (r) => r.cli ?? "—" },
    {
      key: "otp",
      header: "OTP",
      value: (r) => r.otp_code ?? "—",
      cell: (r) =>
        r.otp_code ? (
          <span className="font-mono font-bold text-[#0061f2]">{r.otp_code}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: "sms",
      header: "Message",
      value: (r) => r.sms_text ?? "",
      cell: (r) => (
        <span className="block min-w-[420px] max-w-[760px] whitespace-pre-wrap break-words text-[14px] leading-snug font-medium text-[#1a2330]">
          {r.sms_text || "—"}
        </span>
      ),
    },
    { key: "source", header: "Source", value: (r) => r.source ?? "—" },
    {
      key: "outcome",
      header: "Status",
      value: (r) => r.outcome,
      cell: (r) => (
        <span
          className={cn(
            "px-2 py-0.5 text-white text-[10px] font-bold rounded uppercase",
            r.outcome === "billed"
              ? "bg-emerald-500"
              : r.outcome === "duplicate"
                ? "bg-amber-500"
                : "bg-slate-500",
          )}
        >
          {r.outcome}
        </span>
      ),
    },
  ];

  const s = stats.data;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Rows (24h)" value={s?.total ?? "—"} color="text-[#0061f2]" />
        <StatCard label="Billed (24h)" value={s?.billed ?? "—"} color="text-emerald-600" />
        <StatCard label="Duplicates (24h)" value={s?.duplicates ?? "—"} color="text-amber-600" />
        <StatCard
          label="Last OTP"
          value={s?.last ? formatDistanceToNow(new Date(s.last), { addSuffix: true }) : "—"}
          color="text-[#2b3a4a]"
          small
        />
      </div>

      <IMSDataTable<Row>
        title="SMS Stats"
        subtitle="All OTP/SMS records — server-side paginated & searchable"
        columns={columns}
        rows={paged.data?.rows}
        totalCount={paged.data?.total}
        onParamsChange={setParams}
        loading={paged.isLoading || paged.isFetching}
        exportName="SMSStats"
        rowKey={(r) => r.id}
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
