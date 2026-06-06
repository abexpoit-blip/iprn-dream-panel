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
        toast.success("Registration Successful", { 
          description: "Your account is pending approval. Please contact an administrator to activate your account." 
        });
        navigate({ to: "/login" });
      }
    }

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

      {/* Right side: Register Form */}
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
              <h3 className="text-[28px] font-bold text-[#1f2937]">Create Agent Account</h3>
              <p className="text-[#4d5875] text-[17px] mb-6">Join the iMS network today.</p>
            </div>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-[#4d5875] font-semibold text-sm">Username</Label>
              <Input
                id="username"
                className="h-[46px] border-[#e2e8f0] focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] rounded-md"
                placeholder="Choose a Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-[#4d5875] font-semibold text-sm">Full Name</Label>
              <Input
                id="fullName"
                className="h-[46px] border-[#e2e8f0] focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] rounded-md"
                placeholder="Your Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#4d5875] font-semibold text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                className="h-[46px] border-[#e2e8f0] focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] rounded-md"
                placeholder="Create a Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-[46px] bg-[#0061f2] hover:bg-[#0052ce] text-white font-semibold text-base rounded-md transition-all shadow-sm mt-4"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Account"}
            </Button>
          </form>

          <div className="mt-12 text-center border-t pt-6">
            <Link to="/login" className="text-[#0061f2] text-[15px] font-medium hover:underline">
              Already have an account? Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
