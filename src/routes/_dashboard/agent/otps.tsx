import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { IMSDataTable, type IMSColumn } from "@/components/ims/IMSDataTable";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_dashboard/agent/otps")({
  component: AgentOtpsPage,
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
  created_at: string;
};

function AgentOtpsPage() {
  // RLS already restricts otp_audit_log to OTPs for numbers where
  // number_pool.assigned_agent = auth.uid(). No extra filter needed.
  const { data: rows, isLoading } = useQuery<Row[]>({
    queryKey: ["agent_otps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("otp_audit_log")
        .select("id,phone_number,cli,otp_code,sms_text,outcome,created_at")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as Row[];
    },
    refetchInterval: 15000,
  });

  const columns: IMSColumn<Row>[] = [
    {
      key: "time",
      header: "Date",
      value: (r) => formatLocal(r.created_at),
    },
    {
      key: "number",
      header: "Number",
      value: (r) => r.phone_number ?? "—",
      cell: (r) => <span className="font-bold text-[#2b3a4a]">{r.phone_number ?? "—"}</span>,
    },
    {
      key: "cli",
      header: "Service / CLI",
      value: (r) => r.cli ?? "—",
    },
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
        <span className="text-[12px] text-[#69707a] line-clamp-2 max-w-[420px] block">
          {r.sms_text ?? "—"}
        </span>
      ),
    },
    {
      key: "outcome",
      header: "Status",
      value: (r) => r.outcome,
      cell: (r) => (
        <span
          className={cn(
            "px-2 py-0.5 text-white text-[10px] font-bold rounded uppercase",
            r.outcome === "billed" ? "bg-emerald-500" : "bg-slate-500",
          )}
        >
          {r.outcome}
        </span>
      ),
    },
  ];

  return (
    <IMSDataTable<Row>
      title="My OTPs"
      subtitle="OTPs delivered only on numbers admin has allocated to you."
      columns={columns}
      rows={rows || []}
      loading={isLoading}
      exportName="AgentOTPs"
      rowKey={(r) => r.id}
      emptyText="No OTPs yet for your allocated numbers."
    />
  );
}
