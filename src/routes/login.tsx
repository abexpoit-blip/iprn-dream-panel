import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";


export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (securityAnswer !== "9") {
      toast.error("Wrong security answer", {
        description: "Please check your math.",
      });
      return;
    }


    setLoading(true);
    // In a real app, username would be an email. 
    // For this replica, we'll assume email = username@ims.com for auth purposes if they sign up.
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
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col items-center justify-center bg-blue-100 p-12">
        <img 
          src="https://www.imssms.org/assets/images/auth-img.png" 
          alt="Illustration" 
          className="max-w-md w-full mb-8"
          onError={(e) => {
            // Fallback if external image is blocked
            e.currentTarget.src = "https://cdn.gpteng.co/blank-app-v1.svg";
          }}
        />
      </div>
      <div className="flex flex-col items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center">
            <h1 className="text-red-500 font-medium mb-4">Accounts are free and always will be.</h1>
            <div className="flex items-center gap-2 mb-8">
              <span className="text-3xl font-bold italic text-[#2b2b2b]">iMS</span>
            </div>
            <h2 className="text-2xl font-semibold text-blue-600">Welcome back!</h2>
            <p className="text-gray-500">Please sign in to continue.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Enter Your Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter Your Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>What is 4 + 5 = ? :</Label>
              <div className="flex gap-4 items-center">
                <Input
                  placeholder="Answer"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
