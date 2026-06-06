import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getEffectiveUserId } from "@/lib/auth-helpers";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, Settings, FileText, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createClientAccount } from "@/lib/clients.functions";



export const Route = createFileRoute("/_dashboard/clients")({
  component: ClientsPage,
});

function ClientsPage() {
  const createClientFn = useServerFn(createClientAccount);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newClient, setNewClient] = useState({
    username: "",
    email: "",
    skype_id: "",
    password: "",
  });

  const { data: clients, isLoading, refetch } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const userId = await getEffectiveUserId();
      if (!userId) return [];

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('agent_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createClientFn({ data: newClient });
      toast.success("Client account created", {
        description: `${newClient.username} can now log in with their password.`,
      });
      setIsAddDialogOpen(false);
      setNewClient({ username: "", email: "", skype_id: "", password: "" });
      refetch();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create client account");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredClients = clients?.filter((client: any) => 
...
                  filteredClients?.map((client: any, idx: number) => (
                    <TableRow key={client.id} className={cn("border-b border-[#f2f4f8] hover:bg-gray-50/50 transition-colors", idx % 2 === 0 ? "bg-white" : "bg-[#fcfcfd]")}>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#f2f4f8] text-[#0061f2] flex items-center justify-center font-bold text-xs">
                            {client.username[0].toUpperCase()}
                          </div>
                          <span className="text-[13px] font-bold text-[#2b3a4a]">{client.username}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[13px] font-medium text-[#69707a] px-6 py-4">{client.email || '-'}</TableCell>
                      <TableCell className="text-[13px] font-medium text-[#69707a] px-6 py-4">{client.skype_id || '-'}</TableCell>
                      <TableCell className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider uppercase shadow-sm",
                          client.status === 'Active' ? "bg-green-500 text-white" : "bg-red-500 text-white"
                        )}>
                          {(client.status || 'Active')}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#0061f2] hover:bg-blue-50">
                            <Settings size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#e81500] hover:bg-red-50">
                            <FileText size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="px-6 py-4 border-t border-[#e3e6ec] bg-[#f8f9fc] flex flex-col sm:flex-row justify-between items-center gap-4">
             <p className="text-[11px] font-bold text-[#69707a] uppercase tracking-wider">Showing {filteredClients?.length || 0} Clients</p>
             <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-8 px-3 text-[11px] font-bold uppercase border-[#e3e6ec] text-[#69707a] hover:bg-white">First</Button>
                <Button variant="outline" size="sm" className="h-8 px-3 text-[11px] font-bold uppercase border-[#e3e6ec] text-[#69707a] hover:bg-white">Previous</Button>
                <Button variant="default" size="sm" className="h-8 px-3 text-[11px] font-bold uppercase bg-[#0061f2] text-white">1</Button>
                <Button variant="outline" size="sm" className="h-8 px-3 text-[11px] font-bold uppercase border-[#e3e6ec] text-[#69707a] hover:bg-white">Next</Button>
                <Button variant="outline" size="sm" className="h-8 px-3 text-[11px] font-bold uppercase border-[#e3e6ec] text-[#69707a] hover:bg-white">Last</Button>
             </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
