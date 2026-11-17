/**
 * Feature flags that decide what shows in navigation. Read at build time (NEXT_PUBLIC_*). Everything defaults to off, so a
 * route that is not ready never gets a link in production. Consultations belong to Release 1.1 (masterplan 7.14).
 */
export const FLAGS = {
  consultations: process.env.NEXT_PUBLIC_FLAG_CONSULTATIONS === "1",
} as const;
