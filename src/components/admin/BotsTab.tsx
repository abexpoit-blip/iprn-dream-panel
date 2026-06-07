import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Bot, Plus, Trash2, Settings, Terminal, RefreshCw, Activity, ShieldCheck, Layout, CheckSquare, Square, MoreHorizontal, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function BotsTab() {
  const [bots, setBots] = useState<any[]>([]);
  const [panels, setPanels] = useState<any[]>([]);
  const [numbers, setNumbers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [isAddBotOpen, setIsAddBotOpen] = useState(false);
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [isAddNumberOpen, setIsAddNumberOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedBot, setSelectedBot] = useState<any>(null);
  const [botSettings, setBotSettings] = useState<any[]>([]);

  const [newBot, setNewBot] = useState({ name: "", bot_type: "shark" });
  const [newPanel, setNewPanel] = useState({ name: "", panel_url: "", username: "", password: "" });
  const [newNumber, setNewNumber] = useState({ number: "", service_tag: "", bot_id: "", number_panel_id: "" });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [botsData, panelsData, numbersData, logsData] = await Promise.all([
        supabase.from('bots').select('*'),
        supabase.from('number_panels').select('*'),
        supabase.from('number_pool').select('*'),
        supabase.from('otp_audit_log').select('*').limit(20).order('created_at', { ascending: false })
      ]);
      
      setBots(botsData.data || []);
      setPanels(panelsData.data || []);
      setNumbers(numbersData.data || []);
      setAuditLogs(logsData.data || []);
    } catch (err) {
      console.error("Fetch data error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddBot = async () => {
    const { error } = await supabase.from('bots').insert([newBot]);
    if (error) toast.error("Failed to add bot");
    else {
      toast.success("Bot registered");
      setIsAddBotOpen(false);
      fetchData();
    }
  };

  const handleAddPanel = async () => {
    const { error } = await supabase.from('number_panels').insert([newPanel]);
    if (error) toast.error("Failed to add panel");
    else {
      toast.success("Number panel registered");
      setIsAddPanelOpen(false);
      fetchData();
    }
  };

  const handleAddNumber = async () => {
    const { error } = await supabase.from('number_pool').insert([{
        ...newNumber,
        status: 'available'
    }]);
    if (error) toast.error("Failed to add number");
    else {
      toast.success("Number added to pool");
      setIsAddNumberOpen(false);
      fetchData();
    }
  };

  const openSettings = async (bot: any) => {
    setSelectedBot(bot);
    setIsSettingsOpen(true);
    const { data } = await supabase.from('bot_settings').select('*').eq('bot_id', bot.id);
    setBotSettings(data || []);
  };

  const updateBotSetting = async (key: string, value: string) => {
    const { error } = await supabase.from('bot_settings').upsert({
      bot_id: selectedBot.id,
      setting_key: key,
      setting_value: value
    }, { onConflict: 'bot_id,setting_key' });

    if (error) toast.error("Failed to update setting");
    else toast.success(`Setting ${key} updated`);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const toggleAutomation = async (type: 'bot' | 'panel', id: string, field: string, value: boolean) => {
    const table = type === 'bot' ? 'bots' : 'number_panels';
    try {
      // Use type assertion to avoid strict literal index signature errors
      const { error } = await supabase.from(table as any).update({ [field]: value } as any).eq('id', id);
      if (error) throw error;
      toast.success("Automation setting updated");
      fetchData();
    } catch (err: any) {
      console.error("Update error:", err);
      toast.error(err.message || "Failed to update automation");
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedNumbers.length === 0) return;
    
    let updateData = {};
    if (action === 'delete') {
      const { error } = await supabase.from('number_pool').delete().in('id', selectedNumbers);
      if (error) toast.error("Bulk delete failed");
      else toast.success(`Deleted ${selectedNumbers.length} numbers`);
    } else {
      if (action === 'release') updateData = { status: 'available', reserved_for: null, reserved_at: null };
      else if (action === 'expire') updateData = { status: 'expired' };
      
      const { error } = await supabase.from('number_pool').update(updateData).in('id', selectedNumbers);
      if (error) toast.error("Bulk update failed");
      else toast.success(`Updated ${selectedNumbers.length} numbers`);
    }
    
    setSelectedNumbers([]);
    fetchData();
  };

  const toggleNumberSelection = (id: string) => {
    setSelectedNumbers(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="status" className="w-full">
        <TabsList className="bg-slate-100 p-1 mb-4 h-11">
          <TabsTrigger value="status" className="text-[11px] font-black uppercase">Bot Status</TabsTrigger>
          <TabsTrigger value="panels" className="text-[11px] font-black uppercase">Number Panels</TabsTrigger>
          <TabsTrigger value="pool" className="text-[11px] font-black uppercase">Number Pool</TabsTrigger>
          <TabsTrigger value="audit" className="text-[11px] font-black uppercase">Live OTP Audit</TabsTrigger>
          <TabsTrigger value="config" className="text-[11px] font-black uppercase">Bot Config</TabsTrigger>
        </TabsList>

        <TabsContent value="status">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-[#2b3a4a] uppercase text-xs tracking-widest flex items-center gap-2">
              <Bot size={16} className="text-[#0061f2]" /> Scraper Automations
            </h3>
            <Button onClick={() => setIsAddBotOpen(true)} size="sm" className="bg-[#0061f2] text-white font-bold text-[10px] uppercase h-8"><Plus size={14} className="mr-1" /> New Bot</Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map(bot => (
              <div key={bot.id} className="bg-white rounded-xl shadow-lg border border-[#e3e6ec] p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-black text-[#2b3a4a] text-sm uppercase tracking-tight">{bot.name}</h4>
                    <p className="text-[10px] text-[#69707a] font-bold uppercase">{bot.bot_type} Worker</p>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-black uppercase",
                    bot.status === 'online' ? "bg-green-100 text-green-600 border border-green-200" : "bg-slate-100 text-slate-500 border border-slate-200"
                  )}>{bot.status}</span>
                </div>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase text-[#69707a]">
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">Last Seen: <span className="text-[#2b3a4a] block">{bot.last_seen ? new Date(bot.last_seen).toLocaleTimeString() : 'Never'}</span></div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">Status: <span className="text-[#2b3a4a] block">{bot.status}</span></div>
                  </div>
                  
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[9px] font-black uppercase text-slate-500">Auto Re-login</span>
                    <Checkbox 
                      checked={bot.auto_relogin} 
                      onCheckedChange={(checked) => toggleAutomation('bot', bot.id, 'auto_relogin', !!checked)}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button onClick={() => openSettings(bot)} variant="outline" size="sm" className="flex-1 h-8 text-[10px] font-black uppercase border-slate-200 hover:bg-slate-50">
                    <Settings size={14} className="mr-1" /> Config
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase border-slate-200 text-blue-600 hover:bg-blue-50">
                    <RefreshCw size={14} className="mr-1" /> Force Login
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="config">
           <div className="bg-white rounded-xl shadow-lg border border-[#e3e6ec] p-6">
              <h3 className="font-black text-[#2b3a4a] uppercase text-xs tracking-widest mb-6 flex items-center gap-2">
                 <Settings size={16} className="text-[#0061f2]" /> Global Scraper Configuration
              </h3>
              
              <Tabs defaultValue="shark" className="w-full">
                <TabsList className="bg-slate-50 mb-6">
                  <TabsTrigger value="shark" className="text-[10px] font-black uppercase">Shark SMS</TabsTrigger>
                  <TabsTrigger value="ims" className="text-[10px] font-black uppercase">IMS SMS</TabsTrigger>
                  <TabsTrigger value="hadi" className="text-[10px] font-black uppercase">SMS Hadi</TabsTrigger>
                </TabsList>

                <TabsContent value="shark" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div>
                          <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Shark SMS Bot Credentials</Label>
                          <div className="mt-4 space-y-4">
                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase">Username</Label>
                                <Input defaultValue="mamun01" className="h-10 rounded-lg" onChange={(e) => updateBotSetting('shark_username', e.target.value)} />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase">Password</Label>
                                <Input type="password" defaultValue="mamun@12#A" className="h-10 rounded-lg" onChange={(e) => updateBotSetting('shark_password', e.target.value)} />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase">Cookie Data (JSON)</Label>
                                <Input placeholder='{"session": "..."}' className="h-10 rounded-lg" onChange={(e) => updateBotSetting('shark_cookies', e.target.value)} />
                              </div>
                          </div>
                        </div>

                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-3">
                          <h4 className="text-[11px] font-black uppercase text-blue-600">Session Controls</h4>
                          <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold">Cookie Persistence</span>
                              <Checkbox checked onCheckedChange={(checked) => updateBotSetting('shark_cookie_persistence', String(checked))} />
                          </div>
                          <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold">Auto-Refresh (15s)</span>
                              <Checkbox checked onCheckedChange={(checked) => updateBotSetting('shark_auto_refresh', String(checked))} />
                          </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                          <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Delivery Safeguards</Label>
                          <div className="mt-4 space-y-4">
                              <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <p className="text-[10px] font-black uppercase">Association Check</p>
                                    <p className="text-[9px] text-slate-500 italic">Verify number pool ownership before delivery</p>
                                </div>
                                <Checkbox checked onCheckedChange={(checked) => updateBotSetting('shark_association_check', String(checked))} />
                              </div>
                              <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <p className="text-[10px] font-black uppercase">Source Validation</p>
                                    <p className="text-[9px] text-slate-500 italic">Block duplicate source message IDs</p>
                                </div>
                                <Checkbox checked onCheckedChange={(checked) => updateBotSetting('shark_source_validation', String(checked))} />
                              </div>
                          </div>
                        </div>
                        
                        <Button onClick={() => toast.success("Shark configuration saved locally")} className="w-full bg-[#0061f2] h-12 text-[11px] font-black uppercase rounded-xl shadow-lg">Save Shark Config</Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="ims" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">IMS SMS Agent Login</Label>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase">User</Label>
                          <Input defaultValue="mamun99" className="h-10 rounded-lg" onChange={(e) => updateBotSetting('ims_username', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase">Pass</Label>
                          <Input type="password" defaultValue="mamun@12aa#" className="h-10 rounded-lg" onChange={(e) => updateBotSetting('ims_password', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase">Cookies</Label>
                          <Input placeholder="Enter login cookies..." className="h-10 rounded-lg" onChange={(e) => updateBotSetting('ims_cookies', e.target.value)} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button onClick={() => toast.success("IMS configuration saved locally")} className="w-full bg-[#0061f2] h-12 text-[11px] font-black uppercase rounded-xl shadow-lg">Save IMS Config</Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="hadi" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest">SMS Hadi Credentials</Label>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase">Username</Label>
                          <Input className="h-10 rounded-lg" onChange={(e) => updateBotSetting('hadi_username', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase">Password</Label>
                          <Input type="password" placeholder="Hadi Password..." className="h-10 rounded-lg" onChange={(e) => updateBotSetting('hadi_password', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase">Cookies</Label>
                          <Input placeholder="Enter login cookies..." className="h-10 rounded-lg" onChange={(e) => updateBotSetting('hadi_cookies', e.target.value)} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button onClick={() => toast.success("Hadi configuration saved locally")} className="w-full bg-[#0061f2] h-12 text-[11px] font-black uppercase rounded-xl shadow-lg">Save Hadi Config</Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
           </div>
        </TabsContent>

        <TabsContent value="panels">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-[#2b3a4a] uppercase text-xs tracking-widest flex items-center gap-2">
              <Layout size={16} className="text-[#0061f2]" /> Number Panel Automation
            </h3>
            <Button onClick={() => setIsAddPanelOpen(true)} size="sm" className="bg-[#0061f2] text-white font-bold text-[10px] uppercase h-8"><Plus size={14} className="mr-1" /> New Panel</Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {panels.map(panel => (
              <div key={panel.id} className="bg-white rounded-xl shadow-lg border border-[#e3e6ec] p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-black text-[#2b3a4a] text-sm uppercase tracking-tight">{panel.name}</h4>
                    <p className="text-[10px] text-[#69707a] font-bold uppercase truncate max-w-[150px]">{panel.panel_url}</p>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-black uppercase",
                    panel.status === 'online' ? "bg-green-100 text-green-600 border border-green-200" : "bg-slate-100 text-slate-500 border border-slate-200"
                  )}>{panel.status}</span>
                </div>
                
                <div className="space-y-3">
                   <div className="bg-slate-50 p-2 rounded border border-slate-100 text-[10px] font-bold uppercase text-[#69707a]">
                      User: <span className="text-[#2b3a4a] ml-1">{panel.username}</span>
                   </div>
                   <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[9px] font-black uppercase text-slate-500">Keep Alive</span>
                    <Checkbox 
                      checked={panel.session_keep_alive} 
                      onCheckedChange={(checked) => toggleAutomation('panel', panel.id, 'session_keep_alive', !!checked)}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-[10px] font-black uppercase border-slate-200 text-blue-600 hover:bg-blue-50">
                    <RefreshCw size={14} className="mr-1" /> Test Login
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pool">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-black text-[#2b3a4a] uppercase text-xs tracking-widest flex items-center gap-2">
                <Terminal size={16} className="text-[#0061f2]" /> Number Inventory
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Available: {numbers.filter(n => n.status === 'available').length} | Reserved: {numbers.filter(n => n.status === 'reserved').length}</p>
            </div>
            <div className="flex gap-2">
              {selectedNumbers.length > 0 && (
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 mr-2">
                   <span className="text-[10px] font-black uppercase text-slate-600">{selectedNumbers.length} Selected</span>
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                         <Button size="sm" variant="ghost" className="h-6 w-6 p-0"><MoreHorizontal size={14} /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                         <DropdownMenuItem onClick={() => handleBulkAction('release')} className="text-xs font-bold uppercase">Release to Pool</DropdownMenuItem>
                         <DropdownMenuItem onClick={() => handleBulkAction('expire')} className="text-xs font-bold uppercase">Mark Expired</DropdownMenuItem>
                         <DropdownMenuItem onClick={() => handleBulkAction('delete')} className="text-xs font-bold uppercase text-red-600">Bulk Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                   </DropdownMenu>
                </div>
              )}
              <Button onClick={() => setIsAddNumberOpen(true)} size="sm" className="bg-[#0061f2] text-white font-bold text-[10px] uppercase h-8"><Plus size={14} className="mr-1" /> New Number</Button>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg border border-[#e3e6ec] overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-[#f8f9fc]">
                <TableHead className="w-12 px-6"><Checkbox checked={selectedNumbers.length === numbers.length && numbers.length > 0} onCheckedChange={(checked) => setSelectedNumbers(checked ? numbers.map(n => n.id) : [])} /></TableHead>
                <TableHead className="text-[10px] font-black uppercase px-6">Number</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-6">Service</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-6">Assignment</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-6">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-6 text-center">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {numbers.map(n => (
                  <TableRow key={n.id} className={cn("border-b border-[#f2f4f8]", selectedNumbers.includes(n.id) && "bg-blue-50/50")}>
                    <td className="px-6 py-3"><Checkbox checked={selectedNumbers.includes(n.id)} onCheckedChange={() => toggleNumberSelection(n.id)} /></td>
                    <td className="px-6 py-3 font-black text-[#2b3a4a] text-[13px]">{n.number}</td>
                    <td className="px-6 py-3 text-[11px] font-bold text-[#69707a] uppercase">{n.service_tag || 'Global'}</td>
                    <td className="px-6 py-3 text-[11px] font-medium text-[#69707a]">
                       {n.status === 'reserved' ? (
                          <div className="flex flex-col">
                             <span className="text-[9px] font-black text-[#0061f2] uppercase">Reserved</span>
                             <span className="opacity-50 text-[9px]">Since: {n.reserved_at ? new Date(n.reserved_at).toLocaleTimeString() : 'N/A'}</span>
                          </div>
                       ) : (
                          'Unassigned'
                       )}
                    </td>
                    <td className="px-6 py-3">
                       <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-black uppercase border shadow-sm",
                          n.status === 'available' ? "bg-green-50 text-green-600 border-green-200" :
                          n.status === 'reserved' ? "bg-amber-50 text-amber-600 border-amber-200" :
                          "bg-slate-50 text-slate-600 border-slate-200"
                       )}>{n.status}</span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <Button onClick={async () => {
                         const { error } = await supabase.from('number_pool').delete().eq('id', n.id);
                         if (error) toast.error("Delete failed");
                         else { toast.success("Number removed"); fetchData(); }
                      }} variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50">
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="audit">
           <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-[#2b3a4a] uppercase text-xs tracking-widest flex items-center gap-2">
              <Activity size={16} className="text-[#e81500]" /> OTP Ingest Stream
            </h3>
            <div className="flex gap-2">
              <Button onClick={() => window.open('/health', '_blank')} variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase border-slate-200">
                <Terminal size={14} className="mr-1" /> Service Health
              </Button>
              <Button onClick={fetchData} variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase border-slate-200">
                 <RefreshCw size={14} className="mr-1" /> Refresh
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-[#e3e6ec] overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-[#f8f9fc]">
                <TableHead className="text-[10px] font-black uppercase px-6">Source</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-6">Number</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-6">OTP</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-6">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase px-6">Time</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {auditLogs.map(log => (
                  <TableRow key={log.id} className="border-b border-[#f2f4f8]">
                    <td className="px-6 py-3 font-bold text-[12px] uppercase text-blue-600">{log.source}</td>
                    <td className="px-6 py-3 font-black text-[#2b3a4a] text-[13px]">{log.phone_number}</td>
                    <td className="px-6 py-3">
                       <code className="bg-slate-100 px-2 py-1 rounded font-black text-[#e81500] text-[12px]">{log.otp_code || '---'}</code>
                    </td>
                    <td className="px-6 py-3">
                       <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-black uppercase border",
                          log.outcome === 'billed' ? "bg-green-50 text-green-600 border-green-200" : "bg-red-50 text-red-600 border-red-200"
                       )}>{log.outcome}</span>
                    </td>
                    <td className="px-6 py-3 text-[11px] font-medium text-slate-400">
                       {new Date(log.created_at).toLocaleTimeString()}
                    </td>
                  </TableRow>
                ))}
                {auditLogs.length === 0 && (
                   <TableRow><TableCell colSpan={5} className="text-center py-20 text-[#69707a] italic">No OTP logs yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden rounded-2xl border-slate-200">
           <div className="bg-[#f8f9fc] px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-black text-[#2b3a4a] text-xs uppercase tracking-widest flex items-center gap-2">
                 <Settings size={16} className="text-[#0061f2]" /> Bot Configuration: {selectedBot?.name}
              </h3>
           </div>
           <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={14} /> Portal Credentials</h4>
                    <div className="space-y-3">
                       <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-600">Portal URL</Label>
                          <Input 
                            defaultValue={botSettings.find(s => s.setting_key === 'portal_url')?.setting_value || ''} 
                            onBlur={(e) => updateBotSetting('portal_url', e.target.value)}
                            placeholder="https://imssms.org/login" className="h-9 text-xs" 
                          />
                       </div>
                       <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-600">Username</Label>
                          <Input 
                            defaultValue={botSettings.find(s => s.setting_key === 'username')?.setting_value || ''} 
                            onBlur={(e) => updateBotSetting('username', e.target.value)}
                            className="h-9 text-xs" 
                          />
                       </div>
                       <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-600">Password</Label>
                          <Input 
                            type="password"
                            defaultValue={botSettings.find(s => s.setting_key === 'password')?.setting_value || ''} 
                            onBlur={(e) => updateBotSetting('password', e.target.value)}
                            className="h-9 text-xs" 
                          />
                       </div>
                    </div>
                 </div>
                 <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Terminal size={14} /> Polling Behavior</h4>
                    <div className="space-y-3">
                       <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-600">Interval (Seconds)</Label>
                          <Input 
                            type="number"
                            defaultValue={botSettings.find(s => s.setting_key === 'interval')?.setting_value || '15'} 
                            onBlur={(e) => updateBotSetting('interval', e.target.value)}
                            className="h-9 text-xs" 
                          />
                       </div>
                       <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-600">Cookie Override</Label>
                          <Input 
                            placeholder="Optional PHPSESSID"
                            defaultValue={botSettings.find(s => s.setting_key === 'cookie_override')?.setting_value || ''} 
                            onBlur={(e) => updateBotSetting('cookie_override', e.target.value)}
                            className="h-9 text-xs" 
                          />
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </DialogContent>
      </Dialog>

      {/* Add Bot Dialog */}
      <Dialog open={isAddBotOpen} onOpenChange={setIsAddBotOpen}>
        <DialogContent className="sm:max-w-md p-6">
           <DialogHeader><DialogTitle className="font-black uppercase text-sm tracking-widest">Register New Worker</DialogTitle></DialogHeader>
           <div className="space-y-4 mt-4">
              <div className="space-y-2">
                 <Label className="text-[11px] font-black uppercase text-slate-500">Worker Label</Label>
                 <Input value={newBot.name} onChange={(e) => setNewBot({...newBot, name: e.target.value})} placeholder="e.g. IMS_MAIN_01" className="h-10" />
              </div>
              <div className="space-y-2">
                 <Label className="text-[11px] font-black uppercase text-slate-500">Platform</Label>
                 <select className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm" value={newBot.bot_type} onChange={(e) => setNewBot({...newBot, bot_type: e.target.value})}>
                    <option value="ims">IMS SMS (imssms.org)</option>
                    <option value="smshadi">SMS Hadi (2.59.169.96)</option>
                    <option value="shark">Shark SMS (65.109.111.158)</option>
                 </select>
              </div>
              <Button onClick={handleAddBot} className="w-full bg-[#0061f2] h-10 font-black uppercase text-xs">Register Worker</Button>
           </div>
        </DialogContent>
      </Dialog>

      {/* Add Panel Dialog */}
      <Dialog open={isAddPanelOpen} onOpenChange={setIsAddPanelOpen}>
        <DialogContent className="sm:max-w-md p-6">
           <DialogHeader><DialogTitle className="font-black uppercase text-sm tracking-widest">Register Number Panel</DialogTitle></DialogHeader>
           <div className="space-y-4 mt-4">
              <div className="space-y-2">
                 <Label className="text-[11px] font-black uppercase text-slate-500">Panel Name</Label>
                 <Input value={newPanel.name} onChange={(e) => setNewPanel({...newPanel, name: e.target.value})} placeholder="e.g. Panel One" className="h-10" />
              </div>
              <div className="space-y-2">
                 <Label className="text-[11px] font-black uppercase text-slate-500">Login URL</Label>
                 <Input value={newPanel.panel_url} onChange={(e) => setNewPanel({...newPanel, panel_url: e.target.value})} placeholder="http://..." className="h-10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase text-slate-500">Username</Label>
                    <Input value={newPanel.username} onChange={(e) => setNewPanel({...newPanel, username: e.target.value})} className="h-10" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase text-slate-500">Password</Label>
                    <Input type="password" value={newPanel.password} onChange={(e) => setNewPanel({...newPanel, password: e.target.value})} className="h-10" />
                 </div>
              </div>
              <Button onClick={handleAddPanel} className="w-full bg-[#0061f2] h-10 font-black uppercase text-xs">Register Panel</Button>
           </div>
        </DialogContent>
      </Dialog>

      {/* Add Number Dialog */}
      <Dialog open={isAddNumberOpen} onOpenChange={setIsAddNumberOpen}>
        <DialogContent className="sm:max-w-md p-6">
           <DialogHeader><DialogTitle className="font-black uppercase text-sm tracking-widest">Add to Number Pool</DialogTitle></DialogHeader>
           <div className="space-y-4 mt-4">
              <div className="space-y-2">
                 <Label className="text-[11px] font-black uppercase text-slate-500">Phone Number</Label>
                 <Input value={newNumber.number} onChange={(e) => setNewNumber({...newNumber, number: e.target.value})} placeholder="e.g. +88017..." className="h-10" />
              </div>
              <div className="space-y-2">
                 <Label className="text-[11px] font-black uppercase text-slate-500">Service Tag</Label>
                 <Input value={newNumber.service_tag} onChange={(e) => setNewNumber({...newNumber, service_tag: e.target.value})} placeholder="e.g. Facebook" className="h-10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase text-slate-500">Source Panel</Label>
                    <select className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm" value={newNumber.number_panel_id} onChange={(e) => setNewNumber({...newNumber, number_panel_id: e.target.value})}>
                       <option value="">Direct Entry</option>
                       {panels.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase text-slate-500">Assign Worker</Label>
                    <select className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm" value={newNumber.bot_id} onChange={(e) => setNewNumber({...newNumber, bot_id: e.target.value})}>
                       <option value="">Manual Pool</option>
                       {bots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                 </div>
              </div>
              <Button onClick={handleAddNumber} className="w-full bg-[#0061f2] h-10 font-black uppercase text-xs">Add Number</Button>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}



