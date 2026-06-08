import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { IMSDataTable, type IMSColumn } from "@/components/ims/IMSDataTable";

export const Route = createFileRoute("/_dashboard/sms/ratecard")({
  component: SmsRateCardPage,
});

type Rate = {
  id: string;
  prefix: string;
  test_number: string | null;
  currency: string | null;
  payout_1_1: number | null;
  payout_7_1: number | null;
  payout_7_7: number | null;
  payout_30_45: number | null;
  memo: string | null;
  name: string | null;
};

function SmsRateCardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["sms_ratecard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_ranges")
        .select("*")
        .order("prefix");
      if (error) throw error;
      return data as Rate[];
    },
  });

  const fmt = (v: number | null) =>
    v == null || Number(v) === 0 ? "NA" : `$${Number(v).toFixed(4)}`;

  // Only show payout tiers that actually exist as columns in sms_ranges.
  // Schema has: payout_1_1, payout_7_1, payout_7_7, payout_30_45.
  // Showing duplicates (15/15 = 7/7, 30/15 = 7/1, etc.) misrepresented values.
  const payoutCols: IMSColumn<Rate>[] = (
    [
      ["1/1", "payout_1_1"],
      ["7/1", "payout_7_1"],
      ["7/7", "payout_7_7"],
      ["30/45", "payout_30_45"],
    ] as const
  ).map(([label, k]) => ({
    key: `p_${label}`,
    header: label,
    value: (r) => fmt(r[k as keyof Rate] as number | null),
    className: "text-center",
  }));

  const columns: IMSColumn<Rate>[] = [
    {
      key: "range",
      header: "Range",
      value: (r) => r.name ?? r.memo ?? r.prefix,
    },
    { key: "prefix", header: "Prefix", value: (r) => r.prefix },
    { key: "test", header: "Test Number", value: (r) => r.test_number ?? "-" },
    { key: "currency", header: "Currency", value: (r) => r.currency ?? "USD" },
    ...payoutCols,
  ];

  return (
    <IMSDataTable<Rate>
      title="SMS RateCard"
      subtitle="Pricing across all payout tiers"
      columns={columns}
      rows={data}
      loading={isLoading}
      exportName="SMSRateCard"
      rowKey={(r) => r.id}
    />
  );
}
