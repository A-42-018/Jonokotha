"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import Button from "./Button";
import { useT } from "./useT";

/** Signs out and returns to sign-in (used where the current account lacks the needed role). */
export default function SwitchAccount({ next }: { next: string }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await supabaseBrowser().auth.signOut();
        router.push(`/login?next=${encodeURIComponent(next)}`);
        router.refresh();
      }}
    >
      {t.naSwitch}
    </Button>
  );
}
