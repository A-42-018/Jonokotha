import type { SupabaseClient } from "@supabase/supabase-js";
import { channelProvider, unitCostUsd, type Channel } from "./provider";
import { fitSms } from "./sms-length";

export const SMS_MAX_PARTS = 3;
export type SendOutcome = "sent" | "failed" | "skipped_not_configured" | "skipped_budget";

/**
 * Sends one outbound message and records it (channel_messages). A message that is not "essential" is skipped when the month's budget is used up;
 * essential ones (the confirmation of a case the citizen asked for, emergency guidance, the privacy notice) are always sent. SMS text is fitted to
 * the part budget at a grapheme boundary. The recorded cost is only filled when the operator has set a price.
 */
export async function sendChannelText(svc: SupabaseClient, o: { channel: Channel; linkId: string | null; to: string; text: string; issueRef?: string | null; essential?: boolean }): Promise<SendOutcome> {
  const provider = channelProvider(o.channel);
  const fitted = o.channel === "sms" ? fitSms(o.text, SMS_MAX_PARTS) : { text: o.text.slice(0, 1500), parts: 1, truncated: false };
  const rec = async (status: "sent" | "failed" | "skipped", note: string | null, extra: { id?: string; cost?: number | null } = {}) => {
    await svc.from("channel_messages").insert({ link_id: o.linkId, channel: o.channel, direction: "out", provider_message_id: extra.id ?? null, body: fitted.text, segments: fitted.parts,
      cost_usd: status === "sent" ? extra.cost ?? null : null, status, note, issue_ref: o.issueRef ?? null });
  };
  if (!provider) { await rec("skipped", "not_configured"); return "skipped_not_configured"; }
  if (!o.essential) {
    const { data: allowed } = await svc.rpc("channel_send_allowed", { p_channel: o.channel });
    if (allowed === false) { await rec("skipped", "budget_reached"); return "skipped_budget"; }
  }
  const r = await provider.send(o.to, fitted.text);
  if (!r.ok) { await rec("failed", r.error ?? "error"); return "failed"; }
  await rec("sent", fitted.truncated ? "truncated" : null, { id: r.id, cost: unitCostUsd(o.channel, fitted.parts) });
  return "sent";
}
