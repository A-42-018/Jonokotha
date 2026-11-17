import { cookies } from "next/headers";
import { CONSTITUENCY_COOKIE, KEY_RE, type Area } from "./constituency";
import { DEMO_CONSTITUENCY } from "./demo-data";
import { supabaseServer } from "./supabase/server";

/** The saved constituency key (e.g. "bd-017" or "demo-1"), or null when the cookie is missing or not a well-formed key. */
export async function getConstituencyId(): Promise<string | null> {
  const v = (await cookies()).get(CONSTITUENCY_COOKIE)?.value;
  return v && KEY_RE.test(v) ? v : null;
}

/** The chosen area with its names, read from the database. Falls back to the sample area when nothing valid is chosen or the database is unreachable. */
export async function getArea(): Promise<Area> {
  const key = await getConstituencyId();
  if (!key || key === DEMO_CONSTITUENCY.id) return { ...DEMO_CONSTITUENCY, sample: true, vacant: false };
  try {
    const sb = await supabaseServer();
    const { data } = await sb.from("constituencies").select("key,name_bn,name_en,is_demo,seat_status").eq("key", key).eq("is_active", true).maybeSingle();
    if (data) return { id: data.key, nameBn: data.name_bn, nameEn: data.name_en, sample: !!data.is_demo, vacant: data.seat_status === "vacant" };
  } catch { /* database not reachable: use the sample area */ }
  return { ...DEMO_CONSTITUENCY, sample: true, vacant: false };
}
