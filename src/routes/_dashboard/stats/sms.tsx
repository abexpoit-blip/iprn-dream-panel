import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { IMSDataTable, type IMSColumn } from "@/components/ims/IMSDataTable";

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
  const { data, isLoading } = useQuery({
    queryKey: ["sms_stats_cdr"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_cdr")
        .select(
          "received_at,prefix,number,message,payout,clients(name)"
        )
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
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const columns: IMSColumn<Row>[] = [
    { key: "date", header: "Date", value: (r) => r.date },
    { key: "range", header: "Range", value: (r) => r.range },
    { key: "number", header: "Number", value: (r) => r.number },
    { key: "cli", header: "CLI", value: (r) => r.cli },
    { key: "client", header: "Client", value: (r) => r.client },
    { key: "sms", header: "SMS", value: (r) => r.sms },
    { key: "currency", header: "Currency", value: () => "USD" },
    {
      key: "my",
      header: "My Payout",
      value: (r) => `$${r.payout.toFixed(4)}`,
      cell: (r) => (
        <span className="font-bold text-green-600">
          ${r.payout.toFixed(4)}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "cp",
      header: "Client Payout",
      value: (r) => `$${r.payout.toFixed(4)}`,
      cell: (r) => (
        <span className="font-bold text-[#e81500]">
          ${r.payout.toFixed(4)}
        </span>
      ),
      className: "text-right",
    },
  ];

  return (
    <IMSDataTable
      title="SMS Stats"
      subtitle="All SMS records across time"
      columns={columns}
      rows={data}
      loading={isLoading}
      exportName="SMSStats"
      defaultPageSize={25}
    />
  );
}
