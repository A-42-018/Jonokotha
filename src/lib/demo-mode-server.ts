import { cookies } from "next/headers";
import { DEMO_COOKIE } from "./demo-mode";

/** Server side: is the visitor in simulated demo mode? */
export async function demoOn(): Promise<boolean> {
  try { return (await cookies()).get(DEMO_COOKIE)?.value === "1"; } catch { return false; }
}

/** A page behind a release flag exists when the flag is on, or when the visitor is looking at the simulated demo. */
export async function flagOrDemo(flag: boolean): Promise<boolean> {
  return flag || (await demoOn());
}
