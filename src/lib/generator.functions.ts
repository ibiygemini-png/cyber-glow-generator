import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const API_BASE = "https://api.theresav.biz.id/premium/alightmotion";

const emailSchema = z.object({
  email: z.string().trim().email().max(200),
});

const verifySchema = z.object({
  email: z.string().trim().email().max(200),
  link: z.string().trim().url().max(500),
});

/** Step 1: hit the send endpoint. API key stays server-side. */
export const sendPremiumLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => emailSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.ALIGHT_API_KEY;
    if (!apiKey) throw new Error("API_KEY_MISSING");

    const url = `${API_BASE}/send?email=${encodeURIComponent(data.email)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, data: body };
    }
    return { ok: true, status: res.status, data: body };
  });

/** Step 2: verify link + on success log the generation. */
export const verifyPremiumLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => verifySchema.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.ALIGHT_API_KEY;
    if (!apiKey) throw new Error("API_KEY_MISSING");

    const url = `${API_BASE}/verify?email=${encodeURIComponent(data.email)}&link=${encodeURIComponent(data.link)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }

    if (res.ok) {
      await context.supabase.from("generation_logs").insert({
        user_id: context.userId,
        target_email: data.email,
        status: "success",
      });
      return { ok: true, status: res.status, data: body };
    }
    return { ok: false, status: res.status, data: body };
  });
