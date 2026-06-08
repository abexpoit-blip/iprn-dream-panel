import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { IMSDataTable, type IMSColumn } from "@/components/ims/IMSDataTable";

export const Route = createFileRoute("/_dashboard/sms/ranges")({
  component: SmsRangesPage,
});

type Range = {
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

function SmsRangesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["sms_ranges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_ranges")
        .select("*")
        .order("prefix");
      if (error) throw error;
      return data as Range[];
    },
  });

  const fmt = (v: number | null) =>
    v == null || Number(v) === 0 ? "NA" : `$${Number(v).toFixed(4)}`;

  const columns: IMSColumn<Range>[] = [
    {
      key: "range",
      header: "Range",
      value: (r) => r.name ?? r.memo ?? r.prefix,
      cell: (r) => (
        <span className="font-bold text-[#2b3a4a]">
          {r.name ?? r.memo ?? r.prefix}
        </span>
      ),
    },
    {
      key: "prefix",
      header: "Prefix",
      value: (r) => r.prefix,
      cell: (r) => <span className="font-mono">{r.prefix}</span>,
    },
    { key: "test", header: "Test Number", value: (r) => r.test_number ?? "-" },
    { key: "currency", header: "Currency", value: (r) => r.currency ?? "USD" },
    {
      key: "p11",
      header: "1/1",
      value: (r) => fmt(r.payout_1_1),
      className: "text-center",
    },
    {
      key: "p71",
      header: "7/1",
      value: (r) => fmt(r.payout_7_1),
      className: "text-center",
      cell: (r) => (
        <span className="text-center font-bold text-[#0061f2]">
          {fmt(r.payout_7_1)}
        </span>
      ),
    },
    {
      key: "p77",
      header: "7/7",
      value: (r) => fmt(r.payout_7_7),
      className: "text-center",
    },
    {
      key: "p3045",
      header: "30/45",
      value: (r) => fmt(r.payout_30_45),
      className: "text-center",
      cell: (r) => (
        <span className="text-center font-bold text-[#0061f2]">
          {fmt(r.payout_30_45)}
        </span>
      ),
    },
    { key: "memo", header: "Memo", value: (r) => r.memo ?? "-" },
  ];

  return (
    <IMSDataTable<Range>
      title="SMS Ranges"
      subtitle="View available SMS prefixes and payouts"
      columns={columns}
      rows={data}
      loading={isLoading}
      exportName="SMSRanges"
      rowKey={(r) => r.id}
    />
  );
}
