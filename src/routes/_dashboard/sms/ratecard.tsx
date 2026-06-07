import { createFileRoute } from "@tanstack/react-router";
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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_dashboard/sms/ratecard")({
  component: SmsRateCardPage,
});

function SmsRateCardPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: rates, isLoading } = useQuery({
    queryKey: ['sms_rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sms_ranges')
        .select('*')
        .order('prefix');
      if (error) throw error;
      return data;
    }
  });

  const filteredRates = rates?.filter((rate: any) => 
    rate.prefix?.includes(searchTerm) || 
    rate.memo?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleExport = () => {
    const headers = ["Prefix", "Country", "Network", "Rate (USD)"];
    const csvData = filteredRates.map((rate: any) => [
      rate.prefix,
      rate.memo?.split(' ')[0] || 'International',
      rate.memo || 'All Networks',
      `$${rate.payout_7_1 || '0.00'}`
    ]);
    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `RateCard_${new Date().toISOString()}.csv`;
    link.click();
    toast.success("Exporting RateCard");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-[#2b3a4a]">SMS RateCard Inventory</h1>
      </div>

      <Card className="shadow-sm border-[#e3e6ec]">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-2 mb-6 border-b border-[#e3e6ec] pb-6">
            <Button onClick={handleExport} variant="outline" size="sm" className="bg-[#0061f2] text-white hover:bg-[#0052ce] border-none px-4 font-bold text-[10px] uppercase tracking-wider shadow-sm">CSV</Button>
            <Button onClick={handleExport} variant="outline" size="sm" className="bg-[#0061f2] text-white hover:bg-[#0052ce] border-none px-4 font-bold text-[10px] uppercase tracking-wider shadow-sm">Excel</Button>
            
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-[#69707a] tracking-wider">Search:</span>
              <Input 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48 h-8 border-[#c5ccd6] focus:border-[#0061f2] focus:ring-0 text-xs shadow-sm" 
              />
            </div>
          </div>

          <div className="border border-[#e3e6ec] rounded overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-gray-50 border-b border-[#e3e6ec]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-4 h-auto border-r border-[#e3e6ec]">Prefix</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-4 h-auto border-r border-[#e3e6ec]">Country</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-4 h-auto border-r border-[#e3e6ec]">Network</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-4 h-auto border-r border-[#e3e6ec]">Rate (USD)</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-4 h-auto">Memo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-500 text-sm italic">Loading rates...</TableCell>
                  </TableRow>
                ) : filteredRates?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-500 text-sm italic">No rates found matching search</TableCell>
                  </TableRow>
                ) : (
                  filteredRates.map((rate: any, idx: number) => (
                    <TableRow key={idx} className="border-b border-[#f2f4f8] hover:bg-gray-50 transition-colors">
                      <TableCell className="text-xs font-bold text-[#2b3a4a] py-3 border-r border-[#e3e6ec]">{rate.prefix}</TableCell>
                      <TableCell className="text-xs text-[#2b3a4a] py-3 border-r border-[#e3e6ec] font-medium">{rate.memo?.split(' ')[0] || 'International'}</TableCell>
                      <TableCell className="text-xs text-[#2b3a4a] py-3 border-r border-[#e3e6ec]">{rate.memo || 'All Networks'}</TableCell>
                      <TableCell className="text-xs font-bold text-[#00ac69] py-3 border-r border-[#e3e6ec]">${rate.payout_7_1 || '0.00'}</TableCell>
                      <TableCell className="text-xs text-[#69707a] py-3">{rate.memo || '-'}</TableCell>
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
