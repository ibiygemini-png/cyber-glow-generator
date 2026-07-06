import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { registerWithPhone, resolveLoginEmail } from "@/lib/auth.functions";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Zap, Globe } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Alight Motion Premium Generator" },
      { name: "description", content: "Sign in or sign up with your phone number to access the Alight Motion Premium Generator." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 8) return toast.error(t("err_phone_short"));
    if (password.length < 6) return toast.error(t("err_password_short"));

    setLoading(true);
    try {
      if (mode === "register") {
        await registerWithPhone({ data: { phone: cleanPhone, password } });
      }
      const { email } = await resolveLoginEmail({ data: { phone: cleanPhone } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success(mode === "register" ? "Welcome!" : "Signed in");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("err_generic");
      if (msg === "PHONE_EXISTS") toast.error("Phone already registered");
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid-bg relative flex min-h-screen items-center justify-center px-4 py-10">
      <button
        onClick={() => setLang(lang === "id" ? "en" : "id")}
        className="absolute right-4 top-4 flex items-center gap-2 rounded-full glass-soft px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/80 hover:text-foreground"
      >
        <Globe className="h-3.5 w-3.5" />
        {lang.toUpperCase()}
      </button>

      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full glass-soft px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            <Zap className="h-3 w-3 animate-pulse-glow" />
            {t("hero_badge")}
          </div>
          <h1 className="font-display text-3xl font-bold neon-text">{t("app_name")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("tagline")}</p>
        </div>

        <form onSubmit={submit} className="glass rounded-2xl p-6 space-y-4">
          <div className="flex gap-2 rounded-lg bg-black/30 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {t("login")}
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${mode === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {t("register")}
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("phone")}
            </label>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("phone_placeholder")}
              className="w-full rounded-lg border border-border bg-black/40 px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("password")}
            </label>
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-border bg-black/40 px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-cyber w-full rounded-lg py-3 text-sm"
          >
            {loading ? "..." : mode === "login" ? t("login") : t("register")}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            {mode === "login" ? t("no_account") : t("have_account")}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="font-semibold text-primary hover:underline"
            >
              {mode === "login" ? t("register") : t("login")}
            </button>
          </p>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Home</Link>
        </p>
      </div>
    </main>
  );
}
