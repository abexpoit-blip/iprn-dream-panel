import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";
import { IMSDataTable, type IMSColumn } from "@/components/ims/IMSDataTable";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_dashboard/agents")({
  component: AgentsPage,
});

type AgentRow = {
  id: string;
  username: string;
  full_name: string | null;
  status: string | null;
  balance: number | null;
  created_at: string;
  numbers_count: number;
  clients_count: number;
  otp_count: number;
  total_payout: number;
};

function AgentsPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery<AgentRow[]>({
    queryKey: ["admin_agents_overview"],
    queryFn: async () => {
      const { data: agents, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, status, balance, created_at, role, is_admin")
        .eq("role", "agent")
        .eq("is_admin", false)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const [pool, clients, ledger] = await Promise.all([
        supabase.from("number_pool").select("assigned_agent"),
        supabase.from("clients").select("agent_id"),
        supabase
          .from("commission_ledger")
          .select("user_id, amount, tier")
          .eq("tier", "agent"),
      ]);

      const numCount = new Map<string, number>();
      (pool.data || []).forEach((r: any) => {
        if (!r.assigned_agent) return;
        numCount.set(r.assigned_agent, (numCount.get(r.assigned_agent) || 0) + 1);
      });
      const clCount = new Map<string, number>();
      (clients.data || []).forEach((r: any) => {
        if (!r.agent_id) return;
        clCount.set(r.agent_id, (clCount.get(r.agent_id) || 0) + 1);
      });
      const otpCount = new Map<string, number>();
      const payoutSum = new Map<string, number>();
      (ledger.data || []).forEach((r: any) => {
        otpCount.set(r.user_id, (otpCount.get(r.user_id) || 0) + 1);
        payoutSum.set(r.user_id, (payoutSum.get(r.user_id) || 0) + Number(r.amount || 0));
      });

      return (agents || []).map((a: any) => ({
        id: a.id,
        username: a.username,
        full_name: a.full_name,
        status: a.status,
        balance: a.balance,
        created_at: a.created_at,
        numbers_count: numCount.get(a.id) || 0,
        clients_count: clCount.get(a.id) || 0,
        otp_count: otpCount.get(a.id) || 0,
        total_payout: payoutSum.get(a.id) || 0,
      }));
    },
  });

  const impersonate = (id: string, username: string) => {
    sessionStorage.setItem("impersonated_agent_id", id);
    toast.success(`Impersonating agent: ${username}`);
    navigate({ to: "/dashboard" });
    setTimeout(() => window.location.reload(), 200);
  };

  const columns: IMSColumn<AgentRow>[] = useMemo(
    () => [
      {
        key: "username",
        header: "Agent",
        value: (r) => r.username,
        cell: (r) => (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#f2f4f8] text-[#0061f2] flex items-center justify-center font-bold text-xs uppercase">
              {r.username?.[0] || "A"}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-[#2b3a4a]">{r.username}</span>
              {r.full_name && (
                <span className="text-[11px] text-[#69707a]">{r.full_name}</span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        value: (r) => r.status ?? "—",
        cell: (r) => (
          <span
            className={cn(
              "px-2 py-0.5 text-white text-[10px] font-bold rounded uppercase",
              r.status === "approved" || r.status === "Active"
                ? "bg-green-500"
                : r.status === "pending"
                  ? "bg-amber-500"
                  : "bg-slate-500",
            )}
          >
            {r.status || "—"}
          </span>
        ),
      },
      {
        key: "numbers",
        header: "Numbers",
        value: (r) => r.numbers_count,
        cell: (r) => (
          <span className="font-bold text-[#0061f2]">{r.numbers_count}</span>
        ),
        className: "text-right",
      },
      {
        key: "clients",
        header: "Clients",
        value: (r) => r.clients_count,
        cell: (r) => (
          <span className="font-bold text-emerald-600">{r.clients_count}</span>
        ),
        className: "text-right",
      },
      {
        key: "otp",
        header: "Billed OTPs",
        value: (r) => r.otp_count,
        className: "text-right",
      },
      {
        key: "payout",
        header: "Total Earned",
        value: (r) => `$${r.total_payout.toFixed(4)}`,
        cell: (r) => (
          <span className="font-bold text-purple-600">
            ${r.total_payout.toFixed(4)}
          </span>
        ),
        className: "text-right",
      },
      {
        key: "balance",
        header: "Balance",
        value: (r) => `$${Number(r.balance ?? 0).toFixed(2)}`,
        className: "text-right",
      },
      {
        key: "created",
        header: "Joined",
        value: (r) => new Date(r.created_at).toLocaleDateString(),
      },
      {
        key: "act",
        header: "Action",
        value: () => "",
        exportable: false,
        cell: (r) => (
          <Button
            size="sm"
            onClick={() => impersonate(r.id, r.username)}
            className="h-7 px-3 text-[10px] font-bold uppercase bg-[#0061f2] hover:bg-[#0052ce] text-white gap-1"
          >
            <UserCheck size={12} />
            Impersonate
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <IMSDataTable<AgentRow>
      title="Agents"
      subtitle="All agents under the admin panel with allocation and earnings overview"
      columns={columns}
      rows={data}
      loading={isLoading}
      exportName="Agents"
      rowKey={(r) => r.id}
    />
  );
}
