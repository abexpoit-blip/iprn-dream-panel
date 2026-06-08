import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { UserPlus } from "lucide-react";
import { AssignDialog } from "@/components/numbers/AssignDialog";

export const Route = createFileRoute("/_dashboard/agent/numbers")({
  component: AgentNumbersPage,
});

function getMe() {
  try { return JSON.parse(localStorage.getItem('nexus_user') || 'null'); }
  catch { return null; }
}

function AgentNumbersPage() {
  const me = getMe();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: numbers, isLoading } = useQuery({
    queryKey: ['agent_numbers', me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('number_pool')
        .select('*')
        .eq('assigned_agent', me.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  useEffect(() => { setSelectedIds([]); }, [numbers?.length]);

  if (!me?.id) {
    return <div className="p-8 text-center text-gray-500">Please sign in.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#2b3a4a]">My Allocated Numbers</h1>
          <p className="text-sm text-[#69707a]">Assign these numbers to your clients with a markup.</p>
        </div>
        {selectedIds.length > 0 && (
          <Button
            onClick={() => setAssignOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold uppercase tracking-wider text-xs gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Assign {selectedIds.length} to Client
          </Button>
        )}
      </div>

      <AssignDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        mode="client"
        numberIds={selectedIds}
        onDone={() => {
          setSelectedIds([]);
          queryClient.invalidateQueries({ queryKey: ['agent_numbers'] });
        }}
      />

      <Card className="shadow-sm border-[#e3e6ec]">
        <CardContent className="p-6">
          <div className="border border-[#e3e6ec] rounded overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50 border-b border-[#e3e6ec]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={!!numbers?.length && numbers.every((n: any) => selectedIds.includes(n.id))}
                      onCheckedChange={(v) => setSelectedIds(v ? (numbers || []).map((n: any) => n.id) : [])}
                    />
                  </TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a]">Number</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a]">Country</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a]">Range</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a]">My Cost (Agent Rate)</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a]">Client Price</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a]">Assigned Client</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase text-[#69707a]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-gray-500 italic">Loading…</TableCell></TableRow>
                ) : !numbers?.length ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-gray-500 italic">No numbers allocated to you yet.</TableCell></TableRow>
                ) : numbers.map((n: any) => {
                  const checked = selectedIds.includes(n.id);
                  return (
                    <TableRow key={n.id} className="border-b border-[#f2f4f8] hover:bg-gray-50">
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => setSelectedIds(prev => v ? [...prev, n.id] : prev.filter(x => x !== n.id))}
                        />
                      </TableCell>
                      <TableCell className="text-xs font-bold text-[#2b3a4a]">{n.number}</TableCell>
                      <TableCell className="text-xs">{n.country || '—'}</TableCell>
                      <TableCell className="text-xs text-[#69707a]">{n.range_name || '—'}</TableCell>
                      <TableCell className="text-xs font-bold text-emerald-600">{n.agent_rate != null ? Number(n.agent_rate).toFixed(2) : '—'}</TableCell>
                      <TableCell className="text-xs font-bold text-purple-600">{n.client_rate != null ? Number(n.client_rate).toFixed(2) : '—'}</TableCell>
                      <TableCell className="text-xs">{n.assigned_client ? <span className="text-purple-700 font-bold">Assigned</span> : <span className="text-gray-400">—</span>}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "px-2 py-0.5 text-white text-[10px] font-bold rounded uppercase",
                          n.status === 'available' ? "bg-green-500" : n.status === 'reserved' ? "bg-amber-500" : "bg-slate-500"
                        )}>{n.status}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
