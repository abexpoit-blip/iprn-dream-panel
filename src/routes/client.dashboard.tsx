import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/client/dashboard")({
  component: ClientDashboardPage,
});

function ClientDashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ["client_dashboard_stats"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const last7Days = new Date(today);
      last7Days.setDate(last7Days.getDate() - 7);
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const [
        { count: todayCount },
        { count: yesterdayCount },
        { count: last7DaysCount },
        { data: monthData },
      ] = await Promise.all([
        supabase
          .from("sms_logs")
          .select("*", { count: "exact", head: true })
          .gte("created_at", today.toISOString()),
        supabase
          .from("sms_logs")
          .select("*", { count: "exact", head: true })
          .gte("created_at", yesterday.toISOString())
          .lt("created_at", today.toISOString()),
        supabase
          .from("sms_logs")
          .select("*", { count: "exact", head: true })
          .gte("created_at", last7Days.toISOString()),
        supabase.from("sms_logs").select("payout").gte("created_at", startOfMonth.toISOString()),
      ]);

      const monthPayout =
        monthData?.reduce((acc: number, curr: any) => acc + (Number(curr.payout) || 0), 0) || 0;

      return {
        today: todayCount || 0,
        yesterday: yesterdayCount || 0,
        last7Days: last7DaysCount || 0,
        monthPayout: monthPayout.toFixed(2),
      };
    },
  });

  const chartData = [
    { name: "2026-05-31", sms: 400 },
    { name: "2026-06-01", sms: 300 },
    { name: "2026-06-02", sms: 200 },
    { name: "2026-06-03", sms: 100 },
    { name: "2026-06-04", sms: 500 },
    { name: "2026-06-05", sms: 450 },
    { name: "2026-06-06", sms: stats?.today || 0 },
  ];

  const cards = [
    {
      label: "SMS Today",
      value: stats?.today ?? 0,
      icon: MessageSquare,
      color: "bg-[#0061f2]",
    },
    {
      label: "SMS Yesterday",
      value: stats?.yesterday ?? 0,
      icon: MessageSquare,
      color: "bg-[#00ac69]",
    },
    {
      label: "Last 7 Days",
      value: stats?.last7Days ?? 0,
      icon: TrendingUp,
      color: "bg-[#f4a100]",
    },
    {
      label: "Month Payout ($)",
      value: stats?.monthPayout ?? "0.00",
      icon: TrendingUp,
      color: "bg-[#e81500]",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">Client Dashboard</h1>
        <p className="text-[#69707a] text-[13px] font-medium mt-0.5">
          Your SMS overview and recent activity
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="shadow-sm border-[#e3e6ec] rounded-xl overflow-hidden">
            <CardContent className="p-0">
              <div className={cn("h-1", c.color)} />
              <div className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase text-[#69707a] tracking-widest">
                    {c.label}
                  </p>
                  <p className="text-2xl font-bold text-[#2b3a4a] mt-1">{c.value}</p>
                </div>
                <div
                  className={cn(
                    "w-11 h-11 rounded-lg flex items-center justify-center text-white",
                    c.color
                  )}
                >
                  <c.icon size={20} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm border-[#e3e6ec] rounded-xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-[#2b3a4a] uppercase text-xs tracking-widest">
              SMS Activity (Last 7 Days)
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3e6ec" />
              <XAxis dataKey="name" stroke="#69707a" fontSize={11} />
              <YAxis stroke="#69707a" fontSize={11} />
              <Tooltip />
              <Bar dataKey="sms" fill="#0061f2" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
