import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DollarSign, CheckCircle, XCircle, Search, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function PayoutsTab() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchPayouts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payouts')
      .select('*, profiles(username)')
      .order('created_at', { ascending: false });
    
    if (error) toast.error("Error fetching payouts");
    else setPayouts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPayouts();
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase
      .from('payouts')
      .update({ status })
      .eq('id', id);

    if (error) toast.error("Update failed");
    else {
      toast.success(`Payout ${status}`);
      fetchPayouts();
    }
  };

  const filteredPayouts = payouts.filter(p => 
    p.profiles?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4 bg-[#f8f9fc] p-4 rounded-xl border border-[#e3e6ec]">
        <div className="relative flex-1 max-w-sm">
          <Input 
            placeholder="Search by agent or status..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 rounded-lg border-[#e3e6ec] bg-white"
          />
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#69707a]" />
        </div>
        <div className="flex items-center gap-2">
           <div className="bg-white px-3 py-1.5 rounded-lg border border-[#e3e6ec] flex items-center gap-2">
              <Clock size={14} className="text-amber-500" />
              <span className="text-[11px] font-bold text-[#2b3a4a] uppercase">Pending: {payouts.filter(p => p.status === 'pending').length}</span>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-[#e3e6ec] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#f8f9fc]">
              <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6">Agent</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6">Amount</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6">Status</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6">Date</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-[#69707a] text-center px-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-20"><div className="w-6 h-6 border-2 border-[#0061f2] border-t-transparent rounded-full animate-spin mx-auto"></div></TableCell></TableRow>
            ) : filteredPayouts.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-20 text-[#69707a] italic">No payout requests found</TableCell></TableRow>
            ) : (
              filteredPayouts.map((p) => (
                <TableRow key={p.id} className="border-b border-[#f2f4f8]">
                  <td className="px-6 py-4 font-bold text-[#2b3a4a]">{p.profiles?.username}</td>
                  <td className="px-6 py-4 font-black text-[#e81500]">${Number(p.amount).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded text-[10px] font-black uppercase shadow-sm",
                      p.status === 'completed' ? "bg-green-500 text-white" : p.status === 'pending' ? "bg-amber-500 text-white" : "bg-red-500 text-white"
                    )}>{p.status}</span>
                  </td>
                  <td className="px-6 py-4 text-[12px] text-[#69707a] font-medium">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-center">
                    {p.status === 'pending' && (
                      <div className="flex justify-center gap-2">
                        <Button onClick={() => handleStatusChange(p.id, 'completed')} variant="ghost" size="sm" className="text-green-600 hover:bg-green-50 font-bold uppercase text-[10px]">Approve</Button>
                        <Button onClick={() => handleStatusChange(p.id, 'rejected')} variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 font-bold uppercase text-[10px]">Reject</Button>
                      </div>
                    )}
                  </td>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
