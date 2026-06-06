import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  LayoutDashboard, 
  MessageSquare, 
  Users, 
  BarChart3, 
  FileText, 
  Newspaper, 
  Settings,
  Menu,
  X,
  ChevronDown,
  Moon,
  Sun,
  Bell,
  Maximize
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSmsModuleOpen, setIsSmsModuleOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/login" });
        return;
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      setProfile(profile);
    };
    checkUser();
  }, [navigate]);

  const menuItems = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { 
      label: "SMS Module", 
      icon: MessageSquare, 
      hasSubmenu: true, 
      isOpen: isSmsModuleOpen,
      toggle: () => setIsSmsModuleOpen(!isSmsModuleOpen),
      subItems: [
        { label: "SMS Ranges", href: "/sms/ranges" },
        { label: "SMS Numbers", href: "/sms/numbers" },
        { label: "SMS RateCard", href: "/sms/ratecard" },
      ]
    },
    { label: "Clients", icon: Users, href: "/clients" },
    { 
      label: "Stats & Reports", 
      icon: BarChart3, 
      hasSubmenu: true, 
      isOpen: isStatsOpen,
      toggle: () => setIsStatsOpen(!isStatsOpen),
      subItems: [
        { label: "Daily Stats", href: "/stats/daily" },
        { label: "Number Stats", href: "/stats/number" },
        { label: "Range Stats", href: "/stats/range" },
      ]
    },
    { label: "Credit Notes", icon: FileText, href: "/credits" },
    { label: "News", icon: Newspaper, href: "/news" },
    { label: "SMS Test Panel", icon: Settings, href: "/test-panel" },
  ];


  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={cn(
        "bg-white border-r transition-all duration-300 flex flex-col",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="p-4 flex items-center gap-2 border-b">
          <span className="text-3xl font-bold italic tracking-tighter text-[#2b3a4a] ml-4">iMS</span>
        </div>
        
        <nav className="flex-1 py-4 overflow-y-auto custom-scrollbar">
          <div className="px-4 mb-2">
            <p className="text-[10px] font-bold text-[#69707a] uppercase tracking-wider">Navigation Menu</p>
          </div>

          {menuItems.map((item) => (
            <div key={item.label}>
              {item.hasSubmenu ? (
                <div>
                  <button
                    onClick={item.toggle}
                    className="w-full flex items-center px-6 py-3 text-[#2b3a4a] hover:bg-[#f2f4f8] transition-colors font-medium text-sm border-l-4 border-transparent hover:border-[#0061f2]"
                  >
                    <item.icon size={20} />
                    {isSidebarOpen && (
                      <>
                        <span className="ml-4 flex-1 text-left">{item.label}</span>
                        <ChevronDown className={cn("transition-transform", item.isOpen && "rotate-180")} size={16} />
                      </>
                    )}
                  </button>
                  {item.isOpen && isSidebarOpen && (
                    <div className="bg-gray-50 py-2">
                      {item.subItems.map((sub) => (
                        <Link
                          key={sub.label}
                          to={sub.href}
                          className="flex items-center pl-14 pr-6 py-2 text-sm text-gray-500 hover:text-blue-600"
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to={item.href}
                  className="flex items-center px-6 py-3 text-[#2b3a4a] hover:bg-[#f2f4f8] transition-colors font-medium text-sm border-l-4 border-transparent hover:border-[#0061f2]"
                >
                  <item.icon size={20} />
                  {isSidebarOpen && <span className="ml-4">{item.label}</span>}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <Menu size={20} />
            </Button>
            <span className="text-gray-500 text-sm">{new Date().toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')}</span>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon"><Moon size={18} /></Button>
            <Button variant="ghost" size="icon" className="relative">
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full"></span>
            </Button>
            <Button variant="ghost" size="icon"><Maximize size={18} /></Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">
                {profile?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <ChevronDown size={14} className="text-gray-400" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
