import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldAlert, Lock, User, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/admin-login")({
  component: AdminLogin,
});

function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Admin login usually uses email in Supabase, but we can treat username as email if needed
      // or just assume they enter their email. The user said "agent and cleint login panel same but admin login panel separate"
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username.includes('@') ? username : `${username}@admin.com`, // Defaulting to email format if needed
        password,
      });

      if (error) throw error;

      // Check if is admin
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profile?.is_admin) {
        await supabase.auth.signOut();
        throw new Error("Access denied. Admin privileges required.");
      }

      toast.success("Welcome back, Admin!");
      navigate({ to: "/admin" });
    } catch (error: any) {
      toast.error(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f2f4f8] font-sans">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-xl border-4 border-white mb-6 animate-bounce-slow">
            <img 
              src="https://www.imssms.org/assets/images/logo.png" 
              alt="IMS logo" 
              className="w-14 h-14 object-contain"
            />
          </div>
          <h1 className="text-3xl font-black text-[#2b3a4a] tracking-tighter uppercase mb-2">
            IMS <span className="text-[#0061f2]">Admin</span> Central
          </h1>
          <p className="text-[#69707a] font-medium">Secure Administrative Gateway</p>
        </div>

        <Card className="border-none shadow-2xl rounded-2xl overflow-hidden bg-white">
          <div className="h-2 bg-[#0061f2]"></div>
          <CardContent className="p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase text-[#69707a] tracking-widest ml-1">Admin Username / Email</Label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a7aeb8] group-focus-within:text-[#0061f2] transition-colors">
                    <User size={18} />
                  </div>
                  <Input
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter admin credentials..."
                    className="h-14 pl-12 bg-[#f8f9fc] border-[#e3e6ec] focus:border-[#0061f2] focus:ring-[#0061f2] rounded-xl text-base font-medium transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase text-[#69707a] tracking-widest ml-1">Secure Password</Label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a7aeb8] group-focus-within:text-[#0061f2] transition-colors">
                    <Lock size={18} />
                  </div>
                  <Input
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-14 pl-12 pr-12 bg-[#f8f9fc] border-[#e3e6ec] focus:border-[#0061f2] focus:ring-[#0061f2] rounded-xl text-base font-medium transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a7aeb8] hover:text-[#0061f2] transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <Button
                disabled={loading}
                className="w-full h-14 bg-[#0061f2] hover:bg-[#0052ce] text-white font-black text-lg rounded-xl shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5"
              >
                {loading ? (
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  "AUTHENTICATE SECURELY"
                )}
              </Button>

              <div className="flex items-center justify-center pt-2">
                <div className="flex items-center gap-2 text-[#e81500] bg-red-50 px-3 py-1.5 rounded-full border border-red-100">
                  <ShieldAlert size={14} />
                  <span className="text-[11px] font-black uppercase tracking-wider">Restricted Access</span>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 text-center space-y-4">
          <p className="text-[12px] text-[#69707a] font-medium italic">
            Copyright © {new Date().getFullYear()} <span className="font-bold text-[#2b3a4a] not-italic tracking-tighter">IMS SMS ADMIN</span>
          </p>
        </div>
      </div>
    </div>
  );
}
