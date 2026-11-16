"use client";
import RouteError from "@/components/ui/RouteError";
import { useT } from "@/components/ui/useT";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useT();
  return <RouteError error={error} retry={retry} hint={t.erHintReport} />;
}
