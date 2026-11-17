import Link from "next/link";
import { ReplayTour } from "@/components/office/OfficeTour";
import Card from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { dict, getLang } from "@/lib/i18n";
import { officePage } from "@/lib/office-page";

/** Staff help (F6.1): statuses in plain words, what never goes into public text, AI limits, the eight practice tasks and how to ask for help. Mirrors docs/aibc/pilot/onboarding-training.md. */
export default async function Page() {
  return officePage("/office/help", (t) => t.ohTitle, (t) => t.ohLead, () => <Body />);
}

async function Body() {
  const t = dict[await getLang()];
  const list = (items: string[], ordered = false) => {
    const L = ordered ? "ol" : "ul";
    return <L className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 ps-5`}>{items.map((x) => <li key={x}>{x}</li>)}</L>;
  };
  return (
    <div className="space-y-4">
      <Card title={t.ohTourTitle}><div className="space-y-3"><p>{t.ohTourBody}</p><ReplayTour /></div></Card>
      <Card title={t.ohStatusTitle}>{list([t.ohSt1, t.ohSt2, t.ohSt3, t.ohSt4, t.ohSt5, t.ohSt6])}</Card>
      <Card title={t.ohNeverTitle} tone="warning">{list([t.ohNever1, t.ohNever2, t.ohNever3, t.ohNever4])}</Card>
      <Card title={t.ohAiTitle}>{list([t.ohAi1, t.ohAi2, t.ohAi3])}</Card>
      <Card title={t.ohDangerTitle} tone="danger"><p className="font-medium">{t.ohDangerBody}</p></Card>
      <Card title={t.ohPracticeTitle}><div className="space-y-2"><p className="text-muted">{t.ohPracticeLead}</p>{list([t.ohPr1, t.ohPr2, t.ohPr3, t.ohPr4, t.ohPr5, t.ohPr6, t.ohPr7, t.ohPr8], true)}</div></Card>
      <Card title={t.ohHelpTitle}><div className="space-y-3"><p>{t.ohHelpBody}</p><Link href="/help/contact" className={buttonClass({ variant: "secondary" })}>{t.spHelpLink}</Link></div></Card>
    </div>
  );
}
