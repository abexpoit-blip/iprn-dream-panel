import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Newspaper, Calendar } from "lucide-react";

export const Route = createFileRoute("/_dashboard/news")({
  component: NewsPage,
});

function NewsPage() {
  const newsItems = [
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">News & Announcements</h1>
          <p className="text-[#69707a] text-[13px] font-medium mt-0.5">Stay updated with latest IMS news</p>
        </div>
      </div>

      <div className="grid gap-6">
        {newsItems.map((news, idx) => (
          <Card key={idx} className="shadow-sm border-[#e3e6ec] hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="bg-blue-50 p-3 rounded-lg text-[#0061f2]">
                  <Newspaper size={24} />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="px-2 py-0.5 bg-blue-100 text-[#0061f2] text-[10px] font-bold rounded uppercase tracking-wider">
                      {news.category}
                    </span>
                    <div className="flex items-center text-[#69707a] text-[11px] font-medium">
                      <Calendar size={12} className="mr-1" />
                      {news.date}
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-[#2b3a4a]">{news.title}</h3>
                  <p className="text-[#4d5875] text-sm leading-relaxed">{news.content}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
