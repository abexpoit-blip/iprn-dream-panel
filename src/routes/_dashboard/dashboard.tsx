import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { 
  Users, 
  TrendingUp, 
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getEffectiveUserId } from "@/lib/auth-helpers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_dashboard/dashboard")({
  component: DashboardPage,
});

const chartData = [
  { name: '2026-05-31', sms: 400, payout: 15 },
  { name: '2026-06-01', sms: 300, payout: 12 },
  { name: '2026-06-02', sms: 200, payout: 8 },
  { name: '2026-06-03', sms: 100, payout: 5 },
  { name: '2026-06-04', sms: 500, payout: 22 },
  { name: '2026-06-05', sms: 450, payout: 19 },
  { name: '2026-06-06', sms: 431, payout: 18 },
];

function DashboardPage() {
  const { data: statsData } = useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: async () => {
      const userId = await getEffectiveUserId();
      if (!userId) return null;

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
        { data: monthData }
      ] = await Promise.all([
        supabase.from('sms_logs').select('*', { count: 'exact', head: true }).eq('agent_id', userId).gte('created_at', today.toISOString()),
        supabase.from('sms_logs').select('*', { count: 'exact', head: true }).eq('agent_id', userId).gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString()),
        supabase.from('sms_logs').select('*', { count: 'exact', head: true }).eq('agent_id', userId).gte('created_at', last7Days.toISOString()),
        supabase.from('sms_logs').select('payout').eq('agent_id', userId).gte('created_at', startOfMonth.toISOString())
      ]);

      const monthPayout = monthData?.reduce((acc: number, curr: any) => acc + (Number(curr.payout) || 0), 0) || 0;

      return {
        today: todayCount || 0,
        yesterday: yesterdayCount || 0,
        last7Days: last7DaysCount || 0,
        monthPayout: monthPayout.toFixed(2)
      };
    }
  });

  const { data: recentClients } = useQuery({
    queryKey: ['recent_clients'],
    queryFn: async () => {
      const userId = await getEffectiveUserId();
      if (!userId) return [];

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('agent_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    }
  });

  const { data: recentRanges } = useQuery({
    queryKey: ['recent_ranges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sms_ranges')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) return [];
      return data;
    }
  });

  const stats = [
    { label: "TODAY SMS", value: statsData?.today?.toString() || "0", color: "bg-[#0061f2]", footer: "SMS Received Today" },
    { label: "YESTERDAY SMS", value: statsData?.yesterday?.toString() || "0", color: "bg-[#e81500]", footer: "These received yesterday" },
    { label: "Last 7 Days", value: statsData?.last7Days?.toString() || "0", color: "bg-[#00ac69]", footer: "Received in last 7 days" },
    { label: "Money This Month", value: statsData?.monthPayout || "0.00", color: "bg-[#f4a100]", footer: "Payout in this month", prefix: "$" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">SMS Dashboard</h1>
          <p className="text-[#69707a] text-[13px] font-medium mt-0.5">View Summarized Stats & Reports</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Link 
            key={stat.label} 
            to={stat.label.includes("MONEY") ? "/credits" : "/stats/cdr"}
            className={cn("rounded-xl shadow-md overflow-hidden relative group transition-transform hover:-translate-y-1 duration-300 block", stat.color)}
          >
            <div className="p-6 text-white">
              <p className="text-[10px] font-black opacity-70 tracking-[0.2em] uppercase mb-1">{stat.label}</p>
              <div className="flex items-baseline gap-1">
                <h3 className="text-4xl font-black">
                  {stat.value}
                </h3>
                {stat.prefix && <span className="text-xl font-bold opacity-80">{stat.prefix}</span>}
              </div>
              <p className="text-[11px] mt-4 opacity-80 font-medium">{stat.footer}</p>
            </div>
            <div className="absolute right-2 top-4 opacity-20 group-hover:scale-110 transition-transform duration-500">
               <TrendingUp size={24} />
            </div>
          </Link>
        ))}
      </div>

      <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc]">
            <h3 className="font-black text-[#69707a] uppercase text-[11px] tracking-widest">LAST 7 DAYS SMS & IN/OUT PAYOUTS</h3>
            <p className="text-[10px] text-[#69707a] opacity-60 mt-0.5">Here you can see each day sms for last 7 days and their payouts.</p>
          </div>
          <div className="p-6">
            <div className="flex gap-6 mb-8">
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#0061f2]"></div>
                  <span className="text-[11px] font-bold text-[#2b3a4a]">Today SMS</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#e81500]"></div>
                  <span className="text-[11px] font-bold text-[#2b3a4a]">Yesterday</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#f4a100]"></div>
                  <span className="text-[11px] font-bold text-[#2b3a4a]">Last 7 Day</span>
               </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e6ec" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#69707a', fontWeight: 600 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#69707a', fontWeight: 600 }} 
                  />
                  <Tooltip 
                    cursor={{fill: '#f2f4f8'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                  />
                  <Bar dataKey="sms" fill="#0061f2" radius={[4, 4, 0, 0]} barSize={35} />
                  <Bar dataKey="payout" fill="#e81500" radius={[4, 4, 0, 0]} barSize={35} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc]">
            <h3 className="font-black text-[#69707a] uppercase text-[11px] tracking-widest">RECENT BILLING GROUPS/RANGES</h3>
            <p className="text-[10px] text-[#69707a] opacity-60 mt-0.5">Here you can see the recently added ranges.</p>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-none bg-[#f8f9fc] hover:bg-[#f8f9fc]">
                    <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Range Name</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Prefix</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRanges?.map((range: any, idx: number) => (
                    <TableRow key={range.id} className={cn("border-b border-[#f2f4f8] hover:bg-gray-50/50 transition-colors", idx % 2 === 0 ? "bg-white" : "bg-[#fcfcfd]")}>
                      <TableCell className="text-[13px] font-bold text-[#2b3a4a] px-6 py-4">{range.name || range.memo || range.prefix}</TableCell>
                      <TableCell className="text-[13px] font-medium text-[#69707a] px-6 py-4">{range.prefix || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {(!recentRanges || recentRanges.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-12 text-[#69707a] text-[13px] italic font-medium">
                        No recent billing ranges found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc]">
            <h3 className="font-black text-[#69707a] uppercase text-[11px] tracking-widest">RECENT CLIENTS</h3>
            <p className="text-[10px] text-[#69707a] opacity-60 mt-0.5">Here you can see the agents you added recently.</p>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-none bg-[#f8f9fc] hover:bg-[#f8f9fc]">
                    <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Username</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Email</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentClients?.map((client: any, idx: number) => (
                    <TableRow key={client.id} className={cn("border-b border-[#f2f4f8] hover:bg-gray-50/50 transition-colors", idx % 2 === 0 ? "bg-white" : "bg-[#fcfcfd]")}>
                      <TableCell className="text-[13px] font-bold text-[#2b3a4a] px-6 py-4">{client.username}</TableCell>
                      <TableCell className="text-[13px] font-medium text-[#69707a] px-6 py-4">{client.email || '-'}</TableCell>
                      <TableCell className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider uppercase shadow-sm",
                          client.status === 'Active' ? "bg-green-500 text-white" : "bg-red-500 text-white"
                        )}>
                          {(client.status || 'Active')}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!recentClients || recentClients.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12 text-[#69707a] text-[13px] italic font-medium">
                        No recent clients found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default DashboardPage;
