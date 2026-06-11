import { createFileRoute } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
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
  const [params, setParams] = useState({ page: 1, pageSize: 25, search: "" });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["agent_otps_paged", params],
    queryFn: async () => {
      const from = (params.page - 1) * params.pageSize;
      const to = from + params.pageSize - 1;

      let q = supabase
        .from("otp_audit_log")
        .select("id,phone_number,cli,otp_code,sms_text,outcome,created_at", { count: "exact" });

      const s = params.search.trim();
      if (s) {
        // Search across phone_number, cli, otp_code, sms_text
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

  const columns: IMSColumn<Row>[] = [
    { key: "time", header: "Date", value: (r) => formatLocal(r.created_at) },
    {
      key: "number",
      header: "Number",
      value: (r) => r.phone_number ?? "—",
      cell: (r) => <span className="font-bold text-[#2b3a4a]">{r.phone_number ?? "—"}</span>,
    },
    { key: "cli", header: "Service / CLI", value: (r) => r.cli ?? "—" },
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
      rows={data?.rows}
      totalCount={data?.total}
      onParamsChange={setParams}
      loading={isLoading || isFetching}
      exportName="AgentOTPs"
      rowKey={(r) => r.id}
      emptyText="No OTPs yet for your allocated numbers."
      defaultPageSize={25}
    />
  );
}
