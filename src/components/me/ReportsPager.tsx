"use client";
import Pagination from "@/components/ui/Pagination";
import type { Lang } from "@/lib/i18n";
import { reportsHref, type StatusFilter } from "@/lib/my-reports";

/** Client wrapper: Pagination takes a function prop, which a server component cannot pass. */
export default function ReportsPager({ page, totalPages, base, filter, extra, lang }: {
  page: number;
  totalPages: number;
  base: string;
  filter: StatusFilter;
  extra?: Record<string, string>;
  lang: Lang;
}) {
  return <Pagination page={page} totalPages={totalPages} lang={lang} hrefFor={(p) => reportsHref(base, filter, p, extra)} />;
}
