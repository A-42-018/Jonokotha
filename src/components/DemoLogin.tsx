import { DEMO_ROLES, type DemoRole } from "@/lib/demo";

// TEMPORARY (dev period): one-click demo sign-in for staging. Rendered by /login only while the server env
// DEMO_LOGIN=true. Remove this file, src/lib/demo.ts, src/app/api/demo-login and the demo accounts before real users
// or judging (docs/backend-setup.md). Kept out of LoginForm so the frontend's component stays untouched.
// One button per role except admin, which is never offered.

const LABELS: Record<DemoRole, { bn: string; en: string; hintBn: string; hintEn: string }> = {
  citizen: { bn: "নাগরিক", en: "Citizen", hintBn: "সমস্যা জানান ও খোঁজ নিন", hintEn: "Report and track" },
  staff: { bn: "অফিস ম্যানেজার", en: "Office manager", hintBn: "অফিসের সব কাজ", hintEn: "Every office action" },
  officer: { bn: "কেস অফিসার", en: "Case officer", hintBn: "শুধু নিজের দায়িত্বের সমস্যা", hintEn: "Assigned cases only" },
  mp: { bn: "এমপি", en: "MP", hintBn: "দেখা, বিশ্লেষণ, অনুমোদন", hintEn: "View, analytics, approve" },
  liaison: { bn: "সংস্থার প্রতিনিধি", en: "Agency liaison", hintBn: "সংস্থায় পাঠানো সমস্যা", hintEn: "Cases sent to the agency" },
  moderator: { bn: "মডারেটর", en: "Moderator", hintBn: "রিপোর্ট হওয়া লেখা যাচাই", hintEn: "Review reported content" },
};

const TONE: Record<DemoRole, string> = {
  citizen: "border-civic text-civic",
  staff: "border-leaf-strong text-leaf-strong",
  officer: "border-leaf-strong text-leaf-strong",
  mp: "border-leaf-strong text-leaf-strong",
  liaison: "border-leaf-strong text-leaf-strong",
  moderator: "border-civic text-civic",
};

export default function DemoLogin({ bn, failed = false }: { bn: boolean; failed?: boolean }) {
  return (
    <form method="post" action="/api/demo-login" className="mt-6 space-y-2 border-t border-slate-200 pt-4">
      <p className="text-sm text-slate-600">{bn ? "ডেমো লগইন (শুধু ডেভেলপমেন্টের জন্য) — যেকোনো ভূমিকায় এক চাপে ঢুকুন" : "Demo login (development only): one click for any role"}</p>
      {failed && <p className="text-sm text-red-700" role="alert">{bn ? "ডেমো লগইন কাজ করেনি। এই ভূমিকার ডেমো অ্যাকাউন্ট হয়তো এখনো তৈরি হয়নি।" : "Demo login failed. The demo account for this role may not exist yet."}</p>}
      <div className="grid grid-cols-2 gap-2">
        {DEMO_ROLES.map((role) => {
          const l = LABELS[role];
          return (
            <button key={role} name="role" value={role} className={`flex min-h-11 flex-col items-center justify-center rounded-lg border px-3 py-2 text-center ${TONE[role]}`}>
              <span className="font-medium">{bn ? l.bn : l.en}</span>
              <span className="text-xs text-slate-600">{bn ? l.hintBn : l.hintEn}</span>
            </button>
          );
        })}
      </div>
    </form>
  );
}
