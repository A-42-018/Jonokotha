/** Joins class names, skipping falsy values. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Visible keyboard focus ring shared by every interactive primitive. */
export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic";
/** Focus ring that stays visible on the deep green header band. */
export const ringOnDark = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/** Fills `{name}` placeholders in a dictionary string. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));
}
