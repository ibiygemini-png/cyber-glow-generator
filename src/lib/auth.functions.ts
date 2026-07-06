import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const phoneToEmail = (phone: string) => `${phone.replace(/\D/g, "")}@am.local`;

const registerSchema = z.object({
  phone: z.string().min(8).max(20),
  password: z.string().min(6).max(72),
});

/**
 * Register a new user with phone + password ONLY (no email verification).
 * Uses a synthetic email under a private domain so we can leverage the
 * Supabase Auth session/JWT machinery, and stores the phone in profiles.
 */
export const registerWithPhone = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => registerSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = phoneToEmail(data.phone);

    // check phone unique
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", data.phone)
      .maybeSingle();

    if (existing) {
      throw new Error("PHONE_EXISTS");
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { phone: data.phone },
    });

    if (error || !created.user) {
      throw new Error(error?.message ?? "REGISTER_FAILED");
    }

    const { error: pErr } = await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      phone: data.phone,
    });

    if (pErr) {
      // rollback auth user to avoid orphan
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(pErr.message);
    }

    return { ok: true, email };
  });

/** Resolve synthetic email for a phone so the client can sign in with password. */
export const resolveLoginEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ phone: z.string().min(4) }).parse(input),
  )
  .handler(async ({ data }) => {
    return { email: phoneToEmail(data.phone) };
  });
