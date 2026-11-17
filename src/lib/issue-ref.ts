const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/**
 * Reads a reference number the way people type it (home "track a report" box): Bangla digits become ASCII, spaces or
 * underscores become hyphens, letters are upper-cased. Returns null unless it has the JK-YYYY-N shape (migration 0002).
 */
export function normaliseRef(input: string): string | null {
  const s = input
    .trim()
    .replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
    .replace(/[\s_–—]+/g, "-")
    .toUpperCase();
  return /^JK-\d{4}-\d{1,9}$/.test(s) ? s : null;
}
