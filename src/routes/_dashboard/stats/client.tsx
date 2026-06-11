import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { IMSDataTable, type IMSColumn } from "@/components/ims/IMSDataTable";

export const Route = createFileRoute("/_dashboard/stats/client")({
  component: StatsPage,
});

type Row = { name: string; sms: number; payout: number };

function StatsPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .single();
      setIsAdmin(!!prof?.is_admin);
    })();
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["client_or_agent_stats", isAdmin],
    queryFn: async () => {
      if (isAdmin) {
        // Admin: aggregate by AGENT
        const { data, error } = await supabase
          .from("sms_cdr")
          .select("payout, agent_id, profiles!sms_cdr_agent_id_fkey(username)")
          .limit(10000);
        if (error) throw error;
        const agg = new Map<string, Row>();
        (data ?? []).forEach((r: any) => {
          const name = r.profiles?.username ?? "Unassigned Agent";
          const e = agg.get(name) ?? { name, sms: 0, payout: 0 };
          e.sms += 1;
          e.payout += Number(r.payout ?? 0);
          agg.set(name, e);
        });
        return Array.from(agg.values()).sort((a, b) => b.sms - a.sms);
      } else {
        // Agent: aggregate by CLIENT
        const { data, error } = await supabase
          .from("sms_cdr")
          .select("payout, clients(name)")
          .limit(10000);
        if (error) throw error;
        const agg = new Map<string, Row>();
        (data ?? []).forEach((r: any) => {
          const name = r.clients?.name ?? "Unassigned";
          const e = agg.get(name) ?? { name, sms: 0, payout: 0 };
          e.sms += 1;
          e.payout += Number(r.payout ?? 0);
          agg.set(name, e);
        });
        return Array.from(agg.values()).sort((a, b) => b.sms - a.sms);
      }
    },
  });

  const label = isAdmin ? "Agent" : "Client";

  const columns: IMSColumn<Row>[] = [
    {
      key: "name",
      header: label,
      value: (r) => r.name,
      cell: (r) => <span className="font-bold">{r.name}</span>,
    },
    {
      key: "sms",
      header: "SMS",
      value: (r) => r.sms,
      cell: (r) => <span className="font-bold text-[#0061f2]">{r.sms}</span>,
    },
    { key: "currency", header: "Currency", value: () => "USD" },
    {
      key: "my",
      header: isAdmin ? "Admin Payout" : "My Payout",
      value: (r) => `$${r.payout.toFixed(4)}`,
      cell: (r) => (
        <span className="font-bold text-green-600">${r.payout.toFixed(4)}</span>
      ),
      className: "text-right",
    },
    {
      key: "cp",
      header: isAdmin ? "Agent Payout" : "Client Payout",
      value: (r) => `$${r.payout.toFixed(4)}`,
      className: "text-right",
    },
  ];

  return (
    <IMSDataTable
      title={isAdmin ? "Agent Stats" : "Client Stats"}
      subtitle={
        isAdmin
          ? "SMS volume and payout per agent"
          : "SMS volume and payout per client"
      }
      columns={columns}
      rows={data}
      loading={isLoading}
      exportName={isAdmin ? "AgentStats" : "ClientStats"}
    />
  );
}
