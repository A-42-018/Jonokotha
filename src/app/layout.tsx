import type { Metadata, Viewport } from "next";
import { Anek_Bangla, Hind_Siliguri } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";
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
  return (
    <html lang={lang} className={`${head.variable} ${body.variable}`}>
      <body className="min-h-screen">
        <header className="flex items-center justify-between gap-3 bg-white px-4 py-3 shadow-sm">
          <Link href="/" className="flex items-center gap-2 font-heading text-xl font-semibold text-civic">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/illustrations/logo-mark.svg" alt="" className="h-8 w-8" />
            {t.appName}
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full bg-amber/20 px-2 py-0.5 text-xs text-amber-900">{t.demoBadge}</span>
            <a href="/lang" className="font-medium text-civic underline">{t.switchLang}</a>
          </div>
        </header>
        <RegisterSW />
        <main className="mx-auto w-full max-w-3xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
