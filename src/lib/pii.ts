// PII redaction (backend plan 0.7). Runs before any model call and before a report is stored/published.
// Heuristic, so it favours removing too much over too little. It does not catch names or addresses.

export type PiiKind = "phone" | "email" | "id";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const D = "[0-9০-৯]"; // Bangla or English digit
const SEP = "[\\s\\-.]?";

const toAscii = (s: string) => s.replace(/[০-৯]/g, (c) => String(BN_DIGITS.indexOf(c)));

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Bangladesh mobile: +8801XXXXXXXXX, 8801XXXXXXXXX, 01XXXXXXXXX (operator digit 3-9), optional separators.
const PHONE = new RegExp(`(?<!${D})(?:\\+?${SEP}(?:88|৮৮)${SEP})?(?:0|০)${SEP}(?:1|১)${SEP}[3-9৩-৯]${D}(?:${SEP}${D}){7}(?!${D})`, "g");
// National ID (10, 13 or 17 digits) and other long digit runs such as card numbers (up to 19).
const LONG_ID = new RegExp(`(?<!${D})${D}(?:${SEP}${D}){9,18}(?!${D})`, "g");

const LABEL: Record<PiiKind, string> = {
  phone: "[ফোন নম্বর সরানো হয়েছে]",
  email: "[ইমেইল সরানো হয়েছে]",
  id: "[আইডি নম্বর সরানো হয়েছে]",
};

export function redactPii(text: string): { text: string; found: PiiKind[] } {
  const found = new Set<PiiKind>();
  let out = text.replace(EMAIL, () => (found.add("email"), LABEL.email));
  out = out.replace(PHONE, () => (found.add("phone"), LABEL.phone));
  out = out.replace(LONG_ID, (m) => {
    const digits = toAscii(m).replace(/\D/g, "");
    if (digits.length < 10) return m;
    found.add("id");
    return LABEL.id;
  });
  return { text: out, found: [...found] };
}
