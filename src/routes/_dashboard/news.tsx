import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Newspaper, Calendar, Bell, Plus, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_dashboard/news")({
  component: NewsPage,
});

function NewsPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: newsItems, isLoading } = useQuery({
    queryKey: ['news'],
    queryFn: async () => {
       // Assuming we might have a news table, otherwise fall back to static
       // For now let's keep it robust
       return [
        {
          title: "New SMS Ranges Added: Vietnam & Thailand",
          date: "June 05, 2026",
          content: "We have expanded our coverage with high-payout ranges in Southeast Asia. Check the RateCard for updated pricing.",
          category: "Network Update"
        },
        {
          title: "Scheduled Maintenance Notification",
          date: "June 03, 2026",
          content: "The dashboard will be offline for 15 minutes on June 10th at 02:00 UTC for system upgrades.",
          category: "System"
        },
        {
          title: "Increased Payouts for UK Mobile Ranges",
          date: "June 01, 2026",
          content: "Good news! UK mobile ranges payouts have been increased by 10%. This is effective immediately.",
          category: "Billing"
        }
      ];
    }
  });

  const filteredNews = newsItems?.filter(n => 
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    n.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[#f8f9fc] p-6 rounded-2xl border border-[#e3e6ec] shadow-sm gap-4">
        <div className="flex items-center gap-4">
           <div className="bg-[#0061f2] p-3 rounded-xl shadow-lg shadow-blue-100">
              <Bell className="text-white" size={24} />
           </div>
           <div>
              <h1 className="text-2xl font-black text-[#2b3a4a] tracking-tighter uppercase">IMS News Feed</h1>
              <p className="text-[#69707a] text-[11px] font-black uppercase tracking-widest mt-1 opacity-70">Announcements & Updates</p>
           </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
           <div className="relative flex-1 md:w-64">
              <Input 
                placeholder="Search news..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 rounded-xl bg-white border-[#e3e6ec] shadow-sm text-xs font-bold"
              />
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a7aeb8]" />
           </div>
           <Button variant="outline" className="h-11 border-[#0061f2] text-[#0061f2] font-black uppercase text-[10px] px-6 rounded-xl hover:bg-blue-50 shadow-sm transition-all">
              <Plus size={16} className="mr-2" /> Post News
           </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {filteredNews?.map((news, idx) => (
          <Card key={idx} className="bg-white border-[#e3e6ec] rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 group border-none shadow-md">
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row items-stretch">
                <div className="w-full md:w-2 bg-[#0061f2] shrink-0" />
                <div className="p-8 flex-1 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                       <span className="px-3 py-1 bg-blue-50 text-[#0061f2] text-[9px] font-black rounded-full uppercase tracking-widest border border-blue-100 shadow-sm">
                        {news.category}
                      </span>
                      {idx === 0 && (
                        <span className="px-3 py-1 bg-[#e81500] text-white text-[9px] font-black rounded-full uppercase tracking-widest animate-pulse">
                          Latest
                        </span>
                      )}
                    </div>
                    <div className="flex items-center text-[#69707a] text-[11px] font-black uppercase tracking-tighter opacity-60">
                      <Calendar size={14} className="mr-2" />
                      {news.date}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-black text-[#2b3a4a] uppercase tracking-tight group-hover:text-[#0061f2] transition-colors">{news.title}</h3>
                    <p className="text-[#4d5875] text-[13px] font-medium leading-relaxed mt-3">{news.content}</p>
                  </div>

                  <div className="pt-4 flex justify-end">
                     <Button variant="ghost" className="text-[#0061f2] font-black uppercase text-[10px] hover:bg-blue-50">
                        Read Full Release
                     </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
