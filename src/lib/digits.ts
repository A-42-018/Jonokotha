/** Bangla (০-৯) and Arabic-Indic (٠-٩) digits to ASCII (B5.11). Used for OTP codes, phone numbers and any numeric field a person types. */
export function normalizeDigits(s: string): string {
  return s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}
/** One-time code as typed: digits normalised, spaces and dashes removed. */
export const normalizeOtp = (s: string) => normalizeDigits(s).replace(/[\s-]/g, "");
/** Digits for display in the person's numeral style (preference `numeral_style`). */
export function formatNumerals(n: number | string, style: "bn" | "en"): string {
  const s = String(n);
  return style === "bn" ? s.replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]) : normalizeDigits(s);
}
