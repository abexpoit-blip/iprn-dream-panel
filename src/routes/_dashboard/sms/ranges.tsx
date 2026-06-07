import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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

export const Route = createFileRoute("/_dashboard/sms/ranges")({
  component: SmsRangesPage,
});

function SmsRangesPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: ranges, isLoading } = useQuery({
    queryKey: ['sms_ranges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sms_ranges')
        .select('*')
        .order('prefix');
      if (error) throw error;
      return data;
    }
  });

  const filteredRanges = ranges?.filter((r: any) => 
    r.prefix?.includes(searchTerm) || 
    r.memo?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleExport = () => {
    const headers = ["Prefix", "Test Number", "Currency", "1/1", "7/1", "7/7", "30/45", "Memo"];
    const csvData = filteredRanges.map((r: any) => [
      r.prefix,
      r.test_number || '-',
      r.currency,
      r.payout_1_1 || 'NA',
      r.payout_7_1,
      r.payout_7_7 || 'NA',
      r.payout_30_45,
      (r.memo || '-').replace(/,/g, " ")
    ]);
    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Ranges_Report_${new Date().toISOString()}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">SMS Ranges</h1>
        <p className="text-[#69707a] text-[13px] font-medium mt-0.5">View and manage SMS prefixes and payouts</p>
      </div>

      <Card className="shadow-sm border-[#e3e6ec]">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-2 mb-6 border-b border-[#e3e6ec] pb-6">
            <Button variant="outline" size="sm" className="bg-[#0061f2] text-white hover:bg-[#0052ce] border-none px-4 font-bold text-[10px] uppercase tracking-wider">Copy</Button>
            <Button onClick={handleExport} variant="outline" size="sm" className="bg-[#0061f2] text-white hover:bg-[#0052ce] border-none px-4 font-bold text-[10px] uppercase tracking-wider">CSV</Button>
            <Button onClick={handleExport} variant="outline" size="sm" className="bg-[#0061f2] text-white hover:bg-[#0052ce] border-none px-4 font-bold text-[10px] uppercase tracking-wider">Excel</Button>
            <Button variant="outline" size="sm" className="bg-[#0061f2] text-white hover:bg-[#0052ce] border-none px-4 font-bold text-[10px] uppercase tracking-wider">PDF</Button>
            <Button variant="outline" size="sm" className="bg-[#0061f2] text-white hover:bg-[#0052ce] border-none px-4 font-bold text-[10px] uppercase tracking-wider">Print</Button>
            
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs font-bold text-[#69707a] uppercase tracking-wider">Search:</span>
              <Input 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48 h-8 border-[#c5ccd6] focus:border-[#0061f2] focus:ring-0 text-xs" 
              />
            </div>
          </div>

          <div className="border border-[#e3e6ec] rounded overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50 border-b border-[#e3e6ec]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-4 h-auto border-r border-[#e3e6ec]">Prefix</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-4 h-auto border-r border-[#e3e6ec]">Test Number</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-4 h-auto border-r border-[#e3e6ec]">Currency</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-1 h-auto text-center border-b border-[#e3e6ec] border-r border-[#e3e6ec]" colSpan={4}>Payouts</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-4 h-auto border-r border-[#e3e6ec]">Memo</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-4 h-auto">Action</TableHead>
                </TableRow>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="border-r border-[#e3e6ec]"></TableHead>
                  <TableHead className="border-r border-[#e3e6ec]"></TableHead>
                  <TableHead className="border-r border-[#e3e6ec]"></TableHead>
                  <TableHead className="text-center text-[10px] font-bold text-[#69707a] py-2 h-auto border-r border-[#e3e6ec]">1/1</TableHead>
                  <TableHead className="text-center text-[10px] font-bold text-[#69707a] py-2 h-auto border-r border-[#e3e6ec]">7/1</TableHead>
                  <TableHead className="text-center text-[10px] font-bold text-[#69707a] py-2 h-auto border-r border-[#e3e6ec]">7/7</TableHead>
                  <TableHead className="text-center text-[10px] font-bold text-[#69707a] py-2 h-auto border-r border-[#e3e6ec]">30/45</TableHead>
                  <TableHead className="border-r border-[#e3e6ec]"></TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-gray-500 text-sm italic">Loading ranges...</TableCell>
                  </TableRow>
        ) : filteredRanges?.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9} className="text-center py-10 text-gray-500 text-sm italic">No ranges found</TableCell>
          </TableRow>
        ) : (
          filteredRanges?.map((range: any) => (
            <TableRow key={range.id} className="border-b border-[#f2f4f8] hover:bg-gray-50 transition-colors">
              <TableCell className="text-xs font-bold text-[#2b3a4a] py-3 border-r border-[#e3e6ec]">{range.prefix}</TableCell>
              <TableCell className="text-xs text-[#2b3a4a] py-3 border-r border-[#e3e6ec]">{range.test_number}</TableCell>
              <TableCell className="text-xs text-[#2b3a4a] py-3 border-r border-[#e3e6ec]">{range.currency}</TableCell>
              <TableCell className="text-center text-xs font-bold text-[#e81500] py-3 border-r border-[#e3e6ec]">{range.payout_1_1 || 'NA'}</TableCell>
              <TableCell className="text-center text-xs font-bold text-[#0061f2] py-3 border-r border-[#e3e6ec]">${range.payout_7_1}</TableCell>
              <TableCell className="text-center text-xs font-bold text-[#e81500] py-3 border-r border-[#e3e6ec]">{range.payout_7_7 || 'NA'}</TableCell>
              <TableCell className="text-center text-xs font-bold text-[#0061f2] py-3 border-r border-[#e3e6ec]">${range.payout_30_45}</TableCell>
              <TableCell className="text-xs text-[#69707a] py-3 border-r border-[#e3e6ec]">{range.memo || '-'}</TableCell>
              <TableCell className="py-3"></TableCell>
            </TableRow>
          ))
        )}
              </TableBody>
            </Table>
          </div>
          
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs font-bold text-[#69707a] uppercase tracking-wider">Showing 1 to {ranges?.length || 0} of {ranges?.length || 0} entries</p>
            <div className="flex">
              <Button variant="outline" className="h-8 text-[10px] font-bold uppercase rounded-r-none border-[#e3e6ec] text-[#69707a] disabled:opacity-50" disabled>First</Button>
              <Button variant="outline" className="h-8 text-[10px] font-bold uppercase rounded-none border-x-0 border-[#e3e6ec] text-[#69707a] disabled:opacity-50" disabled>Previous</Button>
              <Button variant="outline" className="h-8 w-8 p-0 text-[10px] font-bold uppercase rounded-none border-[#0061f2] bg-[#0061f2] text-white">1</Button>
              <Button variant="outline" className="h-8 text-[10px] font-bold uppercase rounded-none border-x-0 border-[#e3e6ec] text-[#69707a] disabled:opacity-50" disabled>Next</Button>
              <Button variant="outline" className="h-8 text-[10px] font-bold uppercase rounded-l-none border-[#e3e6ec] text-[#69707a] disabled:opacity-50" disabled>Last</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

