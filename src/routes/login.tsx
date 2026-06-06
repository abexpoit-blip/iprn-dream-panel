import { useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // IMS Login page often has a random math question. 
  // For the replica, we'll use 4 + 5 = 9 as fixed for now to match the UI screenshot.
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (securityAnswer !== "9") {
      toast.error("Wrong security answer", {
        description: "Please check your math.",
      });
      return;
    }

    setLoading(true);
    // Standardize email for IMS login logic
    const email = username.includes("@") ? username : `${username}@imssms.org`;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error("Login failed", {
        description: error.message,
      });
    } else {
      navigate({ to: "/dashboard" });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      {/* Left side: Illustration */}
      <div className="hidden lg:flex flex-col items-center justify-center bg-[#f0f4ff] p-12">
        <div className="max-w-[480px] w-full">
          <img 
            src="https://www.imssms.org/assets/images/auth-img.png" 
            alt="IMS Authentication" 
            className="w-full h-auto"
            onError={(e) => {
              e.currentTarget.src = "https://img.freepik.com/free-vector/mobile-login-concept-illustration_114360-83.jpg";
            }}
          />
        </div>
      </div>

      {/* Right side: Login Form */}
      <div className="flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-[#ef4444] text-lg font-medium">Accounts are free and always will be.</h2>
            <div className="flex justify-center mb-6">
              <div className="flex items-center gap-1">
                <span className="text-4xl font-bold italic tracking-tighter text-[#2b3a4a]">iMS</span>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-[#0061f2]">Welcome back!</h1>
            <p className="text-[#69707a] text-sm">Please sign in to continue.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-[#69707a] font-normal">Username</Label>
              <Input
                id="username"
                className="h-12 border-[#c5ccd6] focus:border-[#0061f2] focus:ring-0"
                placeholder="Enter Your Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#69707a] font-normal">Password</Label>
              <Input
                id="password"
                type="password"
                className="h-12 border-[#c5ccd6] focus:border-[#0061f2] focus:ring-0"
                placeholder="Enter Your Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#69707a] font-normal block mb-1">What is 4 + 5 = ? :</Label>
              <Input
                className="h-12 border-[#c5ccd6] focus:border-[#0061f2] focus:ring-0"
                placeholder="Answer"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 bg-[#0061f2] hover:bg-[#0052ce] text-white font-medium text-lg rounded transition-colors mt-2"
              disabled={loading}
            >
              {loading ? "Signing In..." : "Sign In"}
            </Button>
          </form>

          <div className="text-center mt-6">
            <Link to="/register" className="text-[#0061f2] text-sm hover:underline">
              Don't have an account? Create Agent Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
