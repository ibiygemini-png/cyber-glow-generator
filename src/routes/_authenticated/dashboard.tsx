import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { getTotalGenerated } from "@/lib/stats.functions";
import { sendPremiumLink, verifyPremiumLink } from "@/lib/generator.functions";
import { toast } from "sonner";
import {
  Zap, Globe, LogOut, PlayCircle, Send, ShieldCheck,
  ChevronDown, AlertTriangle, MessageCircle, Heart, Sparkles, Lock, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Alight Motion Premium Generator" },
      { name: "description", content: "Generate a free Alight Motion Premium account after watching 5 ads." },
    ],
  }),
  component: Dashboard,
});

const AD_TARGET = 5;
const AD_SECONDS = 5;

function Dashboard() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const totalFn = useServerFn(getTotalGenerated);
  const sendFn = useServerFn(sendPremiumLink);
  const verifyFn = useServerFn(verifyPremiumLink);

  const { data: stats } = useQuery({
    queryKey: ["total-generated"],
    queryFn: () => totalFn(),
    refetchInterval: 10_000,
  });

  const [adsWatched, setAdsWatched] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [targetEmail, setTargetEmail] = useState("");
  const [verifyLinkStr, setVerifyLinkStr] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [howOpen, setHowOpen] = useState(true);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const p = (data.user?.user_metadata?.phone as string | undefined) ?? null;
      setPhone(p);
    });
  }, []);

  const unlocked = adsWatched >= AD_TARGET;

  const watchAd = () => {
    if (countdown > 0 || unlocked) return;
    setCountdown(AD_SECONDS);
    const iv = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(iv);
          setAdsWatched((n) => Math.min(AD_TARGET, n + 1));
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const validEmail = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail), [targetEmail]);

  const handleSend = async () => {
    if (!unlocked) return;
    if (!validEmail) return toast.error(t("err_email_invalid"));
    setSending(true);
    try {
      const r = await sendFn({ data: { email: targetEmail } });
      if (r.ok) toast.success(t("success_send"));
      else toast.error(readMsg(r.data) ?? t("err_generic"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("err_generic"));
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (!unlocked) return;
    if (!validEmail) return toast.error(t("err_email_invalid"));
    if (!/^https?:\/\//.test(verifyLinkStr)) return toast.error(t("err_link_invalid"));
    setVerifying(true);
    try {
      const r = await verifyFn({ data: { email: targetEmail, link: verifyLinkStr } });
      if (r.ok) {
        toast.success(t("success_verify"));
        qc.invalidateQueries({ queryKey: ["total-generated"] });
        setVerifyLinkStr("");
      } else {
        toast.error(readMsg(r.data) ?? t("err_generic"));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("err_generic"));
    } finally {
      setVerifying(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <main className="grid-bg min-h-screen">
      {/* nav */}
      <header className="sticky top-0 z-20 border-b border-border/50 backdrop-blur-xl bg-background/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Alight Motion</p>
              <p className="font-display text-sm font-bold text-foreground -mt-0.5">Premium Gen</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {phone && (
              <span className="hidden sm:inline text-xs text-muted-foreground">+{phone}</span>
            )}
            <button
              onClick={() => setLang(lang === "id" ? "en" : "id")}
              className="flex items-center gap-1.5 rounded-full glass-soft px-3 py-1.5 text-xs font-semibold"
            >
              <Globe className="h-3.5 w-3.5" />
              {lang.toUpperCase()}
            </button>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 rounded-full glass-soft px-3 py-1.5 text-xs font-semibold text-destructive-foreground/90 hover:text-destructive"
              title={t("logout")}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* hero + counter */}
        <section className="glass rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full glass-soft px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                <Sparkles className="h-3 w-3 animate-pulse-glow" />
                {t("hero_badge")}
              </div>
              <h1 className="mt-3 font-display text-2xl sm:text-3xl font-bold text-foreground">
                {t("dashboard")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("tagline")}</p>
            </div>
            <div className="w-full sm:w-auto text-left sm:text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {t("total_generated")}
              </p>
              <p className="font-display text-4xl sm:text-5xl font-bold neon-text tabular-nums">
                {(stats?.total ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </section>

        {/* warning */}
        <section className="glass rounded-2xl p-5 border border-yellow-400/30 flex gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-400 mt-0.5" />
          <div>
            <p className="font-display text-sm font-bold text-yellow-300">{t("warning_title")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("warning_body")}</p>
          </div>
        </section>

        {/* ads gate */}
        <section className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {t("ads_progress")}
              </p>
              <p className="font-display text-2xl font-bold text-foreground">
                {adsWatched}<span className="text-muted-foreground">/{AD_TARGET}</span>
              </p>
            </div>
            <button
              onClick={watchAd}
              disabled={countdown > 0 || unlocked}
              className="btn-cyber inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm"
            >
              <PlayCircle className="h-4 w-4" />
              {unlocked
                ? "✓"
                : countdown > 0
                ? `${t("watching")} ${countdown}s`
                : t("watch_ad")}
            </button>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
              style={{ width: `${(adsWatched / AD_TARGET) * 100}%` }}
            />
          </div>
          {unlocked && (
            <p className="mt-3 flex items-center gap-2 text-xs text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t("ads_complete")}
            </p>
          )}
        </section>

        {/* generator */}
        <section className={`glass rounded-2xl p-6 space-y-5 relative ${!unlocked ? "opacity-60" : ""}`}>
          {!unlocked && (
            <div className="absolute inset-0 z-10 rounded-2xl bg-background/40 backdrop-blur-[2px] grid place-items-center pointer-events-auto">
              <div className="flex items-center gap-2 rounded-full glass-soft px-4 py-2 text-xs font-semibold">
                <Lock className="h-4 w-4 text-primary" />
                {t("locked_notice")}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("target_email")}
            </label>
            <input
              type="email"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              placeholder={t("target_email_ph")}
              disabled={!unlocked}
              className="w-full rounded-lg border border-border bg-black/40 px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed"
            />
          </div>

          <div className="rounded-xl border border-border/60 bg-black/30 p-4 space-y-3">
            <p className="font-display text-sm font-bold text-primary">{t("step1_title")}</p>
            <button
              onClick={handleSend}
              disabled={!unlocked || sending}
              className="btn-cyber inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm"
            >
              <Send className="h-4 w-4" />
              {sending ? "..." : t("send_link")}
            </button>
          </div>

          <div className="rounded-xl border border-border/60 bg-black/30 p-4 space-y-3">
            <p className="font-display text-sm font-bold text-primary">{t("step2_title")}</p>
            <input
              type="url"
              value={verifyLinkStr}
              onChange={(e) => setVerifyLinkStr(e.target.value)}
              placeholder={t("verify_link_ph")}
              disabled={!unlocked}
              className="w-full rounded-lg border border-border bg-black/40 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={handleVerify}
              disabled={!unlocked || verifying}
              className="btn-cyber inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm"
            >
              <ShieldCheck className="h-4 w-4" />
              {verifying ? "..." : t("verify")}
            </button>
          </div>
        </section>

        {/* how to accordion */}
        <section className="glass rounded-2xl overflow-hidden">
          <button
            onClick={() => setHowOpen((o) => !o)}
            className="flex w-full items-center justify-between px-6 py-4"
          >
            <span className="font-display text-sm font-bold text-foreground">{t("how_to")}</span>
            <ChevronDown className={`h-5 w-5 transition-transform ${howOpen ? "rotate-180" : ""}`} />
          </button>
          {howOpen && (
            <ol className="space-y-2 border-t border-border/60 px-6 py-4 text-sm text-muted-foreground">
              {[t("step1"), t("step2"), t("step3"), t("step4")].map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* footer */}
        <footer className="glass rounded-2xl p-6 grid gap-3 sm:grid-cols-2">
          <a
            href="https://whatsapp.com/channel/0029Vb8XyJkGehERjMvj1R1k"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 hover:border-green-500/60 transition"
          >
            <MessageCircle className="h-5 w-5 text-green-400" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-green-400/80">Join</p>
              <p className="text-sm font-semibold text-foreground">{t("wa_channel")}</p>
            </div>
          </a>
          <a
            href="https://sociabuzz.com/masvabyystore"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-pink-500/30 bg-pink-500/10 px-4 py-3 hover:border-pink-500/60 transition"
          >
            <Heart className="h-5 w-5 text-pink-400" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-pink-400/80">Support</p>
              <p className="text-sm font-semibold text-foreground">{t("support")}</p>
            </div>
          </a>
          <p className="sm:col-span-2 text-center text-[11px] text-muted-foreground pt-2">
            © {new Date().getFullYear()} · {t("footer_made")}
          </p>
        </footer>
      </div>
    </main>
  );
}

function readMsg(data: unknown): string | null {
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    for (const k of ["message", "error", "msg", "status"]) {
      const v = rec[k];
      if (typeof v === "string") return v;
    }
  }
  return null;
}
