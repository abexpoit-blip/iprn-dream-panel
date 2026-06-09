import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Activity, Bot as BotIcon, KeyRound, RefreshCw, ShieldCheck, ShieldAlert,
  Zap, Save, Eye, EyeOff, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_dashboard/bot-control")({
  component: BotControlPage,
});

type Bot = {
  id: string; name: string; bot_type: string; status: string;
  last_seen: string | null; last_error: string | null;
};
type Setting = { bot_id: string; setting_key: string; setting_value: string | null };
type PoolRow = { bot_id: string | null; updated_at: string | null; status: string };
type OtpRow = { source: string | null; created_at: string; outcome: string };

function mask(value: string) {
  if (!value) return "—";
  const m = value.match(/PHPSESSID\s*=\s*([^;\s]+)/i);
  const token = m ? m[1] : value.trim();
  if (token.length <= 6) return "•".repeat(token.length);
  return `${"•".repeat(Math.max(token.length - 4, 6))}${token.slice(-4)}`;
}

function BotControlPage() {
  const [threshold, setThreshold] = useState<number>(() => {
    const v = Number(localStorage.getItem("bot_health_threshold_min"));
    return Number.isFinite(v) && v > 0 ? v : 15;
  });
  useEffect(() => {
    localStorage.setItem("bot_health_threshold_min", String(threshold));
  }, [threshold]);

  const bots = useQuery<Bot[]>({
    queryKey: ["bc_bots"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bots").select("*").order("name");
      if (error) throw error;
      return (data || []) as Bot[];
    },
    refetchInterval: 8000,
  });

  const settings = useQuery<Setting[]>({
    queryKey: ["bc_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bot_settings")
        .select("bot_id,setting_key,setting_value");
      if (error) throw error;
      return (data || []) as Setting[];
    },
    refetchInterval: 15000,
  });

  const pool = useQuery<PoolRow[]>({
    queryKey: ["bc_pool"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("number_pool")
        .select("bot_id,updated_at,status")
        .order("updated_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data || []) as PoolRow[];
    },
    refetchInterval: 10000,
  });

  const otps = useQuery<OtpRow[]>({
    queryKey: ["bc_otp"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("otp_audit_log")
        .select("source,created_at,outcome")
        .gte("created_at", since);
      if (error) throw error;
      return (data || []) as OtpRow[];
    },
    refetchInterval: 12000,
  });

  const getSetting = (botId: string, key: string) =>
    settings.data?.find((s) => s.bot_id === botId && s.setting_key === key)?.setting_value || "";

  const computeStats = (b: Bot) => {
    const poolRows = (pool.data || []).filter((p) => p.bot_id === b.id);
    const lastUpsert = poolRows[0]?.updated_at || null;
    const otpRows = (otps.data || []).filter((o) => o.source === b.bot_type);
    const lastOtp = otpRows.reduce<string | null>(
      (acc, r) => (!acc || r.created_at > acc ? r.created_at : acc),
      null,
    );
    const totalNumbers = poolRows.length;
    const avail = poolRows.filter((r) => r.status === "available").length;
    const minsSinceUpsert = lastUpsert
      ? (Date.now() - new Date(lastUpsert).getTime()) / 60000
      : Infinity;
    const stale = totalNumbers === 0 || minsSinceUpsert > threshold;
    const loginVerified = b.status === "online" && !b.last_error;
    return { lastUpsert, lastOtp, totalNumbers, avail, otp24h: otpRows.length, stale, loginVerified };
  };

  const refetchAll = () => {
    bots.refetch(); settings.refetch(); pool.refetch(); otps.refetch();
  };

  const triggerAutoPool = async () => {
    const { error } = await supabase.rpc("notify_scrape_now");
    if (error) toast.error(error.message || "Failed to trigger");
    else toast.success("Auto-pool scrape signal sent to all bots");
  };

  const unhealthy = useMemo(
    () => (bots.data || []).filter((b) => computeStats(b).stale),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bots.data, pool.data, otps.data, threshold],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-4 justify-between items-center bg-white p-6 rounded-2xl border border-[#e3e6ec] shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-[#0061f2] p-3 rounded-xl shadow-lg shadow-blue-100">
            <KeyRound className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#2b3a4a] tracking-tighter uppercase">
              Bot Control Center
            </h1>
            <p className="text-[#69707a] text-[11px] font-black uppercase tracking-widest mt-1 opacity-70">
              Sessions • Health • Auto-Pool
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 h-10">
            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
              Stale Alert (min)
            </Label>
            <Input
              type="number" min={1} max={1440}
              value={threshold}
              onChange={(e) => setThreshold(Math.max(1, Number(e.target.value) || 15))}
              className="h-7 w-16 text-center font-black"
            />
          </div>
          <Button onClick={refetchAll} variant="outline"
            className="h-10 border-blue-200 text-[#0061f2] font-black uppercase text-[11px] px-4 rounded-xl hover:bg-blue-50">
            <RefreshCw size={14} className={cn("mr-2", (bots.isFetching || pool.isFetching) && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={triggerAutoPool}
            className="h-10 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black uppercase text-[11px] px-5 rounded-xl shadow-lg shadow-emerald-100">
            <Zap size={14} className="mr-2" /> Trigger Auto-Pool
          </Button>
        </div>
      </div>

      {/* Health alerts */}
      {unhealthy.length > 0 && (
        <Card className="p-4 border-red-200 bg-red-50 flex items-start gap-3">
          <AlertTriangle className="text-red-600 mt-0.5 shrink-0" size={18} />
          <div className="text-[12px] text-red-800">
            <div className="font-black uppercase tracking-wider mb-1">
              Scraping Health Alert
            </div>
            <div>
              {unhealthy.map((b) => b.name).join(", ")} — no CDR/Numbers rows in the
              last <span className="font-black">{threshold} min</span>.
              Check session cookies and PANEL_MODE.
            </div>
          </div>
        </Card>
      )}

      {/* Bot cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {(bots.data || []).map((b) => (
          <BotCard
            key={b.id}
            bot={b}
            panelMode={getSetting(b.id, "panel_mode") || "agent"}
            sessionCookie={getSetting(b.id, "session_cookie")}
            stats={computeStats(b)}
            onSaved={refetchAll}
          />
        ))}
        {bots.data && bots.data.length === 0 && (
          <Card className="p-10 text-center text-[#69707a] col-span-full">
            No bots configured yet.
          </Card>
        )}
      </div>
    </div>
  );
}

function BotCard({
  bot, panelMode, sessionCookie, stats, onSaved,
}: {
  bot: Bot;
  panelMode: string;
  sessionCookie: string;
  stats: ReturnType<ReturnType<typeof Object>["valueOf"]> & {
    lastUpsert: string | null; lastOtp: string | null; totalNumbers: number;
    avail: number; otp24h: number; stale: boolean; loginVerified: boolean;
  };
  onSaved: () => void;
}) {
  const [cookie, setCookie] = useState(sessionCookie);
  const [mode, setMode] = useState(panelMode);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => setCookie(sessionCookie), [sessionCookie]);
  useEffect(() => setMode(panelMode), [panelMode]);

  const save = async () => {
    setSaving(true);
    const rows = [
      { bot_id: bot.id, setting_key: "session_cookie", setting_value: cookie.trim() },
      { bot_id: bot.id, setting_key: "panel_mode", setting_value: mode },
    ];
    const { error } = await supabase
      .from("bot_settings")
      .upsert(rows, { onConflict: "bot_id,setting_key" });
    setSaving(false);
    if (error) toast.error(error.message || "Save failed");
    else {
      toast.success(`${bot.name} session updated`);
      onSaved();
    }
  };

  const cookiePresent = !!cookie && /PHPSESSID/i.test(cookie);

  return (
    <Card className="bg-white rounded-2xl border border-[#e3e6ec] shadow-sm p-5 space-y-4">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2.5 rounded-xl border",
            stats.loginVerified
              ? "bg-green-50 border-green-100 text-green-600"
              : "bg-slate-50 border-slate-100 text-slate-400",
          )}>
            <BotIcon size={20} />
          </div>
          <div>
            <h3 className="font-black text-[#2b3a4a] uppercase tracking-tight text-sm">{bot.name}</h3>
            <p className="text-[10px] text-[#69707a] font-bold uppercase tracking-widest opacity-60">
              {bot.bot_type}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1 items-end">
          <span className={cn(
            "px-2 py-0.5 text-[9px] font-black uppercase rounded-full",
            stats.loginVerified ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700",
          )}>
            {stats.loginVerified ? "Login Verified" : "Login Unverified"}
          </span>
          <span className={cn(
            "px-2 py-0.5 text-[9px] font-black uppercase rounded-full border",
            mode === "agent" ? "bg-blue-50 text-blue-700 border-blue-200"
                             : "bg-purple-50 text-purple-700 border-purple-200",
          )}>
            PANEL: {mode || "agent"}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <Stat label="Numbers" value={stats.totalNumbers} />
        <Stat label="Available" value={stats.avail} color="text-emerald-600" />
        <Stat label="OTP 24h" value={stats.otp24h} color="text-[#0061f2]" />
        <Stat label="Status" value={bot.status === "online" ? "ON" : "OFF"} text
              color={bot.status === "online" ? "text-emerald-600" : "text-slate-500"} />
      </div>

      <div className="space-y-1.5 border-t border-[#f2f4f8] pt-3">
        <Row label="Last Scrape (pool)" value={stats.lastUpsert ? formatDistanceToNow(new Date(stats.lastUpsert), { addSuffix: true }) : "never"} alert={stats.stale} />
        <Row label="Last OTP" value={stats.lastOtp ? formatDistanceToNow(new Date(stats.lastOtp), { addSuffix: true }) : "never"} />
        <Row label="Last Seen" value={bot.last_seen ? formatDistanceToNow(new Date(bot.last_seen), { addSuffix: true }) : "never"} />
      </div>

      {bot.last_error && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 flex items-start gap-2">
          <ShieldAlert size={14} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-red-700 break-all">{bot.last_error}</p>
        </div>
      )}

      {/* Session cookie form */}
      <div className="space-y-3 border-t border-[#f2f4f8] pt-4">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            PHPSESSID Session Cookie
          </Label>
          <span className={cn(
            "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
            cookiePresent ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700",
          )}>
            {cookiePresent ? <span className="flex items-center gap-1"><CheckCircle2 size={10}/>Set</span> : "Missing"}
          </span>
        </div>

        {!show && cookiePresent && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono text-[12px] text-slate-700">
            {mask(cookie)}
          </div>
        )}

        {show && (
          <Input
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
            placeholder="PHPSESSID=abc123def456..."
            className="h-10 font-mono text-xs"
          />
        )}

        <div className="flex gap-2 items-center">
          <Button size="sm" variant="outline" onClick={() => setShow((s) => !s)}
            className="h-9 text-[10px] font-black uppercase">
            {show ? <><EyeOff size={12} className="mr-1"/>Hide</> : <><Eye size={12} className="mr-1"/>Edit</>}
          </Button>
          <div className="flex gap-1">
            {["agent", "client"].map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={cn(
                  "px-3 h-9 rounded-md text-[10px] font-black uppercase border transition",
                  mode === m ? "bg-[#0061f2] text-white border-[#0061f2]" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
                )}>
                {m}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={save} disabled={saving}
            className="ml-auto h-9 bg-[#0061f2] text-white text-[10px] font-black uppercase px-4">
            <Save size={12} className="mr-1" /> {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value, color, text }: { label: string; value: number | string; color?: string; text?: boolean }) {
  return (
    <div className="bg-[#f8f9fc] rounded-lg py-2">
      <div className={cn("font-black tracking-tight", text ? "text-sm" : "text-lg", color || "text-[#2b3a4a]")}>
        {value}
      </div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#69707a] opacity-70">{label}</div>
    </div>
  );
}

function Row({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-[#69707a] font-bold uppercase tracking-wider opacity-70">{label}</span>
      <span className={cn("font-bold", alert ? "text-red-600" : "text-[#2b3a4a]")}>{value}</span>
    </div>
  );
}
