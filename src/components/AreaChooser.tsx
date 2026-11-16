"use client";
import AreaPicker from "@/components/mp/AreaPicker";
import QueryProvider from "@/components/QueryProvider";
import type { LookupMatch } from "@/lib/mp-api";

/** AreaPicker with its own query client, loaded on demand (first-run dialog). */
export default function AreaChooser({ onConfirm }: { onConfirm: (m: LookupMatch) => void }) {
  return <QueryProvider><AreaPicker mode="choose" onConfirm={onConfirm} /></QueryProvider>;
}
