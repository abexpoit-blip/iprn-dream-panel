import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { AssignDialog } from "@/components/numbers/AssignDialog";
import { IMSDataTable, type IMSColumn } from "@/components/ims/IMSDataTable";

export const Route = createFileRoute("/_dashboard/agent/numbers")({
  component: AgentNumbersPage,
});

function getMe() {
  try {
    return JSON.parse(localStorage.getItem("nexus_user") || "null");
  } catch {
    return null;
  }
}

type Row = {
  id: string;
  number: string;
  country: string | null;
  range_name: string | null;
  prefix: string | null;
  agent_rate: number | null;
  client_rate: number | null;
  assigned_client: string | null;
  status: string;
  updated_at: string | null;
  created_at: string;
};

function AgentNumbersPage() {
  const me = getMe();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: numbers, isLoading } = useQuery<Row[]>({
    queryKey: ["agent_numbers", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("number_pool")
        .select("*")
        .eq("assigned_agent", me.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  if (!me?.id) {
    return <div className="p-8 text-center text-gray-500">Please sign in.</div>;
  }

  const rows = numbers || [];
  const allSelected = rows.length > 0 && rows.every((n) => selectedIds.includes(n.id));
  const toggleAll = () => setSelectedIds(allSelected ? [] : rows.map((n) => n.id));

  const columns: IMSColumn<Row>[] = [
    {
      key: "sel",
      header: <Checkbox checked={allSelected} onCheckedChange={toggleAll} />,
      value: () => "",
      cell: (r) => (
        <Checkbox
          checked={selectedIds.includes(r.id)}
          onCheckedChange={(v) =>
            setSelectedIds((prev) =>
              v ? [...prev, r.id] : prev.filter((x) => x !== r.id),
            )
          }
        />
      ),
      exportable: false,
      className: "w-10",
    },
    {
      key: "number",
      header: "Number",
      value: (r) => r.number,
      cell: (r) => <span className="font-bold text-[#2b3a4a]">{r.number}</span>,
    },
    { key: "country", header: "Country", value: (r) => r.country ?? "—" },
    { key: "range", header: "Range", value: (r) => r.range_name ?? "—" },
    { key: "prefix", header: "Prefix", value: (r) => (r.prefix ? `+${r.prefix}` : "—") },
    {
      key: "agent_rate",
      header: "My Cost",
      value: (r) => (r.agent_rate != null ? Number(r.agent_rate).toFixed(2) : "—"),
      cell: (r) => (
        <span className="font-bold text-emerald-600">
          {r.agent_rate != null ? Number(r.agent_rate).toFixed(2) : "—"}
        </span>
      ),
    },
    {
      key: "client_rate",
      header: "Client Price",
      value: (r) => (r.client_rate != null ? Number(r.client_rate).toFixed(2) : "—"),
      cell: (r) => (
        <span className="font-bold text-purple-600">
          {r.client_rate != null ? Number(r.client_rate).toFixed(2) : "—"}
        </span>
      ),
    },
    {
      key: "assigned",
      header: "Client",
      value: (r) => (r.assigned_client ? "Assigned" : "—"),
      cell: (r) =>
        r.assigned_client ? (
          <span className="text-purple-700 font-bold">Assigned</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      value: (r) => r.status,
      cell: (r) => (
        <span
          className={cn(
            "px-2 py-0.5 text-white text-[10px] font-bold rounded uppercase",
            r.status === "available"
              ? "bg-green-500"
              : r.status === "reserved"
                ? "bg-amber-500"
                : "bg-slate-500",
          )}
        >
          {r.status}
        </span>
      ),
    },
  ];

  return (
    <>
      <AssignDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        mode="client"
        numberIds={selectedIds}
        onDone={() => {
          setSelectedIds([]);
          queryClient.invalidateQueries({ queryKey: ["agent_numbers"] });
        }}
      />

      <IMSDataTable<Row>
        title="My Allocated Numbers"
        subtitle="Assign these numbers to your clients with a markup."
        columns={columns}
        rows={rows}
        loading={isLoading}
        exportName="AgentNumbers"
        rowKey={(r) => r.id}
        emptyText="No numbers allocated to you yet."
        rightSlot={
          selectedIds.length > 0 ? (
            <Button
              onClick={() => setAssignOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold uppercase tracking-wider text-xs gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Assign {selectedIds.length} to Client
            </Button>
          ) : null
        }
      />
    </>
  );
}
