import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const email = `${username}@imssms.org`;

    // 1. Sign up the user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          full_name: fullName,
        }
      }
    });

    if (authError) {
      toast.error("Registration failed", { description: authError.message });
      setLoading(false);
      return;
    }

    if (authData.user) {
      // 2. Create the profile record
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          username,
          full_name: fullName,
          role: 'agent'
        });

      if (profileError) {
        toast.error("Profile creation failed", { description: profileError.message });
      } else {
        toast.success("Account created successfully", { 
          description: "Please check your email for verification if enabled, or sign in." 
        });
        navigate({ to: "/login" });
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
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

      <div className="flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center mb-6">
              <span className="text-4xl font-bold italic tracking-tighter text-[#2b3a4a]">iMS</span>
            </div>
            <h1 className="text-2xl font-bold text-[#0061f2]">Create Agent Account</h1>
            <p className="text-[#69707a] text-sm">Join the iMS network today.</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-[#69707a] font-normal">Username</Label>
              <Input
                id="username"
                className="h-12 border-[#c5ccd6]"
                placeholder="Choose a Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-[#69707a] font-normal">Full Name</Label>
              <Input
                id="fullName"
                className="h-12 border-[#c5ccd6]"
                placeholder="Your Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#69707a] font-normal">Password</Label>
              <Input
                id="password"
                type="password"
                className="h-12 border-[#c5ccd6]"
                placeholder="Create a Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 bg-[#0061f2] hover:bg-[#0052ce] text-white font-medium text-lg rounded transition-colors mt-2"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Account"}
            </Button>
          </form>

          <div className="text-center mt-6">
            <Link to="/login" className="text-[#0061f2] text-sm hover:underline">
              Already have an account? Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
