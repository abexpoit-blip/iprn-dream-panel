import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DollarSign, CheckCircle, XCircle, Search, Clock, CreditCard, Send, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export function PayoutsTab() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPayout, setSelectedPayout] = useState<any>(null);
  const [isProcessOpen, setIsProcessOpen] = useState(false);
  const [transactionId, setTransactionId] = useState("");

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

  const handleStatusChange = async (id: string, status: string, trxId?: string) => {
    const { error } = await supabase
      .from('payouts')
      .update({ 
        status, 
        transaction_id: trxId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) toast.error("Update failed");
    else {
      toast.success(`Payout ${status}`);
      setIsProcessOpen(false);
      setTransactionId("");
      fetchPayouts();
    }
  };

  const filteredPayouts = payouts.filter(p => 
    p.profiles?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openProcessDialog = (payout: any) => {
    setSelectedPayout(payout);
    setIsProcessOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#f8f9fc] p-4 rounded-xl border border-[#e3e6ec]">
        <div className="relative flex-1 w-full max-w-sm">
          <Input 
            placeholder="Search agent, status..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 rounded-lg border-[#e3e6ec] bg-white shadow-sm"
          />
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#69707a]" />
        </div>
        <div className="flex items-center gap-3">
           <div className="bg-white px-3 py-2 rounded-lg border border-[#e3e6ec] flex items-center gap-2 shadow-sm">
              <Clock size={14} className="text-amber-500" />
              <span className="text-[10px] font-black text-[#2b3a4a] uppercase tracking-wider">Pending: {payouts.filter(p => p.status === 'pending').length}</span>
           </div>
           <div className="bg-white px-3 py-2 rounded-lg border border-[#e3e6ec] flex items-center gap-2 shadow-sm">
              <DollarSign size={14} className="text-green-600" />
              <span className="text-[10px] font-black text-[#2b3a4a] uppercase tracking-wider">Total Paid: ${payouts.filter(p => p.status === 'completed').reduce((acc, p) => acc + Number(p.amount), 0).toFixed(2)}</span>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-[#e3e6ec] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#f8f9fc] hover:bg-[#f8f9fc]">
              <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Agent</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6">Amount</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6">Method</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6">Status</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6">Requested</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-[#69707a] text-center px-6">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-20"><div className="w-6 h-6 border-2 border-[#0061f2] border-t-transparent rounded-full animate-spin mx-auto"></div></TableCell></TableRow>
            ) : filteredPayouts.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-20 text-[#69707a] italic">No payout history</TableCell></TableRow>
            ) : (
              filteredPayouts.map((p) => (
                <TableRow key={p.id} className="border-b border-[#f2f4f8] hover:bg-[#f8f9fc]/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[#0061f2] font-black text-[10px] border border-blue-100 uppercase">
                        {p.profiles?.username?.substring(0, 2)}
                      </div>
                      <span className="font-bold text-[#2b3a4a]">{p.profiles?.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-black text-[#e81500] text-sm tracking-tight">${Number(p.amount).toFixed(2)}</td>
                  <td className="px-6 py-4">
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-[#69707a] tracking-widest flex items-center gap-1">
                           <CreditCard size={10} /> {p.payment_method || 'Manual'}
                        </span>
                        <span className="text-[11px] font-medium text-[#2b3a4a] truncate max-w-[120px]">{p.account_details || 'N/A'}</span>
                     </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[9px] font-black uppercase border shadow-sm",
                      p.status === 'completed' ? "bg-green-50 text-green-600 border-green-200" : p.status === 'pending' ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-red-50 text-red-600 border-red-200"
                    )}>{p.status}</span>
                  </td>
                  <td className="px-6 py-4 text-[11px] text-[#69707a] font-bold uppercase">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-center">
                    {p.status === 'pending' ? (
                      <Button onClick={() => openProcessDialog(p)} size="sm" className="bg-[#0061f2] hover:bg-[#0052ce] text-white font-black uppercase text-[10px] h-8 px-4 shadow-sm">Process</Button>
                    ) : p.transaction_id ? (
                      <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400">
                         <CheckCircle size={12} className="text-green-500" /> {p.transaction_id}
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Completed</span>
                    )}
                  </td>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isProcessOpen} onOpenChange={setIsProcessOpen}>
         <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl">
            <div className="bg-[#0061f2] px-6 py-8 text-white">
               <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight">Payout Processing</h3>
                    <p className="text-white/70 text-xs font-bold uppercase tracking-widest">Verify and send funds</p>
                  </div>
                  <DollarSign size={32} className="text-white/20" />
               </div>
               <div className="bg-white/10 p-4 rounded-xl border border-white/20">
                  <div className="flex justify-between items-center mb-1">
                     <span className="text-[10px] font-black uppercase text-white/50">Amount to Send</span>
                     <span className="text-[10px] font-black uppercase text-white/50">Agent</span>
                  </div>
                  <div className="flex justify-between items-end">
                     <span className="text-3xl font-black">${Number(selectedPayout?.amount).toFixed(2)}</span>
                     <span className="text-sm font-bold opacity-90">{selectedPayout?.profiles?.username}</span>
                  </div>
               </div>
            </div>
            <div className="p-6 space-y-4">
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                     <CreditCard size={12} /> Payment Destination
                  </Label>
                  <p className="text-sm font-bold text-slate-800 bg-white p-2 rounded border border-slate-100 shadow-sm">{selectedPayout?.account_details || 'Manual Adjustment Required'}</p>
               </div>
               
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Transaction ID / Reference</Label>
                  <Input 
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="Enter bKash/Nagad/Bank TRX ID..." 
                    className="h-12 bg-slate-50 border-slate-200 focus:ring-[#0061f2] rounded-xl font-bold"
                  />
               </div>

               <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button onClick={() => handleStatusChange(selectedPayout.id, 'rejected')} variant="outline" className="h-12 font-black uppercase text-xs border-slate-200 text-red-600 hover:bg-red-50 rounded-xl">Reject</Button>
                  <Button onClick={() => handleStatusChange(selectedPayout.id, 'completed', transactionId)} className="h-12 bg-[#0061f2] hover:bg-[#0052ce] text-white font-black uppercase text-xs rounded-xl shadow-lg shadow-blue-100">
                     Confirm Sent <Send size={14} className="ml-2" />
                  </Button>
               </div>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
}

