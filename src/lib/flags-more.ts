import { FLAGS as NAV } from "./flags";

const all = process.env.NEXT_PUBLIC_FLAG_RELEASE11 === "1";

/** The Release 1.1 flags that are not in the menus (see flags.ts for how they are read). */
export const FLAGS = {
  ...NAV,
  surveys: all || process.env.NEXT_PUBLIC_FLAG_SURVEYS === "1",
  /** Office pages for Release 1.1 (consultation composer, exports, release indicators, idea policy). */
  officeRelease11: all || process.env.NEXT_PUBLIC_FLAG_OFFICE_RELEASE11 === "1",
  /** WhatsApp and SMS number linking in Settings and the "report by message" page. Also needs the provider accounts (docs/aibc/release11/open-items.md). */
  channels: all || process.env.NEXT_PUBLIC_FLAG_CHANNELS === "1",
  /** Read-aloud buttons. The browser voice is the fallback, so this can be on without a server voice. */
  readAloud: all || process.env.NEXT_PUBLIC_FLAG_READ_ALOUD === "1",
  /** Dark theme choice in Settings. */
  darkMode: all || process.env.NEXT_PUBLIC_FLAG_DARK_MODE === "1",
} as const;
