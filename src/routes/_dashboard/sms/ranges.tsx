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

export const Route = createFileRoute("/_dashboard/sms/ranges")({
  component: SmsRangesPage,
});

function SmsRangesPage() {
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">SMS Ranges</h1>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-2 mb-6">
            <Button variant="outline" size="sm" className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white">Copy</Button>
            <Button variant="outline" size="sm" className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white">CSV</Button>
            <Button variant="outline" size="sm" className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white">Excel</Button>
            <Button variant="outline" size="sm" className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white">PDF</Button>
            <Button variant="outline" size="sm" className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white">Print</Button>
            
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-gray-500">Search:</span>
              <Input className="w-48 h-8" />
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="font-bold">PREFIX</TableHead>
                  <TableHead className="font-bold">TEST NUMBER</TableHead>
                  <TableHead className="font-bold">CURRENCY</TableHead>
                  <TableHead className="font-bold text-center" colSpan={4}>PAYOUTS</TableHead>
                  <TableHead className="font-bold">MEMO</TableHead>
                  <TableHead className="font-bold">ACTION</TableHead>
                </TableRow>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead></TableHead>
                  <TableHead></TableHead>
                  <TableHead className="text-center text-xs">1/1</TableHead>
                  <TableHead className="text-center text-xs">7/1</TableHead>
                  <TableHead className="text-center text-xs">7/7</TableHead>
                  <TableHead className="text-center text-xs">30/45</TableHead>
                  <TableHead></TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">Loading ranges...</TableCell>
                  </TableRow>
                ) : ranges?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">No ranges found</TableCell>
                  </TableRow>
                ) : (
                  ranges?.map((range) => (
                    <TableRow key={range.id}>
                      <TableCell className="font-medium">{range.prefix}</TableCell>
                      <TableCell>{range.test_number}</TableCell>
                      <TableCell>{range.currency}</TableCell>
                      <TableCell className="text-center text-red-500">{range.payout_1_1 || 'NA'}</TableCell>
                      <TableCell className="text-center text-blue-600">${range.payout_7_1}</TableCell>
                      <TableCell className="text-center text-red-500">{range.payout_7_7 || 'NA'}</TableCell>
                      <TableCell className="text-center text-blue-600">${range.payout_30_45}</TableCell>
                      <TableCell>{range.memo || '-'}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <p>Showing 1 to {ranges?.length || 0} of {ranges?.length || 0} entries</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>Previous</Button>
              <Button variant="outline" size="sm" className="bg-blue-600 text-white">1</Button>
              <Button variant="outline" size="sm" disabled>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
