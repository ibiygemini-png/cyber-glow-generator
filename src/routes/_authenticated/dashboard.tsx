import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { getTotalGenerated } from "@/lib/stats.functions";
import { sendPremiumLink, verifyPremiumLink } from "@/lib/generator.functions";
import { toast } from "sonner";
import {
  Zap, Globe, LogOut, PlayCircle, Send, ShieldCheck, ChevronDown,
  AlertTriangle, MessageCircle, Heart, Sparkles, Lock, CheckCircle2,
  Loader2, X, History, Trash2, Mail, Calendar, CircleCheck, CircleX,
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
const AD_DURATION_MS = 2200; // seamless — no long timer

type HistoryItem = { date: string; email: string; status: "success" | "failed" };
const HISTORY_KEY = "am_activity_history";

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
  } catch {
    return [];
  }
}
function saveHistory(items: HistoryItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 50)));
}

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
    refetchInterval: 15_000,
  });

  const [adsWatched, setAdsWatched] = useState(0);
  const [adModalOpen, setAdModalOpen] = useState(false);
  const [adProgress, setAdProgress] = useState(0); // 0-100 for current ad
  const [showUnlockAnim, setShowUnlockAnim] = useState(false);
  const [targetEmail, setTargetEmail] = useState("");
  const [verifyLinkStr, setVerifyLinkStr] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const p = (data.user?.user_metadata?.phone as string | undefined) ?? null;
      setPhone(p);
    });
    setHistory(loadHistory());
  }, []);

  const unlocked = adsWatched >= AD_TARGET;

  const pushHistory = useCallback((email: string, status: "success" | "failed") => {
    setHistory((prev) => {
      const next = [{ date: new Date().toISOString(), email, status }, ...prev].slice(0, 50);
      saveHistory(next);
      return next;
    });
  }, []);

  // Seamless ad flow — one modal cycles through remaining ads with progress bar
  const startAds = () => {
    if (unlocked) return;
    setAdModalOpen(true);
    runAd();
  };

  const runAd = () => {
    setAdProgress(0);
    const start = performance.now();
    const step = (now: number) => {
      const pct = Math.min(100, ((now - start) / AD_DURATION_MS) * 100);
      setAdProgress(pct);
      if (pct < 100) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setAdsWatched((n) => {
          const next = Math.min(AD_TARGET, n + 1);
          if (next >= AD_TARGET) {
            setTimeout(() => {
              setAdModalOpen(false);
              setShowUnlockAnim(true);
              setTimeout(() => setShowUnlockAnim(false), 2600);
            }, 250);
          } else {
            setTimeout(() => runAd(), 300);
          }
          return next;
        });
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const closeAdModal = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setAdModalOpen(false);
    setAdProgress(0);
  };

  const validEmail = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail),
    [targetEmail],
  );

  const handleSend = async () => {
    if (!unlocked) return;
    if (!validEmail) return toast.error(t("err_email_invalid"));
    setSending(true);
    try {
      const r = (await sendFn({ data: { email: targetEmail } })) as {
        ok: boolean; status: number; data: Record<string, any>;
      };
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
      const r = (await verifyFn({
        data: { email: targetEmail, link: verifyLinkStr },
      })) as { ok: boolean; status: number; data: Record<string, any> };
      if (r.ok) {
        toast.success(t("success_verify"));
        pushHistory(targetEmail, "success");
        qc.invalidateQueries({ queryKey: ["total-generated"] });
        setVerifyLinkStr("");
      } else {
        toast.error(readMsg(r.data) ?? t("err_generic"));
        pushHistory(targetEmail, "failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("err_generic"));
      pushHistory(targetEmail, "failed");
    } finally {
      setVerifying(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <main className="grid-bg min-h-screen">
      {/* nav */}
      <header className="sticky top-0 z-20 border-b border-border/50 backdrop-blur-xl bg-background/60">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg">
              <Zap className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground truncate">Alight Motion</p>
              <p className="font-display text-sm font-semibold text-foreground -mt-0.5 truncate">Premium Gen</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {phone && (
              <span className="hidden md:inline text-xs text-muted-foreground">+{phone}</span>
            )}
            <button
              onClick={() => setLang(lang === "id" ? "en" : "id")}
              className="inline-flex items-center gap-1 rounded-full glass-soft px-2.5 py-1.5 text-[11px] font-semibold"
            >
              <Globe className="h-3.5 w-3.5" />
              {lang.toUpperCase()}
            </button>
            <button
              onClick={signOut}
              className="inline-flex items-center rounded-full glass-soft p-2 text-muted-foreground hover:text-destructive"
              title={t("logout")}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 space-y-4 animate-soft-fade-in">
        {/* Hero */}
        <section className="glass rounded-2xl p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full glass-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-3 w-3 animate-pulse-glow" />
                {t("hero_badge")}
              </div>
              <h1 className="mt-2.5 font-display text-xl sm:text-2xl font-bold text-foreground">
                {t("dashboard")}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{t("tagline")}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {t("total_generated")}
              </p>
              <p className="font-display text-3xl sm:text-4xl font-bold neon-text tabular-nums">
                {(stats?.total ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </section>

        {/* Warning — compact */}
        <section className="glass rounded-xl p-3.5 border border-yellow-400/25 flex gap-2.5">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-yellow-400 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-yellow-300">{t("warning_title")}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t("warning_body")}</p>
          </div>
        </section>

        {/* Two-column: Ads gate + Generator */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Ads gate */}
          <section className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {t("ads_progress")}
                </p>
                <p className="font-display text-xl font-bold text-foreground">
                  {adsWatched}<span className="text-muted-foreground text-sm">/{AD_TARGET}</span>
                </p>
              </div>
              {unlocked ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 border border-green-400/30 px-2.5 py-1 text-[11px] font-semibold text-green-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Unlocked
                </span>
              ) : (
                <button
                  onClick={startAds}
                  className="btn-cyber inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs"
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  {adsWatched === 0 ? t("start_ads") : t("watch_ad")}
                </button>
              )}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                style={{ width: `${(adsWatched / AD_TARGET) * 100}%` }}
              />
            </div>
          </section>

          {/* Generator */}
          <section className={`glass rounded-2xl p-5 space-y-4 relative ${!unlocked ? "opacity-70" : "animate-soft-fade-in"}`}>
            {!unlocked && (
              <div className="absolute inset-0 z-10 rounded-2xl bg-background/50 backdrop-blur-[2px] grid place-items-center">
                <div className="flex items-center gap-1.5 rounded-full glass-soft px-3 py-1.5 text-[11px] font-medium">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  {t("locked_notice")}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("target_email")}
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder={t("target_email_ph")}
                  disabled={!unlocked}
                  className="w-full rounded-lg border border-border bg-black/40 pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-primary">{t("step1_title")}</p>
              <button
                onClick={handleSend}
                disabled={!unlocked || sending}
                className="btn-cyber inline-flex w-auto items-center gap-1.5 rounded-lg px-4 py-2 text-xs"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {sending ? t("sending") : t("send_link")}
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-primary">{t("step2_title")}</p>
              <input
                type="url"
                value={verifyLinkStr}
                onChange={(e) => setVerifyLinkStr(e.target.value)}
                placeholder={t("verify_link_ph")}
                disabled={!unlocked}
                className="w-full rounded-lg border border-border bg-black/40 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={handleVerify}
                disabled={!unlocked || verifying}
                className="btn-cyber inline-flex w-auto items-center gap-1.5 rounded-lg px-4 py-2 text-xs"
              >
                {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                {verifying ? t("verifying") : t("verify")}
              </button>
            </div>
          </section>
        </div>

        {/* Activity history */}
        <section className="glass rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <History className="h-4 w-4 text-primary shrink-0" />
              <h2 className="font-display text-sm font-semibold text-foreground truncate">
                {t("history_title")}
              </h2>
            </div>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="inline-flex items-center gap-1 rounded-md glass-soft px-2 py-1 text-[11px] text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
                {t("history_clear")}
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">{t("history_empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/50">
                    <th className="py-2 pr-2 font-medium"><Calendar className="inline h-3 w-3 mr-1" />{t("history_date")}</th>
                    <th className="py-2 pr-2 font-medium">{t("history_email")}</th>
                    <th className="py-2 font-medium">{t("history_status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i} className="border-b border-border/30 last:border-0 animate-soft-fade-in">
                      <td className="py-2 pr-2 text-muted-foreground whitespace-nowrap">
                        {new Date(h.date).toLocaleString(lang === "id" ? "id-ID" : "en-US", {
                          dateStyle: "short", timeStyle: "short",
                        })}
                      </td>
                      <td className="py-2 pr-2 text-foreground truncate max-w-[180px]">{h.email}</td>
                      <td className="py-2">
                        {h.status === "success" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-300">
                            <CircleCheck className="h-3 w-3" /> {t("status_success")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                            <CircleX className="h-3 w-3" /> {t("status_failed")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* how to accordion */}
        <section className="glass rounded-2xl overflow-hidden">
          <button
            onClick={() => setHowOpen((o) => !o)}
            className="flex w-full items-center justify-between px-5 py-3.5"
          >
            <span className="font-display text-xs font-semibold text-foreground">{t("how_to")}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${howOpen ? "rotate-180" : ""}`} />
          </button>
          {howOpen && (
            <ol className="space-y-2 border-t border-border/60 px-5 py-4 text-xs text-muted-foreground animate-soft-fade-in">
              {[t("step1"), t("step2"), t("step3"), t("step4")].map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* footer */}
        <footer className="glass rounded-2xl p-4 grid gap-2.5 sm:grid-cols-2">
          <a
            href="https://whatsapp.com/channel/0029Vb8XyJkGehERjMvj1R1k"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-xl border border-green-500/25 bg-green-500/10 px-3 py-2.5 hover:border-green-500/60 transition"
          >
            <MessageCircle className="h-4 w-4 text-green-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-wider text-green-400/80">Join</p>
              <p className="text-xs font-semibold text-foreground truncate">{t("wa_channel")}</p>
            </div>
          </a>
          <a
            href="https://sociabuzz.com/masvabyystore"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-xl border border-pink-500/25 bg-pink-500/10 px-3 py-2.5 hover:border-pink-500/60 transition"
          >
            <Heart className="h-4 w-4 text-pink-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-wider text-pink-400/80">Support</p>
              <p className="text-xs font-semibold text-foreground truncate">{t("support")}</p>
            </div>
          </a>
          <p className="sm:col-span-2 text-center text-[10px] text-muted-foreground pt-1">
            © {new Date().getFullYear()} · {t("footer_made")}
          </p>
        </footer>
      </div>

      {/* Ad Modal */}
      {adModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-md p-4 animate-soft-fade-in">
          <div className="glass w-full max-w-sm rounded-2xl p-5 relative">
            <button
              onClick={closeAdModal}
              className="absolute top-3 right-3 rounded-full glass-soft p-1.5 text-muted-foreground hover:text-foreground"
              aria-label={t("ad_close")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {t("ad_modal_title")}
            </p>
            <p className="mt-1 font-display text-sm font-semibold text-foreground">
              {t("ad_of")} {Math.min(adsWatched + 1, AD_TARGET)} / {AD_TARGET}
            </p>

            {/* fake ad canvas */}
            <div className="mt-4 aspect-video w-full rounded-xl bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10 grid place-items-center overflow-hidden relative">
              <div className="absolute inset-0 grid-bg opacity-40" />
              <Sparkles className="h-8 w-8 text-primary animate-pulse-glow relative z-10" />
              <span className="absolute bottom-2 left-2 text-[9px] uppercase tracking-widest text-muted-foreground">Sponsored</span>
            </div>

            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                style={{ width: `${adProgress}%`, transition: "width 60ms linear" }}
              />
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground text-center">{t("ad_skip_soon")}</p>
          </div>
        </div>
      )}

      {/* Unlock celebration overlay */}
      {showUnlockAnim && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-md p-4">
          <div className="glass rounded-2xl p-8 text-center max-w-sm animate-celebrate">
            <div className="relative mx-auto grid h-20 w-20 place-items-center">
              <div className="absolute inset-0 rounded-full animate-ring-pulse" />
              <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-primary to-accent">
                <CheckCircle2 className="h-10 w-10 text-primary-foreground" />
              </div>
            </div>
            <h3 className="mt-5 font-display text-lg font-bold neon-text">{t("unlocked_title")}</h3>
            <p className="mt-1.5 text-xs text-muted-foreground">{t("unlocked_body")}</p>
          </div>
        </div>
      )}
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
