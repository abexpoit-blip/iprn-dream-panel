import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Ban, Plus, Trash2, ShieldAlert } from "lucide-react";

export function BannedWatchTab() {
  const [keywords, setKeywords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");
  const [newReason, setNewReason] = useState("");

  const fetchKeywords = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('banned_keywords').select('*').order('created_at', { ascending: false });
      setKeywords(data || []);
    } catch (err) {
      console.error("Fetch keywords error:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchKeywords();
  }, []);

  const handleAddKeyword = async () => {
    if (!newKeyword) return;
    const { error } = await supabase.from('banned_keywords').insert([{ keyword: newKeyword, reason: newReason }]);
    if (error) toast.error("Keyword already exists or failed to add");
    else {
      toast.success("Keyword added to watch list");
      setNewKeyword("");
      setNewReason("");
      fetchKeywords();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('banned_keywords').delete().eq('id', id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Keyword removed");
      fetchKeywords();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#f8f9fc] p-6 rounded-xl border border-[#e3e6ec] space-y-4">
        <h3 className="font-black text-[#2b3a4a] uppercase text-[11px] tracking-widest flex items-center gap-2">
           <ShieldAlert size={16} className="text-[#e81500]" /> Add Restricted Content
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <Input 
             placeholder="Enter keyword or number..." 
             value={newKeyword} 
             onChange={(e) => setNewKeyword(e.target.value)}
             className="rounded-lg h-10 border-[#e3e6ec] bg-white shadow-sm"
           />
           <div className="flex gap-2">
              <Input 
                placeholder="Reason (optional)..." 
                value={newReason} 
                onChange={(e) => setNewReason(e.target.value)}
                className="rounded-lg h-10 border-[#e3e6ec] bg-white shadow-sm"
              />
              <Button onClick={handleAddKeyword} className="bg-[#e81500] hover:bg-red-700 text-white font-black text-[10px] uppercase h-10 px-6">Add to Watch</Button>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-[#e3e6ec] overflow-hidden">
         <Table>
            <TableHeader><TableRow className="bg-[#f8f9fc]">
               <TableHead className="text-[10px] font-black uppercase px-6">Keyword / Content</TableHead>
               <TableHead className="text-[10px] font-black uppercase px-6">Reason</TableHead>
               <TableHead className="text-[10px] font-black uppercase px-6 text-center">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
               {loading ? (
                 <TableRow><TableCell colSpan={3} className="text-center py-20"><div className="w-6 h-6 border-2 border-[#e81500] border-t-transparent rounded-full animate-spin mx-auto"></div></TableCell></TableRow>
               ) : keywords.length === 0 ? (
                 <TableRow><TableCell colSpan={3} className="text-center py-20 text-[#69707a] italic">No keywords in watch list</TableCell></TableRow>
               ) : (
                 keywords.map(k => (
                   <TableRow key={k.id} className="border-b border-[#f2f4f8]">
                      <td className="px-6 py-4 font-black text-[#e81500] text-[13px]">{k.keyword}</td>
                      <td className="px-6 py-4 text-[12px] text-[#69707a] font-medium">{k.reason || '-'}</td>
                      <td className="px-6 py-4 text-center">
                         <Button onClick={() => handleDelete(k.id)} variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50">
                            <Trash2 size={14} />
                         </Button>
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
