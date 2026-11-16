import { z } from "zod";
import { ApiError, fromDbError, parse, rpc, type Ctx, type Result } from "./api";
import { adapterFor, activeCountry } from "./country";

/** GET /country: the active adapter (database configuration) plus the code-side facts. Public. */
export async function getCountry(c: Ctx): Promise<Result> {
  const active = await activeCountry(c.sb);
  const { data, error } = await c.sb.from("country_adapters").select("code,name_en,name_native,default_locale,locales,currency,date_format,timezone,admin_levels,identity_checks,notification_channels,emergency_numbers,is_active").eq("code", active.code).maybeSingle();
  if (error) throw fromDbError(error);
  return { data: { ...(data ?? {}), code: active.code, numerals: active.numerals } };
}

const Config = z.strictObject({
  name_en: z.string().trim().min(1).max(80), name_native: z.string().trim().min(1).max(80), default_locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/), locales: z.array(z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/)).min(1).max(10),
  currency: z.string().regex(/^[A-Z]{3}$/), date_format: z.string().trim().min(4).max(20), timezone: z.string().trim().min(3).max(40),
  admin_levels: z.array(z.strictObject({ level: z.string().regex(/^[a-z_]{2,20}$/), name_en: z.string().max(80), name_bn: z.string().max(80).optional() })).min(1).max(8),
  identity_checks: z.array(z.string().max(30)).max(10).default([]), notification_channels: z.array(z.string().max(30)).max(10).default([]), emergency_numbers: z.record(z.string().max(30), z.string().max(20)).default({}),
});
export async function setCountry(c: Ctx): Promise<Result> {
  if (c.actor?.role !== "admin") throw new ApiError("forbidden", "Administrators only.");
  const b = parse(z.strictObject({ code: z.string().regex(/^[A-Z]{2}$/), config: Config, activate: z.boolean().default(false) }), c.body);
  if (b.activate) { try { adapterFor(b.code); } catch { throw new ApiError("rule_not_met", "A country can be activated only after its code-side adapter (src/lib/country/) is deployed.", { code: "no_code_adapter" }); } }
  return { data: await rpc(c.sb, "set_country_adapter", { p_code: b.code, p_config: b.config, p_activate: b.activate }) };
}
