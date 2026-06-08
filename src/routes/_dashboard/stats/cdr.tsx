import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { IMSDataTable, type IMSColumn } from "@/components/ims/IMSDataTable";
import { Button } from "@/components/ui/button";

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
};

function StatsCDRPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(`${today}T00:00`);
  const [endDate, setEndDate] = useState(`${today}T23:59`);
  const [appliedStart, setAppliedStart] = useState(startDate);
  const [appliedEnd, setAppliedEnd] = useState(endDate);

  const { data, isLoading } = useQuery({
    queryKey: ["sms_cdr_report", appliedStart, appliedEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_cdr")
        .select("*, clients(name)")
        .gte("received_at", new Date(appliedStart).toISOString())
        .lte("received_at", new Date(appliedEnd).toISOString())
        .order("received_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data as (CDR & { clients: { name: string } | null })[];
    },
  });

  const columns: IMSColumn<CDR & { clients: { name: string } | null }>[] = [
    {
      key: "date",
      header: "Date",
      value: (r) => new Date(r.received_at).toLocaleString(),
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
    {
      key: "client",
      header: "Client",
      value: (r) => r.clients?.name ?? "-",
    },
    {
      key: "sms",
      header: "SMS",
      value: (r) => r.message ?? "",
      cell: (r) => (
        <span className="font-mono text-[11px] text-[#4d5875]">
          {r.message ?? ""}
        </span>
      ),
    },
    { key: "currency", header: "Currency", value: () => "USD" },
    {
      key: "my",
      header: "My Payout",
      value: (r) => `$${Number(r.payout ?? 0).toFixed(4)}`,
      cell: (r) => (
        <span className="font-bold text-green-600">
          ${Number(r.payout ?? 0).toFixed(4)}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "cp",
      header: "Client Payout",
      value: (r) => `$${Number(r.payout ?? 0).toFixed(4)}`,
      cell: (r) => (
        <span className="font-bold text-[#e81500]">
          ${Number(r.payout ?? 0).toFixed(4)}
        </span>
      ),
      className: "text-right",
    },
  ];

  const filters = (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
      <div>
        <label className="text-[10px] font-bold uppercase text-[#69707a] block mb-1">
          Start Date
        </label>
        <input
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full h-9 border border-[#c5ccd6] rounded px-3 text-xs focus:ring-1 focus:ring-[#0061f2] outline-none"
        />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase text-[#69707a] block mb-1">
          End Date
        </label>
        <input
          type="datetime-local"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-full h-9 border border-[#c5ccd6] rounded px-3 text-xs focus:ring-1 focus:ring-[#0061f2] outline-none"
        />
      </div>
      <Button
        onClick={() => {
          setAppliedStart(startDate);
          setAppliedEnd(endDate);
        }}
        className="h-9 bg-[#0061f2] hover:bg-[#0052ce] text-xs font-bold uppercase"
      >
        Show Report
      </Button>
    </div>
  );

  return (
    <IMSDataTable
      title="SMS CDR Reports"
      subtitle="Detailed Call Detail Records"
      columns={columns}
      rows={data}
      loading={isLoading}
      exportName="SMSCDRReports"
      filters={filters}
      defaultPageSize={25}
      rowKey={(r) => r.id}
    />
  );
}
