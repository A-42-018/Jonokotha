import { cookies } from "next/headers";
import { CONSTITUENCY_COOKIE, findConstituency } from "./constituency";

/** The saved constituency id, or null if the cookie is missing or not a known entry. */
export async function getConstituencyId(): Promise<string | null> {
  const v = (await cookies()).get(CONSTITUENCY_COOKIE)?.value;
  return findConstituency(v)?.id ?? null;
}
