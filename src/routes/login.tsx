import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  useEffect(() => {
    setNum1(Math.floor(Math.random() * 9) + 1);
    setNum2(Math.floor(Math.random() * 9) + 1);
  }, []);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parseInt(securityAnswer) !== num1 + num2) {
      toast.error("Wrong security answer", {
        description: "Please check your math.",
      });
      return;
    }

    setLoading(true);
    const raw = username.trim();

    // Standardize candidates to avoid redundant lookups
    const candidates = raw.includes("@")
      ? [raw]
      : [
          `${raw.toLowerCase()}@nexus.site`,
          `${raw.toLowerCase()}@imssms.org`,
          `${raw.toLowerCase()}@client.imssms.org`,
          `${raw.toLowerCase()}@admin.com`,
          raw
        ];

    let signedInUserId: string | null = null;
    let lastError: string | null = null;

    // Fast-path for common usernames to reduce auth latency
    const prioritizedEmail = raw.includes("@") ? raw : `${raw.toLowerCase()}@nexus.site`;
    const firstAttempt = await supabase.auth.signInWithPassword({ email: prioritizedEmail, password });

    if (!firstAttempt.error && firstAttempt.data.user) {
      signedInUserId = firstAttempt.data.user.id;
    } else {
      // If primary fails, check others in parallel
      const otherCandidates = candidates.filter(c => c !== prioritizedEmail);
      const results = await Promise.all(
        otherCandidates.map(email => supabase.auth.signInWithPassword({ email, password }))
      );
      
      const success = results.find(r => !r.error && r.data.user);
      if (success) {
        signedInUserId = success.data.user.id;
      } else {
        lastError = firstAttempt.error?.message || results[0]?.error?.message || "Invalid credentials.";
      }
    }

    if (!signedInUserId) {
      toast.error("Login failed", { description: lastError || "Invalid credentials." });
      setLoading(false);
      return;
    }

    // Read profile to determine role / approval
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("status, role, is_admin")
      .eq("id", signedInUserId)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      toast.error("Account not found", { description: "Profile missing. Contact support." });
      setLoading(false);
      return;
    }

    if (profile.role === "client") {
      navigate({ to: "/client/dashboard" });
      setLoading(false);
      return;
    }

    // Agent / admin require approved status
    // Agent / admin require approved status
    if (profile.status !== "approved") {
      await supabase.auth.signOut();
      toast.error("Account Pending Approval", {
        description: "Your account is currently under review. Please contact support.",
      });
      setLoading(false);
      return;
    }

    if (profile.is_admin) {
      toast.info("Admin detected. Please use the secure admin login panel for full access.");
    }

    navigate({ to: "/dashboard" });
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white font-sans">
      {/* Left side: Illustration */}
      <div className="hidden md:flex flex-1 items-center justify-center bg-[#f0f3f9] p-4 lg:p-12">
        <div className="w-full max-w-[80%]">
          <img 
            src="https://www.imssms.org/assets/images/5.png" 
            alt="IMS Authentication" 
            className="w-full h-auto object-contain mx-auto"
            style={{ maxHeight: "80vh" }}
          />
        </div>
      </div>

      {/* Right side: Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-white">
        <div className="w-full max-w-[450px]">
          <div className="mb-8">
            <h2 className="text-[#ef4848] text-[26px] font-semibold leading-tight mb-6">
              Accounts are free and always will be.
            </h2>
            <div className="mb-8">
              <Link to="/">
                <img 
                  src="https://www.imssms.org/assets/images/logo.png" 
                  alt="logo" 
                  className="h-20 object-contain"
                />
              </Link>
            </div>
            <div className="space-y-1">
              <h3 className="text-[28px] font-bold text-[#1f2937]">Welcome back!</h3>
              <p className="text-[#4d5875] text-[17px] mb-6">Please sign in to continue.</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-[#4d5875] font-semibold text-sm">Username</Label>
              <Input
                id="username"
                className="h-[46px] border-[#e2e8f0] focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] rounded-md"
                placeholder="Enter Your Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#4d5875] font-semibold text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                className="h-[46px] border-[#e2e8f0] focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] rounded-md"
                placeholder="Enter Your Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2">
              <div className="text-[#4d5875] text-[15px]">
                What is {num1} + {num2} = ? :
              </div>
              <div className="w-full sm:w-1/2">
                <Input
                  type="number"
                  className="h-[46px] border-[#e2e8f0] focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] rounded-md"
                  placeholder="Answer"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-[46px] bg-[#0061f2] hover:bg-[#0052ce] text-white font-semibold text-base rounded-md transition-all shadow-sm mt-4"
              disabled={loading}
            >
              {loading ? "Signing In..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-12 text-center border-t pt-6">
            <Link to="/register" className="text-[#0061f2] text-[15px] font-medium hover:underline">
              Don't have an account? Create Agent Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
