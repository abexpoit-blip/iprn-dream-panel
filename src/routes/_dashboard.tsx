import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
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
  ChevronDown,
  Moon,
  Sun,
  Bell,
  Maximize,
  LogOut,
  ShieldCheck,
  UserCheck,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";


export const Route = createFileRoute("/_dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSmsModuleOpen, setIsSmsModuleOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [impersonatedAgent, setImpersonatedAgent] = useState<any>(null);
  const [activeRates, setActiveRates] = useState<any[]>([]);

  const navigate = useNavigate();
  const location = useLocation();

  const checkUser = async () => {
    // Check if we already have valid profile data in state to avoid redundant fetches
    if (profile && location.pathname === profile.last_path) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      if (location.pathname !== "/login") {
        navigate({ to: "/login" });
      }
      return;
    }
    
    // Fetch profile and active rates in parallel for faster dashboard loading
    const [profileRes, ratesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).single(),
      supabase.from('active_rates').select('*').order('created_at', { ascending: true })
    ]);

    const profileData = profileRes.data;
    if (profileData) {
      profileData.last_path = location.pathname;
      
      if (profileData.role === 'client') {
        if (!location.pathname.startsWith("/client")) {
          navigate({ to: "/client/dashboard" });
          return;
        }
      } else if (profileData.role === 'agent') {
        if (location.pathname.startsWith("/client")) {
          navigate({ to: "/dashboard" });
          return;
        }
      }
      setProfile(profileData);
    }

    if (ratesRes.data) setActiveRates(ratesRes.data);

    // Impersonation check (Only for admins)
    const impersonatedId = sessionStorage.getItem('impersonated_agent_id');
    if (impersonatedId && profileData?.is_admin) {
      const { data: agent } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', impersonatedId)
        .single();
      if (agent) setImpersonatedAgent(agent);
    } else {
      setImpersonatedAgent(null);
    }
  };

  useEffect(() => {
    checkUser();
  }, [location.pathname]);

  // Listen for storage changes (impersonation)
  useEffect(() => {
    const handleStorageChange = () => checkUser();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleExitImpersonation = () => {
    sessionStorage.removeItem('impersonated_agent_id');
    setImpersonatedAgent(null);
    toast.success("Returned to Admin Panel");
    navigate({ to: "/admin" });
  };

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
        { label: "SMS CDR", href: "/stats/cdr" },
        { label: "SMS Stats", href: "/stats/sms" },
        { label: "Client Stats", href: "/stats/client" },
        { label: "Range Stats", href: "/stats/range" },
        { label: "Number Stats", href: "/stats/number" },
      ]
    },
    { label: "Credit Notes", icon: FileText, href: "/credits" },
    { label: "News", icon: Newspaper, href: "/news" },
    { label: "SMS Test Panel", icon: Settings, href: "/test-panel" },
    ...(profile?.is_admin && !impersonatedAgent ? [{ label: "Admin Panel", icon: ShieldCheck, href: "/admin" }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#f2f4f8] flex font-sans">
      {/* Sidebar */}
      <aside className={cn(
        "bg-white border-r border-[#e3e6ec] transition-all duration-300 flex flex-col z-20 sticky top-0 h-screen shadow-sm",
        isSidebarOpen ? "w-[240px]" : "w-[70px]"
      )}>
        <div className="h-16 flex items-center justify-center border-b border-[#e3e6ec] px-4">
          <Link to="/dashboard" className="flex items-center justify-center">
            {isSidebarOpen ? (
              <img 
                src="https://www.imssms.org/assets/images/logo.png" 
                alt="IMS logo" 
                className="h-10 object-contain"
              />
            ) : (
              <span className="font-black italic tracking-tighter text-[#2b3a4a] text-xl">iMS</span>
            )}
          </Link>
        </div>
        
        <nav className="flex-1 py-4 overflow-y-auto custom-scrollbar overflow-x-hidden">
          {isSidebarOpen && (
            <div className="px-6 mb-4">
              <p className="text-[10px] font-bold text-[#69707a] uppercase tracking-wider opacity-60">Navigation Menu</p>
            </div>
          )}

          <div className="space-y-1">
            {menuItems.map((item) => (
              <div key={item.label}>
                {item.hasSubmenu ? (
                  <div>
                    <button
                      onClick={item.toggle}
                      className={cn(
                        "w-full flex items-center px-6 py-3 text-[#2b3a4a] hover:bg-[#f2f4f8] transition-all duration-200 font-medium text-[13px]",
                        item.isOpen && isSidebarOpen && "bg-[#f2f4f8]"
                      )}
                    >
                      <item.icon size={18} className="text-[#a7aeb8]" />
                      {isSidebarOpen && (
                        <>
                          <span className="ml-4 flex-1 text-left">{item.label}</span>
                          <ChevronDown className={cn("transition-transform duration-200 opacity-50", item.isOpen && "rotate-180")} size={14} />
                        </>
                      )}
                    </button>
                    {item.isOpen && isSidebarOpen && (
                      <div className="bg-[#f8f9fc] py-1 border-y border-[#e3e6ec]/50">
                        {item.subItems.map((sub) => (
                          <Link
                            key={sub.label}
                            to={sub.href}
                            className={cn(
                              "flex items-center pl-14 pr-6 py-2 text-[12px] text-[#69707a] hover:text-[#0061f2] hover:translate-x-1 transition-all",
                              location.pathname === sub.href && "text-[#0061f2] font-semibold"
                            )}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current mr-3 opacity-30" />
                            {sub.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    key={item.label}
                    to={item.href}
                    className={cn(
                      "flex items-center px-6 py-3 transition-all duration-200 font-medium text-[13px] border-l-[3px]",
                      location.pathname === item.href 
                        ? "bg-[#f2f4f8] text-[#0061f2] border-[#0061f2]" 
                        : "text-[#2b3a4a] border-transparent hover:bg-[#f2f4f8] hover:border-[#e3e6ec]"
                    )}
                  >
                    <item.icon size={18} className={cn(location.pathname === item.href ? "text-[#0061f2]" : "text-[#a7aeb8]")} />
                    {isSidebarOpen && <span className="ml-4">{item.label}</span>}
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* Active Rates Section in Sidebar */}
          {isSidebarOpen && activeRates.length > 0 && (
            <div className="mt-8 px-2 space-y-1">
              {activeRates.map((rate, idx) => (
                <div 
                  key={idx}
                  className="bg-[#e81500] text-white text-[11px] font-bold py-1.5 px-3 rounded-md shadow-sm mb-1 hover:brightness-110 transition-all cursor-default"
                >
                  {rate.country} {rate.provider} {rate.type} ( {rate.rate}$ )
                </div>
              ))}
            </div>
          )}
        </nav>

        {/* User Info Bar at bottom of sidebar when closed */}
        {!isSidebarOpen && (
          <div className="p-4 border-t border-[#e3e6ec] flex justify-center">
            <div className="w-8 h-8 rounded-full bg-[#0061f2] flex items-center justify-center text-[10px] font-bold text-white uppercase shadow-sm">
              {profile?.username?.[0] || 'U'}
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen relative">
        {/* Impersonation Banner */}
        {impersonatedAgent && (
          <div className="bg-[#e81500] text-white px-6 py-2 flex items-center justify-between z-30 animate-pulse">
            <div className="flex items-center gap-3">
              <UserCheck size={18} />
              <div className="text-[12px] font-black uppercase tracking-wider">
                IMPERSONATING AGENT: <span className="underline underline-offset-4">{impersonatedAgent.username}</span>
              </div>
            </div>
            <Button 
              onClick={handleExitImpersonation}
              variant="outline" 
              className="h-7 px-4 bg-white/10 border-white/30 text-white hover:bg-white hover:text-[#e81500] text-[10px] font-black uppercase"
            >
              EXIT PANEL
            </Button>
          </div>
        )}

        {/* Header */}
        <header className="h-16 bg-white border-b border-[#e3e6ec] flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-[#69707a] hover:bg-[#f2f4f8] transition-colors"
            >
              <Menu size={18} />
            </Button>
            <span className="text-[#69707a] text-[13px] font-medium hidden sm:inline-block">
              {new Date().toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" className="text-[#69707a] hover:bg-[#f2f4f8]"><Moon size={18} /></Button>
            <Button variant="ghost" size="icon" className="text-[#69707a] hover:bg-[#f2f4f8] relative">
              <Bell size={18} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#00ac69] rounded-full border-2 border-white"></span>
            </Button>
            <Button variant="ghost" size="icon" className="text-[#69707a] hover:bg-[#f2f4f8] hidden xs:flex"><Maximize size={18} /></Button>
            
            <div className="h-8 w-px bg-[#e3e6ec] mx-2 hidden sm:block"></div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 py-1 px-2 hover:bg-[#f2f4f8] rounded-lg transition-all">
                  <div className="w-8 h-8 rounded-full bg-[#0061f2] flex items-center justify-center text-[11px] font-bold text-white shadow-md border-2 border-white uppercase">
                    {profile?.username?.[0] || 'U'}
                  </div>
                  <div className="hidden md:flex flex-col items-start leading-tight">
                    <span className="text-[11px] font-bold text-[#2b3a4a] uppercase tracking-tighter">{profile?.username || 'User'}</span>
                    <span className="text-[9px] text-[#0061f2] font-bold uppercase mt-0.5">{profile?.role || 'Agent'}</span>
                  </div>
                  <ChevronDown size={12} className="text-[#69707a] ml-1 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mt-2 border-[#e3e6ec] shadow-xl p-2 rounded-xl animate-in fade-in zoom-in duration-200">
                <div className="px-3 py-2 border-b border-[#f2f4f8] mb-1">
                  <p className="text-[10px] uppercase text-[#69707a] font-bold tracking-wider opacity-60">Account Settings</p>
                </div>
                <DropdownMenuItem className="text-[13px] py-2.5 cursor-pointer hover:bg-[#f2f4f8] rounded-lg font-medium text-[#2b3a4a] group">
                  <Settings className="mr-3 h-4 w-4 text-[#a7aeb8] group-hover:text-[#0061f2]" />
                  <span>Profile Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#f2f4f8]" />
                <DropdownMenuItem 
                  className="text-[13px] py-2.5 cursor-pointer text-[#e81500] hover:bg-[#fee2e2] rounded-lg font-bold group"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    navigate({ to: "/login" });
                  }}
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#f2f4f8]">
          <div className="p-4 sm:p-8 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
          
          <footer className="py-6 px-8 border-t border-[#e3e6ec] bg-white flex flex-col sm:flex-row justify-between items-center gap-2">
            <p className="text-[12px] text-[#69707a] font-medium italic">
              Copyright © {new Date().getFullYear()} <span className="font-bold text-[#2b3a4a] not-italic tracking-tighter">IMS SMS</span>. Designed with ❤️ by <a href="#" className="text-[#0061f2] font-bold">IMS SMS</a> All rights reserved
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
