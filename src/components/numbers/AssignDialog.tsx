import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiUrl } from "@/lib/api-url";

type Target = { id: string; label: string; sub?: string };

interface Props {
  open: boolean;
  onClose: () => void;
  mode: 'agent' | 'client';
  numberIds: string[];
  onDone: () => void;
}

export function AssignDialog({ open, onClose, mode, numberIds, onDone }: Props) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetId, setTargetId] = useState('');
  const [markup, setMarkup] = useState('0.05');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const token = localStorage.getItem('nexus_token');
    const url = mode === 'agent'
      ? apiUrl('/allocations/agents')
      : apiUrl('/allocations/my-clients');
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((rows: any[]) => {
        const list = (rows || []).map(r => ({
          id: r.id,
          label: r.username || r.full_name || r.email || r.id,
          sub: r.email || (r.balance != null ? `Bal: ${r.balance}` : ''),
        }));
        setTargets(list);
        if (list.length && !targetId) setTargetId(list[0].id);
      })
      .catch(() => toast.error('Failed to load list'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  const submit = async () => {
    if (!targetId) return toast.error(mode === 'agent' ? 'Pick an agent' : 'Pick a client');
    setBusy(true);
    try {
      const token = localStorage.getItem('nexus_token');
      const endpoint = mode === 'agent' ? 'assign-agent' : 'assign-client';
      const body: any = { number_ids: numberIds, markup: Number(markup) || 0 };
      if (mode === 'agent') body.agent_id = targetId; else body.client_id = targetId;
      const r = await fetch(apiUrl(`/allocations/${endpoint}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Assign failed');
      toast.success(`Assigned ${data.assigned} number(s) with markup ${markup}`);
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Assign {numberIds.length} number(s) to {mode === 'agent' ? 'Agent' : 'Client'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-bold uppercase text-[#69707a] mb-1 block">
              {mode === 'agent' ? 'Select Agent' : 'Select Client'}
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full h-9 border border-[#c5ccd6] rounded px-2 text-sm"
            >
              {targets.length === 0 && <option value="">— none available —</option>}
              {targets.map((t) => (
                <option key={t.id} value={t.id}>{t.label}{t.sub ? ` · ${t.sub}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-[#69707a] mb-1 block">
              Markup (added to cost rate, per OTP)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
            />
            <p className="text-[11px] text-[#69707a] mt-1">
              {mode === 'agent'
                ? 'Agent will pay: panel rate + this markup.'
                : 'Client will pay: agent rate + this markup.'}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !targetId}>
            {busy ? 'Assigning…' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
