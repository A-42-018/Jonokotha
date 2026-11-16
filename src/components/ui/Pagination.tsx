"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { fillNum } from "@/lib/format";
import { type Lang } from "@/lib/i18n";
import { cx, focusRing } from "./cx";
import { useLang } from "./useLang";
import { useT } from "./useT";

const base = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-3 font-medium";

/** Page window: first, last, current ±1, with gaps between. */
function windowed(page: number, total: number): Array<number | "gap"> {
  const keep = new Set([1, total, page - 1, page, page + 1].filter((n) => n >= 1 && n <= total));
  const out: Array<number | "gap"> = [];
  let last = 0;
  for (const n of [...keep].sort((a, b) => a - b)) {
    if (n - last > 1) out.push("gap");
    out.push(n);
    last = n;
  }
  return out;
}

function PageItem({ target, label, current, disabled, hrefFor, onPageChange, children }: {
  target: number;
  label: string;
  current?: boolean;
  disabled?: boolean;
  hrefFor?: (page: number) => string;
  onPageChange?: (page: number) => void;
  children: ReactNode;
}) {
  const cls = cx(base, current ? "border-civic bg-civic text-white" : "border-line bg-white text-civic", disabled && "pointer-events-none opacity-50", focusRing);
  if (hrefFor && !disabled) {
    return <Link href={hrefFor(target)} aria-label={label} aria-current={current ? "page" : undefined} className={cls}>{children}</Link>;
  }
  return (
    <button type="button" disabled={disabled} aria-label={label} aria-current={current ? "page" : undefined} onClick={() => onPageChange?.(target)} className={cls}>
      {children}
    </button>
  );
}

/**
 * Page navigation. Give `hrefFor` for URL-driven lists (links) or `onPageChange` for client state (buttons).
 * Page numbers use Bangla digits in bn.
 */
export default function Pagination({ page, totalPages, hrefFor, onPageChange, lang }: {
  page: number;
  totalPages: number;
  hrefFor?: (page: number) => string;
  onPageChange?: (page: number) => void;
  lang?: Lang;
}) {
  const t = useT(lang);
  const l = useLang(lang);
  if (totalPages <= 1) return null;
  const nav = { hrefFor, onPageChange };
  return (
    <nav aria-label={t.uiPagination} className="flex flex-wrap items-center justify-center gap-2">
      <PageItem {...nav} target={page - 1} disabled={page <= 1} label={t.uiPrev}>
        <span aria-hidden className="rtl:rotate-180">‹</span>
        <span className="ms-1 hidden sm:inline">{t.uiPrev}</span>
      </PageItem>
      {windowed(page, totalPages).map((n, i) =>
        n === "gap" ? (
          <span key={`gap${i}`} aria-hidden className="px-1 text-muted">…</span>
        ) : (
          <PageItem key={n} {...nav} target={n} current={n === page} label={fillNum(t.uiPageN, { n }, l)}>{fillNum("{n}", { n }, l)}</PageItem>
        ),
      )}
      <PageItem {...nav} target={page + 1} disabled={page >= totalPages} label={t.uiNext}>
        <span className="me-1 hidden sm:inline">{t.uiNext}</span>
        <span aria-hidden className="rtl:rotate-180">›</span>
      </PageItem>
    </nav>
  );
}
