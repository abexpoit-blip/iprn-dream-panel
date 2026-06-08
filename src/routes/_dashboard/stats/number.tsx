import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { IMSDataTable, type IMSColumn } from "@/components/ims/IMSDataTable";

export const Route = createFileRoute("/_dashboard/stats/number")({
  component: NumberStatsPage,
});

type Row = { number: string; sms: number; payout: number };

function NumberStatsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["number_stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_cdr")
        .select("number, payout")
        .limit(10000);
      if (error) throw error;
      const agg = new Map<string, Row>();
      (data ?? []).forEach((r: any) => {
        const n = r.number ?? "Unknown";
        const e = agg.get(n) ?? { number: n, sms: 0, payout: 0 };
        e.sms += 1;
        e.payout += Number(r.payout ?? 0);
        agg.set(n, e);
      });
      return Array.from(agg.values()).sort((a, b) => b.sms - a.sms);
    },
  });

  const columns: IMSColumn<Row>[] = [
    {
      key: "number",
      header: "Number",
      value: (r) => r.number,
      cell: (r) => <span className="font-bold">{r.number}</span>,
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
      title="Number Stats"
      subtitle="SMS volume and payout per number"
      columns={columns}
      rows={data}
      loading={isLoading}
      exportName="NumberStats"
    />
  );
}
