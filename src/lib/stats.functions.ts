import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Public: total count of successfully generated premium accounts. */
export const getTotalGenerated = createServerFn({ method: "GET" }).handler(
  async () => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { count, error } = await supabase
      .from("generation_logs")
      .select("*", { count: "exact", head: true })
      .eq("status", "success");
    if (error) return { total: 0 };
    return { total: count ?? 0 };
  },
);
