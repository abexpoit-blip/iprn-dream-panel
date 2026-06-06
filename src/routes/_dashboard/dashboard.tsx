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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  { name: '2026-05-31', sms: 400, yesterday: 0 },
  { name: '2026-06-01', sms: 300, yesterday: 402 },
  { name: '2026-06-02', sms: 200, yesterday: 300 },
  { name: '2026-06-03', sms: 100, yesterday: 200 },
  { name: '2026-06-04', sms: 500, yesterday: 100 },
  { name: '2026-06-05', sms: 450, yesterday: 500 },
  { name: '2026-06-06', sms: 431, yesterday: 450 },
];

function DashboardPage() {
  const { data: recentClients } = useQuery({
    queryKey: ['recent_clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    }
  });

  const stats = [
    { label: "TODAY SMS", value: "431", color: "bg-[#0061f2]" },
    { label: "YESTERDAY SMS", value: "402", color: "bg-[#e81500]" },
    { label: "Last 7 Days", value: "3091", color: "bg-[#00ac69]" },
    { label: "Money This Month", value: "54.45", color: "bg-[#f4a100]", prefix: "$" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-[#2b3a4a]">Dashboard</h1>
        <span className="text-[#69707a] text-sm font-medium">Summarized Stats & Reports</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className={cn("border-none shadow-sm overflow-hidden", stat.color)}>
            <CardContent className="p-6 text-white relative">
              <div className="flex justify-between items-start z-10 relative">
                <div>
                  <p className="text-xs font-bold opacity-80 tracking-wider uppercase">{stat.label}</p>
                  <h3 className="text-3xl font-bold mt-1">
                    {stat.prefix}{stat.value}
                  </h3>
                </div>
                <div className="p-2 bg-white/20 rounded-lg">
                  <TrendingUp size={24} />
                </div>
              </div>
              <div className="absolute right-[-10px] bottom-[-10px] opacity-10">
                <TrendingUp size={100} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-[#e3e6ec]">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6 border-b border-[#e3e6ec] pb-4">
              <h3 className="font-bold text-[#69707a] uppercase text-xs tracking-wider">LAST 7 DAYS SMS & IN/OUT PAYOUTS</h3>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#69707a' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#69707a' }} />
                  <Tooltip />
                  <Bar dataKey="sms" fill="#0061f2" radius={[2, 2, 0, 0]} barSize={20} />
                  <Bar dataKey="yesterday" fill="#e81500" radius={[2, 2, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-[#e3e6ec]">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6 border-b border-[#e3e6ec] pb-4">
              <h3 className="font-bold text-[#69707a] uppercase text-xs tracking-wider">RECENT CLIENTS</h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-none bg-gray-50 hover:bg-gray-50">
                    <TableHead className="text-[10px] font-bold uppercase text-[#69707a]">Username</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-[#69707a]">Email</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-[#69707a]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentClients?.map((client) => (
                    <TableRow key={client.id} className="border-b border-[#f2f4f8] hover:bg-gray-50 transition-colors">
                      <TableCell className="text-sm font-medium text-[#2b3a4a] py-3">{client.username}</TableCell>
                      <TableCell className="text-sm text-[#69707a] py-3">{client.email || '-'}</TableCell>
                      <TableCell className="py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold",
                          client.status === 'Active' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}>
                          {(client.status || 'Inactive').toUpperCase()}
                        </span>
                      </TableCell>

                    </TableRow>
                  ))}
                  {(!recentClients || recentClients.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-10 text-[#69707a] text-sm italic">
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

