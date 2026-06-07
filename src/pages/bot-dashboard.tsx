import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bot, RefreshCw, Settings, ShieldCheck, Activity, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function BotDashboard() {
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-black text-[#2b3a4a] uppercase tracking-tighter">Bot Dashboard</h1>
        <Button onClick={() => fetchBots()} variant="outline" className="h-10 text-[11px] font-black uppercase"><RefreshCw size={14} className="mr-2" /> Refresh</Button>
      </div>

      {loading ? (
        <div className="text-center py-20">Loading Dashboard...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {bots.map(bot => (
            <Card key={bot.id} className="p-5 shadow-lg border border-[#e3e6ec] space-y-4 rounded-xl">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Bot size={20} /></div>
                  <div>
                    <h4 className="font-black text-[#2b3a4a] text-sm uppercase">{bot.name}</h4>
                    <p className="text-[10px] text-[#69707a] font-bold uppercase">{bot.bot_type} Bot</p>
                  </div>
                </div>
                <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase", bot.status === 'online' ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500")}>
                  {bot.status}
                </span>
              </div>
              
              <div className="p-3 bg-slate-50 rounded-lg text-[10px] font-bold text-slate-500">
                Last Session Refresh: <span className="text-[#2b3a4a]">{bot.last_seen ? new Date(bot.last_seen).toLocaleString() : 'N/A'}</span>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 h-8 text-[10px] font-black uppercase border-slate-200">
                  <Settings size={14} className="mr-1" /> Config
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
