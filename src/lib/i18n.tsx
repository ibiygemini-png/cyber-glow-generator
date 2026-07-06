import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type Lang = "id" | "en";

const dict = {
  id: {
    app_name: "Alight Motion Premium Generator",
    tagline: "Generator Akun Premium Alight Motion Gratis",
    login: "Masuk",
    register: "Daftar",
    logout: "Keluar",
    phone: "Nomor HP",
    password: "Kata Sandi",
    phone_placeholder: "628xxxxxxxxxx",
    have_account: "Sudah punya akun?",
    no_account: "Belum punya akun?",
    dashboard: "Dashboard",
    total_generated: "Total Akun Premium Dibuat",
    ads_progress: "Iklan Ditonton",
    watch_ad: "Tonton Iklan",
    watching: "Menonton...",
    ads_complete: "Semua iklan selesai! Kamu bisa generate.",
    target_email: "Email Target",
    target_email_ph: "email@gmail.com",
    step1_title: "Langkah 1: Kirim Link Verifikasi",
    send_link: "Kirim Link",
    step2_title: "Langkah 2: Verifikasi Link",
    verify_link_label: "Link Verifikasi",
    verify_link_ph: "https://alightmotion.com/verify/...",
    verify: "Verifikasi & Aktifkan Premium",
    locked_notice: "Selesaikan 5 iklan untuk membuka generator.",
    how_to: "Cara Menggunakan",
    step1: "Masukkan email target yang ingin dijadikan premium.",
    step2: "Tonton 5 iklan untuk membuka fitur generator.",
    step3: "Klik Kirim Link, lalu cek email target untuk link verifikasi.",
    step4: "Tempel link verifikasi & klik Verifikasi. Akun jadi premium!",
    warning_title: "Auto Account Cleaner",
    warning_body: "Akun premium gratis yang tidak aktif selama 20 hari akan otomatis dihapus oleh sistem.",
    wa_channel: "Channel WhatsApp",
    support: "Dukungan / Donasi",
    footer_made: "Dibuat dengan estetika Cyber.",
    success_send: "Link verifikasi berhasil dikirim! Cek email.",
    success_verify: "Berhasil! Akun premium sudah aktif.",
    err_generic: "Terjadi kesalahan. Coba lagi.",
    err_phone_short: "Nomor HP minimal 8 digit.",
    err_password_short: "Kata sandi minimal 6 karakter.",
    err_email_invalid: "Email tidak valid.",
    err_link_invalid: "Link verifikasi tidak valid.",
    hero_badge: "PREMIUM // BETA v2",
  },
  en: {
    app_name: "Alight Motion Premium Generator",
    tagline: "Free Alight Motion Premium Account Generator",
    login: "Sign in",
    register: "Sign up",
    logout: "Sign out",
    phone: "Phone number",
    password: "Password",
    phone_placeholder: "628xxxxxxxxxx",
    have_account: "Already have an account?",
    no_account: "No account yet?",
    dashboard: "Dashboard",
    total_generated: "Total Premium Accounts Generated",
    ads_progress: "Ads Watched",
    watch_ad: "Watch Ad",
    watching: "Watching...",
    ads_complete: "All ads completed! Generator unlocked.",
    target_email: "Target Email",
    target_email_ph: "email@gmail.com",
    step1_title: "Step 1: Send Verification Link",
    send_link: "Send Link",
    step2_title: "Step 2: Verify Link",
    verify_link_label: "Verification Link",
    verify_link_ph: "https://alightmotion.com/verify/...",
    verify: "Verify & Activate Premium",
    locked_notice: "Complete 5 ads to unlock the generator.",
    how_to: "How to Use",
    step1: "Enter the target email you want to make premium.",
    step2: "Watch 5 ads to unlock the generator.",
    step3: "Click Send Link and check the target inbox for the verification link.",
    step4: "Paste the verification link and hit Verify. Premium activated!",
    warning_title: "Auto Account Cleaner",
    warning_body: "Free accounts inactive for 20 days are automatically deleted by the system.",
    wa_channel: "WhatsApp Channel",
    support: "Support / Donation",
    footer_made: "Crafted with a cyber aesthetic.",
    success_send: "Verification link sent! Check your inbox.",
    success_verify: "Success! Premium account is now active.",
    err_generic: "Something went wrong. Try again.",
    err_phone_short: "Phone number must be at least 8 digits.",
    err_password_short: "Password must be at least 6 characters.",
    err_email_invalid: "Invalid email.",
    err_link_invalid: "Invalid verification link.",
    hero_badge: "PREMIUM // BETA v2",
  },
} as const;

type Dict = typeof dict["id"];

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: keyof Dict) => string;
}

const LangCtx = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("id");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("am_lang");
    if (saved === "id" || saved === "en") setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem("am_lang", l);
  };

  const t = (k: keyof Dict) => dict[lang][k];

  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export function useI18n() {
  const c = useContext(LangCtx);
  if (!c) throw new Error("useI18n must be used within LanguageProvider");
  return c;
}
