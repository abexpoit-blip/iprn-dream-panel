import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, RefreshCw, Bot as BotIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_dashboard/bot-health")({
  component: BotHealthPage,
});

type Bot = {
  id: string;
  name: string;
  bot_type: string;
  status: string;
  last_seen: string | null;
  last_error: string | null;
};

type PoolRow = {
  bot_id: string | null;
  status: string;
  assigned_agent: string | null;
  assigned_client: string | null;
  updated_at: string | null;
};

type OtpRow = { source: string | null; created_at: string; outcome: string };

function BotHealthPage() {
  const bots = useQuery<Bot[]>({
    queryKey: ["bots_health"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bots").select("*").order("name");
      if (error) throw error;
      return (data || []) as Bot[];
    },
    refetchInterval: 8000,
  });

  const pool = useQuery<PoolRow[]>({
    queryKey: ["pool_health"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("number_pool")
        .select("bot_id,status,assigned_agent,assigned_client,updated_at");
      if (error) throw error;
      return (data || []) as PoolRow[];
    },
    refetchInterval: 8000,
  });

  const otps = useQuery<OtpRow[]>({
    queryKey: ["otp_health"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("otp_audit_log")
        .select("source,created_at,outcome")
        .gte("created_at", since);
      if (error) throw error;
      return (data || []) as OtpRow[];
    },
    refetchInterval: 10000,
  });

  const statsByBot = (botId: string, botType: string) => {
    const rows = (pool.data || []).filter((p) => p.bot_id === botId);
    const total = rows.length;
    const avail = rows.filter((r) => r.status === "available").length;
    const reserved = rows.filter((r) => r.status === "reserved").length;
    const assignedAgent = rows.filter((r) => !!r.assigned_agent).length;
    const assignedClient = rows.filter((r) => !!r.assigned_client).length;
    const lastUpsert = rows.reduce<string | null>(
      (acc, r) => (r.updated_at && (!acc || r.updated_at > acc) ? r.updated_at : acc),
      null,
    );
    const otpRows = (otps.data || []).filter((o) => o.source === botType);
    const otp24h = otpRows.length;
    const billed24h = otpRows.filter((o) => o.outcome === "billed").length;
    return { total, avail, reserved, assignedAgent, assignedClient, lastUpsert, otp24h, billed24h };
  };

  const refetchAll = () => {
    bots.refetch();
    pool.refetch();
    otps.refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-[#e3e6ec] shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-[#0061f2] p-3 rounded-xl shadow-lg shadow-blue-100">
            <Activity className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#2b3a4a] tracking-tighter uppercase">
              Bot Health
            </h1>
            <p className="text-[#69707a] text-[11px] font-black uppercase tracking-widest mt-1 opacity-70">
              Live scrape & upsert stats per bot
            </p>
          </div>
        </div>
        <Button
          onClick={refetchAll}
          variant="outline"
          className="h-10 border-blue-200 text-[#0061f2] font-black uppercase text-[11px] px-5 rounded-xl hover:bg-blue-50"
        >
          <RefreshCw
            size={14}
            className={cn("mr-2", (bots.isFetching || pool.isFetching) && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {(bots.data || []).map((b) => {
          const s = statsByBot(b.id, b.bot_type);
          const online = b.status === "online";
          return (
            <Card
              key={b.id}
              className="bg-white rounded-2xl border border-[#e3e6ec] shadow-sm p-5 space-y-4"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "p-2.5 rounded-xl border",
                      online
                        ? "bg-green-50 border-green-100 text-green-600"
                        : "bg-slate-50 border-slate-100 text-slate-400",
                    )}
                  >
                    <BotIcon size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-[#2b3a4a] uppercase tracking-tight text-sm">
                      {b.name}
                    </h3>
                    <p className="text-[10px] text-[#69707a] font-bold uppercase tracking-widest opacity-60">
                      {b.bot_type}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-black uppercase rounded-full",
                    online ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {b.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Total" value={s.total} color="text-[#0061f2]" />
                <Stat label="Available" value={s.avail} color="text-emerald-600" />
                <Stat label="Reserved" value={s.reserved} color="text-amber-600" />
                <Stat label="→ Agent" value={s.assignedAgent} color="text-blue-700" />
                <Stat label="→ Client" value={s.assignedClient} color="text-purple-700" />
                <Stat label="OTP 24h" value={s.otp24h} color="text-[#2b3a4a]" />
              </div>

              <div className="border-t border-[#f2f4f8] pt-3 space-y-1.5">
                <Row
                  label="Last Upsert"
                  value={
                    s.lastUpsert
                      ? formatDistanceToNow(new Date(s.lastUpsert), { addSuffix: true })
                      : "never"
                  }
                />
                <Row
                  label="Last Seen"
                  value={
                    b.last_seen
                      ? formatDistanceToNow(new Date(b.last_seen), { addSuffix: true })
                      : "never"
                  }
                />
                <Row label="Billed 24h" value={String(s.billed24h)} />
              </div>

              {b.last_error ? (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg p-2.5">
                  <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-red-700 font-medium break-all">
                    {b.last_error}
                  </p>
                </div>
              ) : online ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg p-2.5">
                  <CheckCircle2 size={14} className="text-green-600" />
                  <p className="text-[11px] text-green-700 font-bold uppercase tracking-wider">
                    Healthy
                  </p>
                </div>
              ) : null}
            </Card>
          );
        })}
        {bots.data && bots.data.length === 0 && (
          <Card className="col-span-full p-10 text-center text-[#69707a]">
            No bots configured yet.
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[#f8f9fc] rounded-lg py-2">
      <div className={cn("text-lg font-black tracking-tight", color)}>{value}</div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#69707a] opacity-70">
        {label}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-[#69707a] font-bold uppercase tracking-wider opacity-70">
        {label}
      </span>
      <span className="text-[#2b3a4a] font-bold">{value}</span>
    </div>
  );
}
