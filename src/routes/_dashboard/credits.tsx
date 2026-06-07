import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getEffectiveUserId } from "@/lib/auth-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DollarSign, Send, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_dashboard/credits")({
  component: CreditsPage,
});

function CreditsPage() {
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ['agent_profile'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      return data;
    }
  });

  const { data: payouts, refetch: refetchPayouts } = useQuery({
    queryKey: ['agent_payouts'],
    queryFn: async () => {
      const { data } = await supabase.from('payouts').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const handleRequestPayout = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !profile) return;
    const userId = session.user.id;

    if (Number(profile.balance || 0) < 100) {
      toast.error("Minimum payout is $100.00");
      return;
    }

    const { error } = await supabase.from('payouts').insert([{
      agent_id: userId,
      amount: Number(profile.balance || 0),
      status: 'pending'
    }]);

    if (error) toast.error("Request failed");
    else {
      toast.success("Payout request submitted");
      refetchPayouts();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-[#2b3a4a] tracking-tighter uppercase">Financial Center</h1>
        <p className="text-[#69707a] text-[13px] font-medium mt-1">Manage your balance and payout requests</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#0061f2] text-white border-none shadow-xl rounded-2xl overflow-hidden relative group">
          <CardContent className="p-6">
            <p className="text-[10px] font-black opacity-70 tracking-widest uppercase mb-1">Available Balance</p>
            <div className="flex items-baseline gap-1">
              <h3 className="text-4xl font-black">${Number(profile?.balance || 0).toFixed(2)}</h3>
            </div>
            <p className="text-[11px] mt-4 opacity-80 font-medium">Ready for withdrawal (Min $100)</p>
            <DollarSign className="absolute right-4 top-6 opacity-10 group-hover:scale-110 transition-transform duration-500" size={48} />
          </CardContent>
        </Card>

        <Card className="bg-white border-[#e3e6ec] shadow-md rounded-2xl overflow-hidden">
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <Button 
              onClick={handleRequestPayout}
              disabled={Number(profile?.balance || 0) < 100}
              className="w-full h-14 bg-[#00ac69] hover:bg-[#008e56] text-white font-black text-[13px] uppercase tracking-wider rounded-xl shadow-lg shadow-green-100 transition-all hover:-translate-y-0.5"
            >
              <Send size={18} className="mr-2" /> Request Payout Now
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#f8f9fc] border-[#e3e6ec] border-dashed shadow-none rounded-2xl">
           <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-white rounded-xl shadow-sm border border-[#e3e6ec]">
                 <Clock size={24} className="text-[#69707a]" />
              </div>
              <div>
                 <p className="text-[10px] font-black text-[#69707a] uppercase tracking-wider">Last Payout</p>
                 <p className="text-[14px] font-bold text-[#2b3a4a]">{profile?.last_payout_at ? new Date(profile.last_payout_at).toLocaleDateString() : 'No payouts yet'}</p>
              </div>
           </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc]">
          <h3 className="font-black text-[#69707a] uppercase text-[11px] tracking-widest">Payout History</h3>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f8f9fc]">
                <TableHead className="text-[10px] font-black uppercase px-6">Amount</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-6">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-6">Requested On</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-6">Payment Info</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts?.map((p: any) => (
                <TableRow key={p.id} className="border-b border-[#f2f4f8]">
                  <td className="px-6 py-4 font-black text-[#2b3a4a]">${Number(p.amount).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider uppercase flex items-center gap-1 w-fit",
                      p.status === 'completed' ? "bg-green-100 text-green-700" : p.status === 'pending' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                    )}>
                      {p.status === 'completed' ? <CheckCircle2 size={12} /> : p.status === 'pending' ? <Clock size={12} /> : <AlertCircle size={12} />}
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[12px] font-medium text-[#69707a]">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-[12px] font-bold text-[#2b3a4a]">{p.payment_method} - {p.transaction_id || 'Processing...'}</td>
                </TableRow>
              ))}
              {(!payouts || payouts.length === 0) && (
                <TableRow><TableCell colSpan={4} className="text-center py-20 text-[#69707a] italic">No payout history found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
