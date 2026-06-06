import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Bot, Plus, Trash2, Activity, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export function BotsTab() {
  const [bots, setBots] = useState<any[]>([]);
  const [numbers, setNumbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddBotOpen, setIsAddBotOpen] = useState(false);
  const [isAddNumberOpen, setIsAddNumberOpen] = useState(false);
  
  const [newBot, setNewBot] = useState({ name: "" });
  const [newNumber, setNewNumber] = useState({ number: "", payout_rate: "0.0", bot_id: "" });

  const fetchData = async () => {
    setLoading(true);
    const { data: botsData } = await supabase.from('bots').select('*');
    const { data: numbersData } = await supabase.from('number_pool').select('*, bots(name)');
    setBots(botsData || []);
    setNumbers(numbersData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddBot = async () => {
    const { error } = await supabase.from('bots').insert([newBot]);
    if (error) toast.error("Failed to add bot");
    else {
      toast.success("Bot added");
      setIsAddBotOpen(false);
      fetchData();
    }
  };

  const handleAddNumber = async () => {
    const { error } = await supabase.from('number_pool').insert([{
        ...newNumber,
        payout_rate: parseFloat(newNumber.payout_rate)
    }]);
    if (error) toast.error("Failed to add number");
    else {
      toast.success("Number added to pool");
      setIsAddNumberOpen(false);
      fetchData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Bots Management */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-[#2b3a4a] uppercase text-[12px] tracking-widest flex items-center gap-2">
              <Bot size={16} className="text-[#0061f2]" /> Active Bots
            </h3>
            <Dialog open={isAddBotOpen} onOpenChange={setIsAddBotOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-[#0061f2] text-white font-bold text-[10px] uppercase h-8"><Plus size={14} className="mr-1" /> Add Bot</Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl border-[#e3e6ec] shadow-2xl p-0 overflow-hidden sm:max-w-md">
                 <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc]">
                    <h3 className="font-black text-[#2b3a4a] uppercase text-xs tracking-widest">Register New Bot</h3>
                 </div>
                 <div className="p-6 space-y-4">
                    <div className="space-y-2">
                       <Label className="text-[11px] font-black uppercase text-[#69707a]">Bot Name / ID</Label>
                       <Input value={newBot.name} onChange={(e) => setNewBot({name: e.target.value})} placeholder="e.g. IMS_BOT_01" className="rounded-lg h-10 border-[#e3e6ec]" />
                    </div>
                    <Button onClick={handleAddBot} className="w-full bg-[#0061f2] text-white font-bold text-xs uppercase h-10">Add Bot</Button>
                 </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-[#e3e6ec] overflow-hidden">
             <Table>
                <TableHeader><TableRow className="bg-[#f8f9fc]"><TableHead className="text-[10px] font-black uppercase px-6">Name</TableHead><TableHead className="text-[10px] font-black uppercase px-6">Status</TableHead></TableRow></TableHeader>
                <TableBody>
                   {bots.map(bot => (
                     <TableRow key={bot.id} className="border-b border-[#f2f4f8]">
                        <td className="px-6 py-3 font-bold text-[#2b3a4a] text-[13px]">{bot.name}</td>
                        <td className="px-6 py-3">
                           <span className={cn(
                             "px-2 py-0.5 rounded text-[9px] font-black uppercase shadow-sm",
                             bot.status === 'online' ? "bg-green-500 text-white" : "bg-slate-400 text-white"
                           )}>{bot.status}</span>
                        </td>
                     </TableRow>
                   ))}
                </TableBody>
             </Table>
          </div>
        </div>

        {/* Number Pool Management */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-[#2b3a4a] uppercase text-[12px] tracking-widest flex items-center gap-2">
              <Database size={16} className="text-[#0061f2]" /> Number Pool
            </h3>
            <Dialog open={isAddNumberOpen} onOpenChange={setIsAddNumberOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-[#0061f2] text-white font-bold text-[10px] uppercase h-8"><Plus size={14} className="mr-1" /> Add Number</Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl border-[#e3e6ec] shadow-2xl p-0 overflow-hidden sm:max-w-md">
                 <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc]">
                    <h3 className="font-black text-[#2b3a4a] uppercase text-xs tracking-widest">Add Number to Pool</h3>
                 </div>
                 <div className="p-6 space-y-4">
                    <div className="space-y-2">
                       <Label className="text-[11px] font-black uppercase text-[#69707a]">Phone Number</Label>
                       <Input value={newNumber.number} onChange={(e) => setNewNumber({...newNumber, number: e.target.value})} placeholder="e.g. +8801700000000" className="rounded-lg h-10 border-[#e3e6ec]" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[11px] font-black uppercase text-[#69707a]">Payout Rate ($)</Label>
                       <Input type="number" step="0.001" value={newNumber.payout_rate} onChange={(e) => setNewNumber({...newNumber, payout_rate: e.target.value})} className="rounded-lg h-10 border-[#e3e6ec]" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[11px] font-black uppercase text-[#69707a]">Assign to Bot</Label>
                       <select 
                         className="w-full rounded-lg h-10 border-[#e3e6ec] bg-white text-[13px] px-3 outline-none focus:ring-1 focus:ring-[#0061f2]"
                         value={newNumber.bot_id}
                         onChange={(e) => setNewNumber({...newNumber, bot_id: e.target.value})}
                       >
                         <option value="">No Bot</option>
                         {bots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                       </select>
                    </div>
                    <Button onClick={handleAddNumber} className="w-full bg-[#0061f2] text-white font-bold text-xs uppercase h-10">Add to Pool</Button>
                 </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-[#e3e6ec] overflow-hidden">
             <Table>
                <TableHeader><TableRow className="bg-[#f8f9fc]"><TableHead className="text-[10px] font-black uppercase px-6">Number</TableHead><TableHead className="text-[10px] font-black uppercase px-6">Bot</TableHead><TableHead className="text-[10px] font-black uppercase px-6 text-center">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                   {numbers.map(n => (
                     <TableRow key={n.id} className="border-b border-[#f2f4f8]">
                        <td className="px-6 py-3 font-bold text-[#2b3a4a] text-[13px]">{n.number}</td>
                        <td className="px-6 py-3 text-[11px] font-medium text-[#69707a]">{n.bots?.name || 'Unassigned'}</td>
                        <td className="px-6 py-3 text-center">
                           <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50">
                              <Trash2 size={14} />
                           </Button>
                        </td>
                     </TableRow>
                   ))}
                </TableBody>
             </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
