import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { 
  Users, 
  MessageSquare, 
  TrendingUp, 
  DollarSign 
} from "lucide-react";

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";

export const Route = createFileRoute("/_dashboard/dashboard")({
  component: DashboardPage,
});

const data = [
  { name: '2026-05-31', sms: 400, yesterday: 0 },
  { name: '2026-06-01', sms: 300, yesterday: 402 },
  { name: '2026-06-02', sms: 200, yesterday: 300 },
  { name: '2026-06-03', sms: 100, yesterday: 200 },
  { name: '2026-06-04', sms: 500, yesterday: 100 },
  { name: '2026-06-05', sms: 450, yesterday: 500 },
  { name: '2026-06-06', sms: 431, yesterday: 450 },
];

function DashboardPage() {
  const stats = [
    { label: "TODAY SMS", value: "431", color: "bg-[#0061f2]" },
    { label: "YESTERDAY SMS", value: "402", color: "bg-[#e81500]" },
    { label: "Last 7 Days", value: "3091", color: "bg-[#00ac69]" },
    { label: "Money This Month", value: "54.45", color: "bg-[#f4a100]", prefix: "$" },
  ];


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
        <span className="text-gray-500 text-sm">Summarized Stats & Reports</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className={cn("border-none shadow-sm", stat.color)}>
            <CardContent className="p-6 text-white">

              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium opacity-90">{stat.label}</p>
                  <h3 className="text-2xl font-bold mt-1">
                    {stat.prefix}{stat.value}
                  </h3>
                </div>
                <div className="p-2 bg-white/20 rounded-lg">
                  <TrendingUp size={20} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h3 className="font-semibold text-[#69707a] uppercase text-xs tracking-wider">LAST 7 DAYS SMS & IN/OUT PAYOUTS</h3>
          </div>

          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#666' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#666' }} />
                <Tooltip />
                <Bar dataKey="sms" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="yesterday" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
