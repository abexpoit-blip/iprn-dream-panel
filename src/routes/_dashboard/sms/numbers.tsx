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

export const Route = createFileRoute("/_dashboard/sms/numbers")({
  component: SmsNumbersPage,
});

function SmsNumbersPage() {
  const { data: numbers, isLoading } = useQuery({
    queryKey: ['sms_numbers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sms_logs')
        .select('number, status, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      // Unique numbers for display purposes in this list
      const uniqueNumbers = Array.from(new Set(data.map((n: any) => n.number))).map(num => {
        return data.find((n: any) => n.number === num);
      });
      return uniqueNumbers;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-[#2b3a4a]">SMS Numbers</h1>
      </div>

      <Card className="shadow-sm border-[#e3e6ec]">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-2 mb-6 border-b border-[#e3e6ec] pb-6">
            <Button variant="outline" size="sm" className="bg-[#0061f2] text-white hover:bg-[#0052ce] border-none px-4 font-bold text-[10px] uppercase tracking-wider">Copy</Button>
            <Button variant="outline" size="sm" className="bg-[#0061f2] text-white hover:bg-[#0052ce] border-none px-4 font-bold text-[10px] uppercase tracking-wider">CSV</Button>
            <Button variant="outline" size="sm" className="bg-[#0061f2] text-white hover:bg-[#0052ce] border-none px-4 font-bold text-[10px] uppercase tracking-wider">Excel</Button>
            
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs font-bold text-[#69707a] uppercase tracking-wider">Search:</span>
              <Input className="w-48 h-8 border-[#c5ccd6] focus:border-[#0061f2] focus:ring-0 text-xs" />
            </div>
          </div>

          <div className="border border-[#e3e6ec] rounded overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50 border-b border-[#e3e6ec]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-4 h-auto border-r border-[#e3e6ec]">Phone Number</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-4 h-auto border-r border-[#e3e6ec]">Status</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-4 h-auto border-r border-[#e3e6ec]">Last Seen</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a] py-4 h-auto">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-gray-500 text-sm italic">Loading numbers...</TableCell>
                  </TableRow>
                ) : !numbers || numbers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-gray-500 text-sm italic">No numbers found</TableCell>
                  </TableRow>
                ) : (
                  numbers.map((num: any, idx) => (
                    <TableRow key={idx} className="border-b border-[#f2f4f8] hover:bg-gray-50 transition-colors">
                      <TableCell className="text-xs font-bold text-[#2b3a4a] py-3 border-r border-[#e3e6ec]">{num.number}</TableCell>
                      <TableCell className="py-3 border-r border-[#e3e6ec]">
                        <span className="px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded uppercase">Active</span>
                      </TableCell>
                      <TableCell className="text-xs text-[#69707a] py-3 border-r border-[#e3e6ec]">{new Date(num.created_at).toLocaleString()}</TableCell>
                      <TableCell className="py-3 text-center">
                         <Button variant="ghost" size="sm" className="h-7 text-[#0061f2] hover:bg-blue-50 text-[10px] font-bold uppercase">View Logs</Button>
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
