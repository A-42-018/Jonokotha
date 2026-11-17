import { redirect } from "next/navigation";
import MfaPanel from "@/components/MfaPanel";
import { loginUrl, safeNext } from "@/lib/guard";
import { currentUser } from "@/lib/supabase/server";

/** Two-step sign-in: link an authenticator the first time, enter a code after that. Returns to `next` once the session is aal2. */
export default async function Mfa({ searchParams }: PageProps<"/mfa">) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "/");
  const { user } = await currentUser();
  if (!user) redirect(loginUrl(`/mfa?next=${encodeURIComponent(next)}`));
  return <MfaPanel next={next} email={user.email ?? ""} />;
}
