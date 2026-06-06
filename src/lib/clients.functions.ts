import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateClientSchema = z.object({
  username: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain letters, numbers, _ . -"),
  password: z.string().min(6).max(128),
  email: z.string().email().max(255).optional().or(z.literal("")),
  skype_id: z.string().max(120).optional().or(z.literal("")),
});

export const createClientAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateClientSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const agentId = context.userId;
    const authEmail = `${data.username.toLowerCase()}@client.imssms.org`;

    // Create auth user
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        username: data.username,
        role: "client",
        agent_id: agentId,
      },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message || "Failed to create client auth user");
    }

    const newUserId = created.user.id;

    // Insert profile
    const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
      id: newUserId,
      username: data.username,
      role: "client",
      status: "approved",
    });
    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(profileErr.message);
    }

    // Insert client row
    const { error: clientErr } = await supabaseAdmin.from("clients").insert({
      agent_id: agentId,
      user_id: newUserId,
      username: data.username,
      email: data.email || null,
      skype_id: data.skype_id || null,
      status: "Active",
    });
    if (clientErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(clientErr.message);
    }

    return { ok: true, user_id: newUserId };
  });
