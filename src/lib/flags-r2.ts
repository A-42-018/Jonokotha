/**
 * Release 2 (Phase 8) page flags, read at build time like `flags-more.ts`. All default off; `NEXT_PUBLIC_FLAG_RELEASE2=1` turns on all of them.
 * They only decide whether a page exists. The server has its own flag per feature (`GET /features`, docs/api-v1.md "Phase 8"), and a page whose route answers
 * 404 shows "not switched on". Each variable is written out in full: Next only inlines a literal `process.env.NEXT_PUBLIC_X`.
 */
const all = process.env.NEXT_PUBLIC_FLAG_RELEASE2 === "1";

export const R2 = {
  budget: all || process.env.NEXT_PUBLIC_FLAG_BUDGET === "1",
  openData: all || process.env.NEXT_PUBLIC_FLAG_OPEN_DATA === "1",
  assisted: all || process.env.NEXT_PUBLIC_FLAG_ASSISTED === "1",
  regional: all || process.env.NEXT_PUBLIC_FLAG_REGIONAL === "1",
  budgeting: all || process.env.NEXT_PUBLIC_FLAG_BUDGETING === "1",
  rti: all || process.env.NEXT_PUBLIC_FLAG_RTI === "1",
  mpRecords: all || process.env.NEXT_PUBLIC_FLAG_MP_RECORDS === "1",
  /** Admin pages of Release 2 (budget verification, MP records, regional administrators, country readiness, agency keys). */
  admin: all || process.env.NEXT_PUBLIC_FLAG_R2_ADMIN === "1",
} as const;
