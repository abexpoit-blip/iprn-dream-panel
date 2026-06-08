import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || 'https://X.nexus-x.site/api';

export const Route = createFileRoute("/_dashboard/sms/numbers")({
  component: SmsNumbersPage,
});

function SmsNumbersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRange, setFilterRange] = useState("All Ranges");
  const [autoPooling, setAutoPooling] = useState(false);
  const queryClient = useQueryClient();

  const { data: numbers, isLoading } = useQuery({
    queryKey: ['number_pool_view'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('number_pool')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const rangeOptions = Array.from(
    new Set((numbers || []).map((n: any) => n.range_name).filter(Boolean))
  ).sort() as string[];

  const filteredNumbers = numbers?.filter((num: any) =>
    (filterRange === "All Ranges" || num.range_name === filterRange) &&
    (
      num.number?.includes(searchTerm) ||
      num.range_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      num.country?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  ) || [];

  const handleExport = () => {
    const headers = ["Number", "Country", "Range", "Prefix", "Payout", "Status", "Last Update"];
    const csvData = filteredNumbers.map((num: any) => [
      num.number,
      num.country || '-',
      num.range_name || '-',
      num.prefix || '-',
      num.panel_payout ?? '-',
      num.status,
      new Date(num.updated_at || num.created_at).toLocaleString()
    ]);
    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Numbers_Report_${new Date().toISOString()}.csv`;
    link.click();
    toast.success("Export started");
  };

  const handleAutoPool = async () => {
    setAutoPooling(true);
    try {
      const token = localStorage.getItem('nexus_token');
      const res = await fetch(`${API_URL}/api/numbers/auto-pool`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auto Pool failed');
      toast.success(data.message || 'Auto Pool started — scraping number panels...');
      // Bots scrape async; refetch after a few seconds, then again to catch slower panels
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['number_pool_view'] }), 4000);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['number_pool_view'] }), 12000);
    } catch (e: any) {
      toast.error(`Auto Pool failed: ${e.message}`);
    } finally {
      setTimeout(() => setAutoPooling(false), 4000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-[#2b3a4a]">SMS Numbers Inventory</h1>
        <Button
          onClick={handleAutoPool}
          disabled={autoPooling}
          className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold uppercase tracking-wider text-xs gap-2"
        >
          {autoPooling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {autoPooling ? 'Pooling…' : 'Start Auto Pool'}
        </Button>
      </div>

      <Card className="shadow-sm border-[#e3e6ec]">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-2 mb-6 border-b border-[#e3e6ec] pb-6">
            <Button onClick={handleExport} variant="outline" size="sm" className="bg-[#0061f2] text-white hover:bg-[#0052ce] border-none px-4 font-bold text-[10px] uppercase tracking-wider">CSV</Button>
            <Button onClick={handleExport} variant="outline" size="sm" className="bg-[#0061f2] text-white hover:bg-[#0052ce] border-none px-4 font-bold text-[10px] uppercase tracking-wider">Excel</Button>
            
            
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-[#69707a]">Service:</span>
                <select 
                  value={filterRange}
                  onChange={(e) => setFilterRange(e.target.value)}
                  className="h-8 border border-[#c5ccd6] rounded-md px-2 text-xs focus:ring-1 focus:ring-[#0061f2] outline-none"
                >
                  <option>All Ranges</option>
                  <option>Facebook</option>
                  <option>WhatsApp</option>
                  <option>Telegram</option>
                  <option>Google</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-[#69707a]">Search:</span>
                <Input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-48 h-8 border-[#c5ccd6] focus:border-[#0061f2] focus:ring-0 text-xs" 
                />
              </div>
            </div>
          </div>

          <div className="border border-[#e3e6ec] rounded overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50 border-b border-[#e3e6ec]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-4 h-auto border-r border-[#e3e6ec]">Phone Number</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-4 h-auto border-r border-[#e3e6ec]">Service</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-4 h-auto border-r border-[#e3e6ec]">Status</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-4 h-auto border-r border-[#e3e6ec]">Last Update</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-4 h-auto">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-500 text-sm italic">Loading numbers...</TableCell>
                  </TableRow>
                ) : filteredNumbers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-500 text-sm italic">No matching numbers found</TableCell>
                  </TableRow>
                ) : (
                  filteredNumbers.map((num: any) => (
                    <TableRow key={num.id} className="border-b border-[#f2f4f8] hover:bg-gray-50 transition-colors">
                      <TableCell className="text-xs font-bold text-[#2b3a4a] py-3 border-r border-[#e3e6ec]">{num.number}</TableCell>
                      <TableCell className="text-xs text-[#69707a] py-3 border-r border-[#e3e6ec]">{num.service_tag || 'Global'}</TableCell>
                      <TableCell className="py-3 border-r border-[#e3e6ec]">
                        <span className={cn(
                          "px-2 py-0.5 text-white text-[10px] font-bold rounded uppercase",
                          num.status === 'available' ? "bg-green-500" : num.status === 'reserved' ? "bg-amber-500" : "bg-slate-500"
                        )}>{num.status}</span>
                      </TableCell>
                      <TableCell className="text-xs text-[#69707a] py-3 border-r border-[#e3e6ec]">{new Date(num.updated_at || num.created_at).toLocaleString()}</TableCell>
                      <TableCell className="py-3 text-center">
                         <Button variant="ghost" size="sm" className="h-7 text-[#0061f2] hover:bg-blue-50 text-[10px] font-bold uppercase">Details</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
