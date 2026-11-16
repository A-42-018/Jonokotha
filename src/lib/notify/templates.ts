/**
 * Email templates, Bangla first (B5.9; masterplan §15). The same facts in Bangla then English, only the generic title and the reference number
 * (nothing sensitive: lock-screen and inbox previews must not reveal report details), a link to the app, and, for non-essential types, a
 * one-click unsubscribe link (RFC 8058 style). Essential types (own report status, replies, appeals, approvals, tasks) have no unsubscribe.
 */
export const ESSENTIAL_TYPES = ["issue_status", "report_submitted", "question_reply", "appeal_answered", "approval_decision", "task_assigned", "case_assigned", "feedback_request"] as const;
export const isEssential = (type: string) => (ESSENTIAL_TYPES as readonly string[]).includes(type);

export interface EmailInput { type: string; title: string; body: string | null; en?: { title: string; body: string }; appUrl?: string; unsubscribeUrl?: string }
export function renderEmail(i: EmailInput): { subject: string; text: string } {
  const bn = [i.title, i.body ?? ""].filter(Boolean).join("\n");
  const en = i.en ? `\n\n${i.en.title}\n${i.en.body}` : "";
  const open = i.appUrl ? `\n\n${i.appUrl}/me/notifications` : "";
  const foot = !isEssential(i.type) && i.unsubscribeUrl
    ? `\n\n— এই ধরনের বার্তা আর না পেতে: ${i.unsubscribeUrl}\n— To stop this kind of message: ${i.unsubscribeUrl}` : "";
  return { subject: i.title, text: `${bn}${en}${open}${foot}`.trim() };
}
