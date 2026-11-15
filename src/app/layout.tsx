import type { Metadata, Viewport } from "next";
import { Anek_Bangla, Hind_Siliguri } from "next/font/google";
import "./globals.css";
import AccountMenu from "@/components/AccountMenu";
import ConstituencyPicker from "@/components/ConstituencyPicker";
import RegisterSW from "@/components/RegisterSW";
import MainShell from "@/components/ui/MainShell";
import OfflineBanner from "@/components/ui/OfflineBanner";
import TopNav from "@/components/ui/TopNav";
import { getConstituencyId } from "@/lib/constituency-server";
import { currentUser } from "@/lib/supabase/server";
import { dict, getLang } from "@/lib/i18n";

const head = Anek_Bangla({ variable: "--font-head", subsets: ["bengali", "latin"] });
const body = Hind_Siliguri({ variable: "--font-body", subsets: ["bengali", "latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "জনকথা — Jonokotha",
  description: "আপনার এলাকার সমস্যা, সরাসরি জনপ্রতিনিধির কাছে",
};
export const viewport: Viewport = { themeColor: "#1d5fa8" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  const t = dict[lang];
  let email: string | null = null;
  let isStaff = false;
  try {
    const { user, isStaff: staff } = await currentUser();
    email = user?.email ?? null;
    isStaff = staff;
  } catch { /* Supabase not configured: show signed-out header */ }
  return (
    <html lang={lang} className={`${head.variable} ${body.variable}`}>
      <body className="min-h-screen">
        <TopNav
          t={t}
          isStaff={isStaff}
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
              isStaff={isStaff}
              labels={{ account: t.account, signIn: t.signIn, signOut: t.signOut, signingOut: t.signingOut, staff: t.staffRole }}
            />
          }
        />
        <OfflineBanner />
        <RegisterSW />
        <MainShell>{children}</MainShell>
      </body>
    </html>
  );
}
