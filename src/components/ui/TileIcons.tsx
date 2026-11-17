import type { ReactNode } from "react";

/**
 * Filled two-tone "vector" icons used on stat tiles and action cards. One 48px grid, one corner style, decorative only
 * (callers always print the label next to them). Colours are tints and strokes, never the only carrier of meaning.
 */
function Tile({ children, className = "size-12" }: { children: ReactNode; className?: string }) {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden focusable="false" className={className}>{children}</svg>;
}

export const IssuesIcon = ({ className }: { className?: string }) => (
  <Tile className={className}><rect x="5" y="7" width="38" height="28" rx="8" fill="#dbeafe" stroke="#1d5fa8" strokeWidth="2.5" /><path d="M14 35v7l9-7" fill="#dbeafe" stroke="#1d5fa8" strokeWidth="2.5" strokeLinejoin="round" /><circle cx="16" cy="21" r="2.6" fill="#1d5fa8" /><circle cx="24" cy="21" r="2.6" fill="#1d5fa8" /><circle cx="32" cy="21" r="2.6" fill="#1d5fa8" /></Tile>
);
export const ResolvedIcon = ({ className }: { className?: string }) => (
  <Tile className={className}><circle cx="24" cy="24" r="19" fill="#dcfce7" stroke="#287a44" strokeWidth="2.5" /><path d="m15 25 6.5 6.5L33.5 18" stroke="#287a44" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></Tile>
);
export const ProgressIcon = ({ className }: { className?: string }) => (
  <Tile className={className}><circle cx="24" cy="24" r="19" fill="#fef3c7" stroke="#b45309" strokeWidth="2.5" /><path d="M24 12v12l8 5" stroke="#b45309" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></Tile>
);
export const IdeasIcon = ({ className }: { className?: string }) => (
  <Tile className={className}><path d="M24 5a13 13 0 0 0-7.5 23.6c1.2.9 2 2.3 2 3.8V34h11v-1.6c0-1.5.8-2.9 2-3.8A13 13 0 0 0 24 5Z" fill="#fef3c7" stroke="#b45309" strokeWidth="2.5" strokeLinejoin="round" /><path d="M19 39h10M21 43h6" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" /></Tile>
);
export const AlertIcon = ({ className }: { className?: string }) => (
  <Tile className={className}><path d="M24 5 3.5 41h41L24 5Z" fill="#fee2e2" stroke="#b42318" strokeWidth="2.5" strokeLinejoin="round" /><path d="M24 18v10" stroke="#b42318" strokeWidth="4" strokeLinecap="round" /><circle cx="24" cy="34" r="2.4" fill="#b42318" /></Tile>
);
export const AskIcon = ({ className }: { className?: string }) => (
  <Tile className={className}><rect x="5" y="8" width="38" height="26" rx="9" fill="#ede9fe" stroke="#6d28d9" strokeWidth="2.5" /><path d="M15 34v8l9-8" fill="#ede9fe" stroke="#6d28d9" strokeWidth="2.5" strokeLinejoin="round" /><path d="M15 17h18M15 24h10" stroke="#6d28d9" strokeWidth="3" strokeLinecap="round" /></Tile>
);
export const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" className="size-5 shrink-0 rtl:rotate-180"><path d="m9 6 6 6-6 6" /></svg>
);
