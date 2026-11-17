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
import QueueSync from "@/components/offline/QueueSync";
import MainShell from "@/components/ui/MainShell";
import OfflineBanner from "@/components/ui/OfflineBanner";
import TopNav from "@/components/ui/TopNav";
import { ToastProvider } from "@/components/ui/Toast";
import { getConstituencyId } from "@/lib/constituency-server";
import { currentUser } from "@/lib/supabase/server";
import { dict, getLang } from "@/lib/i18n";

// preload: false keeps ~190 KB of font files from competing with the page on slow links; display: optional means a slow font never swaps in mid-read (no layout shift): the page keeps the system font for that visit and the brand font is used once cached.
// Headings use one static weight: the variable Anek Bangla file (all weights and widths) is 156 KB, a single weight is far smaller.
const head = Anek_Bangla({ variable: "--font-head", subsets: ["bengali", "latin"], weight: ["600"], preload: false, display: "optional" });
const body = Hind_Siliguri({ variable: "--font-body", subsets: ["bengali", "latin"], weight: ["400", "500", "600"], preload: false, display: "optional" });

/** Title and description follow the page language (the Bangla default, or English when chosen). */
export async function generateMetadata(): Promise<Metadata> {
  const t = dict[await getLang()];
  return { title: `${t.appName} — Jonokotha`, description: t.tagline };
}
export const viewport: Viewport = {
  themeColor: "#1d5fa8",
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
              selectedId={await getConstituencyId()}
              signedIn={!!email}
              lang={lang}
              labels={{ open: t.cpOpen, choose: t.cpChoose, none: t.cpNone, title: t.cpTitle, hint: t.cpHint, sample: t.cpSample, close: t.cpClose }}
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
