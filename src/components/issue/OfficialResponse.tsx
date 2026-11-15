import Card from "@/components/ui/Card";
import { fillNum, fmtDate, type Dict, type Lang } from "@/lib/i18n";

/** Public office reply. Placeholder until the API exposes one. */
export default function OfficialResponse({ t, lang, response }: { t: Dict; lang: Lang; response?: { text: string; at: string } }) {
  if (!response) {
    return (
      <Card title={t.isResponseTitle} tone="info">
        <p className="font-medium">{t.isResponseNone}</p>
        <p className="text-muted">{t.isResponseNoneBody}</p>
      </Card>
    );
  }
  return (
    <Card title={t.isResponseTitle} tone="info">
      <p className="whitespace-pre-wrap break-words">{response.text}</p>
      <p className="mt-2 text-sm text-muted">{fillNum(t.isResponseFrom, { date: fmtDate(response.at, lang) }, lang)}</p>
    </Card>
  );
}
