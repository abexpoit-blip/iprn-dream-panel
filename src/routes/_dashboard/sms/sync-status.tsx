import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Copy as CopyIcon,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  Repeat,
  Database,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/_dashboard/sms/sync-status")({
  component: SyncStatusPage,
});

type Row = {
  bot_id: string;
  bot_type: string;
  scope: string;
  last_sync_at: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error: string | null;
  rows_fetched: number;
  billed_count: number;
  dup_count: number;
  retry_count: number;
  session_alive: boolean;
  last_relogin_at: string | null;
  total_syncs: number;
  total_billed: number;
  total_dup: number;
  updated_at: string;
};

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

function fmt(d?: string | null) {
  if (!d) return "—";
  const t = new Date(d);
  return isNaN(t.getTime()) ? "—" : t.toLocaleString();
}

function SyncStatusPage() {
  const qc = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery<Row[]>({
    queryKey: ["bot_sync_status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bot_sync_status")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Row[];
    },
    refetchInterval: 10000, // safety net if realtime drops
  });

  // Realtime live updates
  useEffect(() => {
    const ch = supabase
      .channel("bot_sync_status_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bot_sync_status" },
        () => qc.invalidateQueries({ queryKey: ["bot_sync_status"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const rows = data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">
            CDR Sync Status
          </h1>
          <p className="text-[#69707a] text-[13px] font-medium mt-0.5">
            Live IMS / Shark CDR auto-sync metrics — updates in real time
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-[#0061f2] hover:bg-[#004fc4] text-white text-xs font-bold uppercase tracking-wider"
        >
          <RefreshCw
            size={14}
            className={cn(isFetching && "animate-spin")}
          />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#0061f2] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-[#e3e6ec]">
          <CardContent className="py-16 text-center text-[#69707a] text-sm">
            No bot has reported sync status yet. Start a bot to see live metrics.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {rows.map((r) => (
            <BotCard key={r.bot_id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function BotCard({ row }: { row: Row }) {
  const ok = row.session_alive && !row.last_error;
  return (
    <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
      <div
        className={cn(
          "px-6 py-4 flex items-center justify-between border-b",
          ok
            ? "bg-emerald-50 border-emerald-200"
            : "bg-rose-50 border-rose-200",
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center text-white",
              ok ? "bg-emerald-500" : "bg-rose-500",
            )}
          >
            <Activity size={20} />
          </div>
          <div>
            <p className="font-bold text-[#2b3a4a] uppercase text-[13px] tracking-wider">
              {row.bot_type} · {row.scope}
            </p>
            <p className="text-[11px] text-[#69707a]">
              Updated {relative(row.updated_at)}
            </p>
          </div>
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
            row.session_alive
              ? "bg-emerald-500 text-white"
              : "bg-rose-500 text-white",
          )}
        >
          {row.session_alive ? <Wifi size={12} /> : <WifiOff size={12} />}
          {row.session_alive ? "Session Alive" : "Session Dead"}
        </div>
      </div>

      <CardContent className="p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Metric
            icon={Clock}
            label="Last Sync"
            value={relative(row.last_sync_at)}
            sub={fmt(row.last_sync_at)}
            color="bg-[#0061f2]"
          />
          <Metric
            icon={CheckCircle2}
            label="Last Success"
            value={relative(row.last_success_at)}
            sub={fmt(row.last_success_at)}
            color="bg-emerald-500"
          />
          <Metric
            icon={CopyIcon}
            label="Rows Fetched"
            value={row.rows_fetched.toString()}
            sub="Last scrape"
            color="bg-indigo-500"
          />
          <Metric
            icon={ShieldCheck}
            label="Billed"
            value={row.billed_count.toString()}
            sub="Last scrape"
            color="bg-amber-500"
          />
          <Metric
            icon={Repeat}
            label="Duplicates"
            value={row.dup_count.toString()}
            sub="Last scrape"
            color="bg-slate-500"
          />
          <Metric
            icon={AlertTriangle}
            label="Retries"
            value={row.retry_count.toString()}
            sub="Last scrape"
            color={row.retry_count > 0 ? "bg-rose-500" : "bg-[#69707a]"}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#f0f2f6]">
          <Stat label="Total syncs" value={row.total_syncs.toLocaleString()} />
          <Stat label="Total billed" value={row.total_billed.toLocaleString()} />
          <Stat label="Total dups" value={row.total_dup.toLocaleString()} />
        </div>

        {row.last_relogin_at && (
          <div className="text-[11px] text-[#69707a] flex items-center gap-1.5 pt-2 border-t border-[#f0f2f6]">
            <Database size={12} />
            Last re-login: {fmt(row.last_relogin_at)} ({relative(row.last_relogin_at)})
          </div>
        )}

        {row.last_error && (
          <div className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
            <span className="font-bold uppercase text-[10px] tracking-wider mr-2">
              Last error
            </span>
            {row.last_error}
            <div className="text-[10px] text-rose-500 mt-1">
              {fmt(row.last_error_at)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-[#f8f9fc] rounded-lg p-3">
      <div
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0",
          color,
        )}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#69707a]">
          {label}
        </p>
        <p className="text-lg font-bold text-[#2b3a4a] leading-tight truncate">
          {value}
        </p>
        <p className="text-[10px] text-[#69707a] truncate">{sub}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#69707a]">
        {label}
      </p>
      <p className="text-base font-bold text-[#2b3a4a]">{value}</p>
    </div>
  );
}
