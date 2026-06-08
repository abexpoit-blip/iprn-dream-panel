import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { IMSDataTable, type IMSColumn } from "@/components/ims/IMSDataTable";

export const Route = createFileRoute("/_dashboard/stats/client")({
  component: ClientStatsPage,
});

type Row = { client: string; sms: number; payout: number };

function ClientStatsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["client_stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_cdr")
        .select("payout, clients(name)")
        .limit(10000);
      if (error) throw error;
      const agg = new Map<string, Row>();
      (data ?? []).forEach((r: any) => {
        const name = r.clients?.name ?? "Unassigned";
        const e = agg.get(name) ?? { client: name, sms: 0, payout: 0 };
        e.sms += 1;
        e.payout += Number(r.payout ?? 0);
        agg.set(name, e);
      });
      return Array.from(agg.values()).sort((a, b) => b.sms - a.sms);
    },
  });

  const columns: IMSColumn<Row>[] = [
    {
      key: "client",
      header: "Client",
      value: (r) => r.client,
      cell: (r) => <span className="font-bold">{r.client}</span>,
    },
    {
      key: "sms",
      header: "SMS",
      value: (r) => r.sms,
      cell: (r) => (
        <span className="font-bold text-[#0061f2]">{r.sms}</span>
      ),
    },
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
      className: "text-right",
    },
  ];

  return (
    <IMSDataTable
      title="Client Stats"
      subtitle="SMS volume and payout per client"
      columns={columns}
      rows={data}
      loading={isLoading}
      exportName="ClientStats"
    />
  );
}
