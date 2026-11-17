/**
 * Feature flags for navigation. Read at build time (NEXT_PUBLIC_*). Everything defaults to off, so a route that is not ready never gets a link
 * in production. Only the flags that the menus on every page need are here (they are in the first-load JavaScript); the others are in
 * `flags-more.ts`, which only the screens that use them load. Release 1.1 pages (masterplan 7.14 to 7.16, 4.3) stay behind a flag until the
 * server routes (backend Phase 7, migrations 0070-0074) are live on the environment.
 * Set NEXT_PUBLIC_FLAG_<NAME>=1, or NEXT_PUBLIC_FLAG_RELEASE11=1 to switch on every Release 1.1 flag at once.
 * Each variable is written out in full: Next.js only replaces `process.env.NEXT_PUBLIC_X` when it appears literally.
 */
const all = process.env.NEXT_PUBLIC_FLAG_RELEASE11 === "1";

export const FLAGS = {
  consultations: all || process.env.NEXT_PUBLIC_FLAG_CONSULTATIONS === "1",
  commitments: all || process.env.NEXT_PUBLIC_FLAG_COMMITMENTS === "1",
  priorities: all || process.env.NEXT_PUBLIC_FLAG_PRIORITIES === "1",
} as const;
