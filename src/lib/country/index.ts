import type { SupabaseClient } from "@supabase/supabase-js";
import { BANGLADESH } from "./bd";

/**
 * Country adapters (B5.12; masterplan §2.8.4, §31 #21). A country is configuration: locale, currency, date format, administrative levels,
 * identity checks, notification channels and emergency numbers, plus the small code-side rules (phone format, numerals) in one file per country.
 * Shared modules call `adapterFor` and never mention a country. The database holds the same configuration (country_adapters, 0036) and the
 * active country (app_settings.country_code); the code-side adapters below are what the database cannot express.
 */
export interface AdminLevel { level: string; name_en: string; name_bn?: string }
export interface CountryAdapter {
  code: string; nameEn: string; nameNative: string;
  defaultLocale: string; locales: string[]; currency: string; dateFormat: string; timezone: string;
  adminLevels: AdminLevel[];
  identityChecks: string[]; notificationChannels: string[]; emergencyNumbers: Record<string, string>;
  /** Normalises a phone number typed by a person to E.164, or null when it is not valid for this country. */
  normalizePhone(input: string): string | null;
  /** Digits as written by default in this country's primary locale. */
  numerals: "bn" | "en";
}

const REGISTRY: Record<string, CountryAdapter> = { [BANGLADESH.code]: BANGLADESH };
export const registerAdapter = (a: CountryAdapter) => { REGISTRY[a.code] = a; };
export const knownCountries = () => Object.keys(REGISTRY);

export function adapterFor(code: string | null | undefined): CountryAdapter {
  const a = REGISTRY[(code ?? "").toUpperCase()];
  if (!a) throw new Error(`No country adapter for "${code}"`);
  return a;
}

/** The active country: the database setting, else the COUNTRY_CODE environment variable, else Bangladesh (the first adapter). */
export async function activeCountry(sb: SupabaseClient): Promise<CountryAdapter> {
  const { data } = await sb.rpc("active_country");
  const code = typeof data === "string" ? data : process.env.COUNTRY_CODE ?? "BD";
  return REGISTRY[code.toUpperCase()] ?? BANGLADESH;
}
