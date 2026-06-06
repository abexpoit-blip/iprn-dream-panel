import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Newspaper } from "lucide-react";

export const Route = createFileRoute("/_client/news")({
  component: ClientNewsPage,
});

function ClientNewsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">News & Announcements</h1>
        <p className="text-[#69707a] text-[13px] font-medium mt-0.5">
          Latest updates from your agent
        </p>
      </div>
      <Card className="shadow-lg border-[#e3e6ec] rounded-xl">
        <CardContent className="p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#f2f4f8] flex items-center justify-center mb-4">
            <Newspaper className="text-[#0061f2]" size={24} />
          </div>
          <h3 className="text-[#2b3a4a] font-bold text-lg">No announcements yet</h3>
          <p className="text-[#69707a] text-[13px] mt-1">
            When your agent publishes news, you'll see it here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
