import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/_dashboard/stats/cdr")({
  component: StatsCDRPage,
});


function StatsCDRPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRange, setFilterRange] = useState("All Ranges");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data: logs, isLoading } = useQuery({
    queryKey: ['sms_cdr', page, filterRange, startDate, endDate],
    queryFn: async () => {
      let query = supabase.from('sms_cdr').select('*', { count: 'exact' });
      
      if (filterRange !== "All Ranges") {
        query = query.eq('range', filterRange);
      }
      if (startDate) {
        query = query.gte('received_at', new Date(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('received_at', new Date(endDate).toISOString());
      }

      const { data, error, count } = await query
        .order('received_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
        
      if (error) throw error;
      return { data, count };
    }
  });

  const filteredLogs = logs?.data?.filter((log: any) => 
    log.phone_number?.includes(searchTerm) || 
    log.cli?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleExport = () => {
    const headers = ["Date", "Range", "Number", "CLI", "Client", "SMS", "Currency", "My Payout", "Client Payout"];
    const csvData = filteredLogs.map((log: any) => [
      new Date(log.received_at || log.created_at).toLocaleString(),
      log.range || '-',
      log.phone_number || log.number,
      log.cli || '-',
      log.client_name || 'Agent',
      log.message || log.sms_text || log.otp_code,
      "USD",
      `$${log.my_payout || '0.00'}`,
      `$${log.client_payout || '0.00'}`
    ]);
    
    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `CDR_Report_${new Date().toISOString()}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">SMS CDR Reports</h1>
          <p className="text-[#69707a] text-[13px] font-medium mt-0.5">Call Detail Records - Detailed SMS logs</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
            <Activity size={14} className="text-green-600" />
            <span className="text-[10px] font-black uppercase text-green-700 tracking-wider">Scraper SLA: 99.9%</span>
          </div>
        </div>
      </div>

      <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc]">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-[#69707a]">Start Date</label>
                <input 
                  type="datetime-local" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-9 border rounded-lg px-3 text-xs focus:ring-1 focus:ring-[#0061f2] outline-none" 
                />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-[#69707a]">End Date</label>
                <input 
                  type="datetime-local" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-9 border rounded-lg px-3 text-xs focus:ring-1 focus:ring-[#0061f2] outline-none" 
                />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-[#69707a]">Filter Range</label>
                <select 
                  value={filterRange}
                  onChange={(e) => setFilterRange(e.target.value)}
                  className="w-full h-9 border rounded-lg px-3 text-xs focus:ring-1 focus:ring-[#0061f2] outline-none"
                >
                  <option>All Ranges</option>
                  <option>IMS SMS</option>
                  <option>Shark SMS</option>
                  <option>SMS Hadi</option>
                </select>
             </div>
             <div className="flex items-end gap-2">
                <Button className="bg-[#0061f2] h-9 text-xs font-bold uppercase flex-1 shadow-md hover:translate-y-[-1px] transition-all">Show Report</Button>
                <Button onClick={handleExport} variant="outline" className="h-9 text-xs font-bold uppercase border-amber-500 text-amber-600 hover:bg-amber-50">CSV Export</Button>
             </div>
          </div>
          
          <div className="relative mt-2">
            <input 
              placeholder="Search by number, CLI or client..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 bg-white border border-[#e3e6ec] rounded-lg px-4 text-sm focus:ring-2 focus:ring-[#0061f2]/20 outline-none transition-all shadow-sm"
            />
          </div>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-none bg-[#f8f9fc] hover:bg-[#f8f9fc]">
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Date</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Range</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Number</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">CLI</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Client</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">SMS</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Currency</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4 text-right">My Payout</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4 text-right">Client Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-20">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-[#0061f2] border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm text-[#69707a] font-medium">Synchronizing CDR Data...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredLogs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-20 text-[#69707a] text-[13px] italic font-medium">
                      No matching records found in this range
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs?.map((log: any, idx: number) => (
                    <TableRow key={log.id} className={cn("border-b border-[#f2f4f8] hover:bg-gray-50/50 transition-colors", idx % 2 === 0 ? "bg-white" : "bg-[#fcfcfd]")}>
                      <TableCell className="text-[11px] font-medium text-[#69707a] px-6 py-3">{new Date(log.received_at || log.created_at).toLocaleString()}</TableCell>
                      <TableCell className="px-6 py-3">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{log.range || 'IMS'}</span>
                      </TableCell>
                      <TableCell className="text-[12px] font-black text-[#2b3a4a] px-6 py-3 tracking-tighter">{log.phone_number || log.number}</TableCell>
                      <TableCell className="text-[11px] font-bold text-blue-600 px-6 py-3 uppercase">{log.cli || '-'}</TableCell>
                      <TableCell className="text-[12px] font-bold text-[#2b3a4a] px-6 py-3">{log.client_name || 'Agent'}</TableCell>
                      <TableCell className="px-6 py-3 max-w-xs">
                        <div className="bg-[#f8f9fc] border border-[#e3e6ec] p-2 rounded-md font-mono text-[11px] text-[#4d5875] truncate shadow-inner">
                          {log.message || log.sms_text || log.otp_code}
                        </div>
                      </TableCell>
                      <TableCell className="text-[11px] font-bold text-[#69707a] px-6 py-3">USD</TableCell>
                      <TableCell className="text-[12px] font-black text-green-600 px-6 py-3 text-right">${log.my_payout || '0.00'}</TableCell>
                      <TableCell className="text-[12px] font-black text-[#e81500] px-6 py-3 text-right">${log.client_payout || '0.00'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="px-6 py-4 bg-[#f8f9fc] border-t border-[#e3e6ec] flex items-center justify-between">
            <p className="text-[11px] font-bold text-[#69707a] uppercase tracking-wider">
              Showing {(page-1)*pageSize + 1} to {Math.min(page*pageSize, logs?.count || 0)} of {logs?.count || 0} Records
            </p>
            <div className="flex gap-1">
              <Button 
                onClick={() => setPage((p: number) => Math.max(1, p - 1))} 
                disabled={page === 1}
                variant="outline" size="sm" className="h-8 px-3 text-[11px] font-black uppercase bg-white"
              >Previous</Button>
              <Button 
                onClick={() => setPage((p: number) => p + 1)} 
                disabled={!logs?.count || page * pageSize >= logs.count}
                variant="outline" size="sm" className="h-8 px-3 text-[11px] font-black uppercase bg-white"
              >Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

