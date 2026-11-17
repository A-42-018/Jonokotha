import type { Metadata, Viewport } from "next";
import { Anek_Bangla, Hind_Siliguri } from "next/font/google";
import "./globals.css";
import AccountMenu from "@/components/AccountMenu";
import ConstituencyPicker from "@/components/ConstituencyPicker";
import RegisterSW from "@/components/RegisterSW";
import BottomTabBar from "@/components/ui/BottomTabBar";
import SiteFooter from "@/components/SiteFooter";
import I18nProvider from "@/components/ui/I18nProvider";
import PersonalizationApplier from "@/components/ui/PersonalizationApplier";
import ThemeApplier from "@/components/ui/ThemeApplier";
import QueueSync from "@/components/offline/QueueSync";
import MainShell from "@/components/ui/MainShell";
import OfflineBanner from "@/components/ui/OfflineBanner";
import TopNav from "@/components/ui/TopNav";
import { ToastProvider } from "@/components/ui/Toast";
import { getArea } from "@/lib/constituency-server";
import { currentUser } from "@/lib/supabase/server";
import { dict, getLang } from "@/lib/i18n";

// preload: false keeps ~190 KB of font files from competing with the page on slow links. display: swap (redesign §3.2) so the brand
// Bangla font is used on the first visit too; with display: optional most first visits fell back to each device's own Bangla font,
// which read thin and hazy. adjustFontFallback (on by default) sizes the fallback to limit the shift when the font arrives.
// Headings use static weights: 600 for headings, 700 only for the home H1. The variable Anek Bangla file is 156 KB; single weights are far smaller.
const head = Anek_Bangla({ variable: "--font-head", subsets: ["bengali", "latin"], weight: ["600", "700"], preload: false, display: "swap" });
const body = Hind_Siliguri({ variable: "--font-body", subsets: ["bengali", "latin"], weight: ["400", "500", "600"], preload: false, display: "swap" });

/** Title and description follow the page language (the Bangla default, or English when chosen). */
export async function generateMetadata(): Promise<Metadata> {
  const t = dict[await getLang()];
  return { title: `${t.appName} — Jonokotha`, description: t.tagline };
}
export const viewport: Viewport = {
  themeColor: "#0b3d2e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  const t = dict[lang];
  let email: string | null = null;
  let isStaff = false;
  let userId: string | null = null;
  let role: "citizen" | "staff" | "admin" | null = null;
  try {
    const { user, isStaff: staff, role: r } = await currentUser();
    role = r;
    email = user?.email ?? null;
    userId = user?.id ?? null;
    isStaff = staff;
  } catch { /* Supabase not configured: show signed-out header */ }
  return (
    <html lang={lang} className={`${head.variable} ${body.variable}`}>
      <body className="min-h-screen">
        <I18nProvider lang={lang} dicts={{ [lang]: t }}>
        <TopNav
          isStaff={isStaff}
          userId={userId}
          picker={
            <ConstituencyPicker
              selected={await getArea()}
              signedIn={!!email}
              lang={lang}
              labels={{ open: t.cpOpen, choose: t.cpChoose, none: t.cpNone, title: t.cpTitle, hint: t.cpHint, sample: t.cpSample, close: t.cpClose, searchLabel: t.seSearchLabel, searchHint: t.seSearchHint, noResults: t.seNoResults, error: t.seSearchError, searching: t.seSearching, seat: t.seSeatNo, vacant: t.seVacant }}
            />
          }
          account={
            <AccountMenu
              email={email}
              role={role}
              labels={{ account: t.account, signIn: t.signIn, signOut: t.signOut, signingOut: t.signingOut, staff: t.staffRole, admin: t.roleAdmin, citizen: t.roleCitizen }}
            />
          }
        />
          <PersonalizationApplier />
          <ThemeApplier />
          <OfflineBanner />
          <RegisterSW />
          <ToastProvider>
            <QueueSync />
            <MainShell footer={<SiteFooter t={t} />}>{children}</MainShell>
          </ToastProvider>
          <BottomTabBar />
        </I18nProvider>
      </body>
    </html>
  );
}
