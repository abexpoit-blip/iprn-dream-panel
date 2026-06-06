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

  const filteredClients = clients?.filter(client => 
    client.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2b3a4a] tracking-tight">Clients Management</h1>
          <p className="text-[#69707a] text-[13px] font-medium mt-0.5">Manage your client accounts</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0061f2] hover:bg-[#0052ce] text-white font-bold text-sm px-6 shadow-lg shadow-blue-500/20">
              <Plus size={16} className="mr-2" />
              Add New Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-2xl border-[#e3e6ec] shadow-2xl p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc]">
              <h3 className="font-black text-[#2b3a4a] uppercase text-xs tracking-widest">Create New Client Account</h3>
            </div>
            <form onSubmit={handleAddClient} className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-[11px] font-black uppercase text-[#69707a]">Username</Label>
                <Input 
                  id="username" 
                  placeholder="Enter username" 
                  className="rounded-lg h-10 border-[#e3e6ec]"
                  value={newClient.username}
                  onChange={(e) => setNewClient({...newClient, username: e.target.value})}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[11px] font-black uppercase text-[#69707a]">Email Address</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@example.com" 
                  className="rounded-lg h-10 border-[#e3e6ec]"
                  value={newClient.email}
                  onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skype" className="text-[11px] font-black uppercase text-[#69707a]">Skype ID</Label>
                <Input 
                  id="skype" 
                  placeholder="live:username" 
                  className="rounded-lg h-10 border-[#e3e6ec]"
                  value={newClient.skype_id}
                  onChange={(e) => setNewClient({...newClient, skype_id: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pass" className="text-[11px] font-black uppercase text-[#69707a]">Password</Label>
                <Input 
                  id="pass" 
                  type="password" 
                  placeholder="••••••••" 
                  className="rounded-lg h-10 border-[#e3e6ec]"
                  value={newClient.password}
                  onChange={(e) => setNewClient({...newClient, password: e.target.value})}
                  required 
                />
              </div>
              <DialogFooter className="pt-4 gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsAddDialogOpen(false)} className="text-[#69707a] font-bold text-xs uppercase">Cancel</Button>
                <Button type="submit" disabled={submitting} className="bg-[#0061f2] hover:bg-[#0052ce] text-white font-bold text-xs uppercase px-8">{submitting ? "Creating..." : "Create Account"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>


      <Card className="shadow-lg border-[#e3e6ec] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e3e6ec] bg-[#f8f9fc] flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="font-black text-[#69707a] uppercase text-[11px] tracking-widest">Client List</h3>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-[11px] font-black text-[#69707a] uppercase whitespace-nowrap">Search:</span>
            <div className="relative w-full sm:w-64">
              <Input 
                className="h-9 bg-white border-[#e3e6ec] text-[13px] pl-3 pr-10 focus:ring-[#0061f2] rounded-lg"
                placeholder="Type to search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a7aeb8]">
                <Users size={14} />
              </div>
            </div>
          </div>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-none bg-[#f8f9fc] hover:bg-[#f8f9fc]">
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Username</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Email</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Skype</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4">Status</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-[#69707a] px-6 py-4 text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-[#0061f2] border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm text-[#69707a] font-medium">Loading clients data...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredClients?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-[#69707a] text-[13px] italic font-medium">
                      {searchTerm ? "No clients match your search" : "No clients found in the database"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients?.map((client, idx) => (
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
