import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import ReviewQueue from "@/components/admin/ReviewQueue";
import IssueView from "@/components/issue/IssueView";
import AnnouncementComposer from "@/components/office/AnnouncementComposer";
import AuditList from "@/components/office/AuditList";
import CaseTable from "@/components/office/CaseTable";
import Copilot from "@/components/office/Copilot";
import NotesAndAssign from "@/components/office/NotesAndAssign";
import OfficeActions from "@/components/office/OfficeActions";
import Overview from "@/components/office/Overview";
import ReportForm from "@/components/ReportForm";
import { SAMPLE_REVIEW } from "@/lib/admin";
import { DEMO_CONSTITUENCY } from "@/lib/demo-data";
import { dict, getLang } from "@/lib/i18n";
import { auditFromTimeline } from "@/lib/office-actions";
import { overviewStats } from "@/lib/office";
import type { CaseRecord } from "@/lib/types";

const at = (d: number) => new Date(Date.UTC(2026, 10, 16 - d, 6, 0)).toISOString();
const base = { constituencyId: DEMO_CONSTITUENCY.id, ai: { summary: "নমুনা সারাংশ", similarRefs: [], agencyId: "demo-agency", confidence: 0.82 } };
const DEMO_CASES: CaseRecord[] = [
  { ...base, ref: "JK-DEMO-1", title: "রাস্তায় বড় গর্ত (নমুনা)", category: "roads", description: "নমুনা বিবরণ: বাজারের সামনে রাস্তায় বড় গর্ত।", area: "ওয়ার্ড ৩ (নমুনা)", status: "received", createdAt: at(1), timeline: [{ status: "received", at: at(1) }] },
  { ...base, ref: "JK-DEMO-2", title: "ড্রেন বন্ধ (নমুনা)", category: "drainage", description: "নমুনা বিবরণ।", area: "ওয়ার্ড ৪ (নমুনা)", status: "acknowledged", createdAt: at(3), timeline: [{ status: "received", at: at(3) }, { status: "acknowledged", at: at(2) }] },
  { ...base, ref: "JK-DEMO-3", title: "বাতি জ্বলে না (নমুনা)", category: "electricity", description: "নমুনা বিবরণ।", area: "ওয়ার্ড ২ (নমুনা)", status: "resolved", createdAt: at(12), timeline: [{ status: "received", at: at(12) }, { status: "resolved", at: at(5) }] },
];

/**
 * Audit-only screens: signed-in pages rendered with labelled demo data, so axe, screenshots and
 * screen-reader passes can run without a Supabase session. Not in production unless JK_AUDIT=1 is set explicitly.
 */
export default async function DevScreen({ params }: PageProps<"/dev/screens/[name]">) {
  if (process.env.NODE_ENV === "production" && process.env.JK_AUDIT !== "1") notFound();
  const { name } = await params;
  const lang = await getLang();
  const t = dict[lang];
  const c = DEMO_CASES[0];
  switch (name) {
    case "report":
      return <ReportForm t={t} lang={lang} constituencyId={DEMO_CONSTITUENCY.id} />;
    case "issue":
      return <IssueView c={DEMO_CASES[1]} t={t} lang={lang} signedIn />;
    case "office":
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold text-civic">{t.odOverview}</h1>
          <Overview o={overviewStats(DEMO_CASES, Date.UTC(2026, 10, 16))} t={t} lang={lang} />
          <CaseTable cases={DEMO_CASES} />
        </div>
      );
    case "case":
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold text-civic">{c.title}</h1>
          <AuditList entries={auditFromTimeline(c.timeline)} t={t} lang={lang} />
          <NotesAndAssign cref={c.ref} />
          <Copilot c={c} agency={undefined} />
          <OfficeActions cref={c.ref} status={c.status} enabled={["acknowledge", "refer"]} />
        </div>
      );
    case "announcements":
      return <div className="space-y-4"><h1 className="text-2xl font-semibold text-civic">{t.anTitle}</h1><AnnouncementComposer /></div>;
    case "admin-verification":
      return <AdminShell t={t} title={t.adVerifyTitle} lead={t.adVerifyLead} current="/admin/verification"><ReviewQueue kind="verification" items={SAMPLE_REVIEW} /></AdminShell>;
    case "admin-moderation":
      return <AdminShell t={t} title={t.adModTitle} lead={t.adModLead} current="/admin/moderation"><ReviewQueue kind="moderation" items={SAMPLE_REVIEW} /></AdminShell>;
    case "boom":
      throw new Error("Demo error for the error-boundary test");
    default:
      notFound();
  }
}
