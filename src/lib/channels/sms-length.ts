/**
 * SMS length budget (B7.2; masterplan §19.7). Bangla (and any character outside the GSM 7-bit alphabet) forces UCS-2 encoding:
 * 70 UTF-16 units in one message, 67 per part when split. GSM text: 160 and 153. Costs are per part, so the budget is counted in parts and
 * text is shortened at a grapheme boundary (never inside a Bangla conjunct or a vowel sign) with an ellipsis when it does not fit.
 */
const GSM = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€\f";
export type SmsEncoding = "gsm7" | "ucs2";

export function smsEncoding(text: string): SmsEncoding { return [...text].every((c) => GSM.includes(c) || GSM_EXT.includes(c)) ? "gsm7" : "ucs2"; }
/** Units used: GSM counts extension characters twice; UCS-2 counts UTF-16 code units. */
export function smsUnits(text: string): number {
  return smsEncoding(text) === "gsm7" ? [...text].reduce((n, c) => n + (GSM_EXT.includes(c) ? 2 : 1), 0) : text.length;
}
export function smsParts(text: string): number {
  const u = smsUnits(text), enc = smsEncoding(text);
  const [one, many] = enc === "gsm7" ? [160, 153] : [70, 67];
  return u === 0 ? 0 : u <= one ? 1 : Math.ceil(u / many);
}
export function fitSms(text: string, maxParts = 3): { text: string; parts: number; truncated: boolean } {
  if (smsParts(text) <= maxParts) return { text, parts: smsParts(text), truncated: false };
  const seg = new Intl.Segmenter("bn", { granularity: "grapheme" });
  const graphemes = [...seg.segment(text)].map((s) => s.segment);
  let out = "";
  for (const g of graphemes) { if (smsParts(out + g + "…") > maxParts) break; out += g; }
  const t = out.trimEnd() + "…";
  return { text: t, parts: smsParts(t), truncated: true };
}
