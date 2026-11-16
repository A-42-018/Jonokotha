/** Defines one feature's strings. `en` must have exactly the keys of `bn` (compile-time check). */
export function pair<const B extends Record<string, string>>(bn: B, en: { [K in keyof B]: string }) {
  return { bn, en } as { bn: B; en: { [K in keyof B]: string } };
}
