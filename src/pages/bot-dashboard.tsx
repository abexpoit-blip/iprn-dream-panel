import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bot, RefreshCw, Settings, ShieldCheck, Activity, Plus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function BotDashboard() {
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchBots = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const { data, error } = await supabase.from('bots').select('*');
    if (error) {
      console.error("Failed to load bots:", error);
    } else {
      setBots(data || []);
    }
    if (showLoading) setLoading(false);
  };

  useEffect(() => {
    fetchBots();
    
    const interval = setInterval(() => {
      fetchBots(false);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-[#e3e6ec] shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-[#0061f2] p-3 rounded-xl shadow-lg shadow-blue-100">
            <Bot className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#2b3a4a] tracking-tighter uppercase">Bot Command Center</h1>
            <p className="text-[#69707a] text-[11px] font-black uppercase tracking-widest mt-1 opacity-70">Shark / IMS / Hadi Management</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => fetchBots()} variant="outline" className="h-11 border-blue-200 text-[#0061f2] font-black uppercase text-[11px] px-6 rounded-xl hover:bg-blue-50 shadow-sm transition-all group">
            <RefreshCw size={16} className={cn("mr-2", loading && "animate-spin")} /> {loading ? "Refreshing..." : "Refresh Status"}
          </Button>
          <Button onClick={() => navigate({ to: "/admin" })} variant="outline" className="h-11 border-slate-200 text-slate-600 font-black uppercase text-[11px] px-6 rounded-xl hover:bg-white shadow-sm transition-all group">
            <Settings size={16} className="mr-2" /> Admin Logistics
          </Button>
        </div>
      </div>

      {loading && bots.length === 0 ? (
        <div className="text-center py-20 flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#0061f2] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[#69707a] font-black uppercase text-[11px] tracking-widest">Waking up worker nodes...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bots.map(bot => (
            <Card key={bot.id} className="bg-white rounded-2xl shadow-xl border border-[#e3e6ec] p-6 space-y-6 hover:shadow-2xl transition-all duration-300 group">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-3 rounded-xl shadow-sm border transition-colors",
                    bot.status === 'online' ? "bg-green-50 border-green-100 text-green-600" : "bg-slate-50 border-slate-100 text-slate-400"
                  )}>
                    <Bot size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-[#2b3a4a] text-base uppercase tracking-tight">{bot.name}</h4>
                    <p className="text-[10px] text-[#69707a] font-bold uppercase tracking-widest mt-0.5 opacity-60">{bot.bot_type} Service</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm",
                    bot.status === 'online' ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"
                  )}>
                    {bot.status}
                  </span>
                  {bot.status === 'online' && <span className="flex h-2 w-2 rounded-full bg-green-500 animate-ping"></span>}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Last Update</span>
                  <span className="text-[11px] font-black text-[#2b3a4a]">
                    {bot.last_seen ? new Date(bot.last_seen).toLocaleTimeString() : '---'}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Work Load</span>
                  <span className="text-[11px] font-black text-[#2b3a4a]">Stable</span>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-[#f2f4f8]">
                 <div className="flex items-center justify-between text-[11px] font-bold uppercase text-[#69707a]">
                    <span>Secure Cookies</span>
                    <ShieldCheck size={14} className="text-green-500" />
                 </div>
                 <div className="flex items-center justify-between text-[11px] font-bold uppercase text-[#69707a]">
                    <span>Auto-Relogin</span>
                    <div className={cn("w-2 h-2 rounded-full", bot.auto_relogin ? "bg-blue-500" : "bg-slate-300")} />
                 </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => navigate({ to: '/admin', search: { tab: 'bots' } })}
                  variant="outline" 
                  className="flex-1 h-11 text-[11px] font-black uppercase rounded-xl border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all"
                >
                  <Settings size={16} className="mr-2" /> BOT CONFIG
                </Button>
                <Button 
                  onClick={() => toast.success(`Forcing login for ${bot.name}...`)}
                  className="h-11 px-4 bg-[#0061f2] text-white font-black rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
                >
                  <RefreshCw size={16} />
                </Button>
              </div>
            </Card>
          ))}
          {bots.length === 0 && !loading && (
            <div className="col-span-full text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
               <p className="text-[#69707a] font-bold uppercase text-[12px]">No workers registered yet</p>
               <Button onClick={() => navigate({ to: '/admin', search: { tab: 'bots' } })} variant="link" className="text-[#0061f2] font-black uppercase text-[11px] mt-2">Go to Admin Logistics</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
