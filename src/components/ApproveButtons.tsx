"use client";
import { useRouter } from "next/navigation";

export default function ApproveButtons({ cref, ack, refer }: { cref: string; ack: string; refer: string }) {
  const router = useRouter();
  async function go(action: "acknowledge" | "refer") {
    await fetch(`/api/cases/${cref}/approve`, { method: "POST", body: JSON.stringify({ action }) });
    router.refresh();
  }
  return (
    <div className="flex flex-wrap gap-3">
      <button onClick={() => go("acknowledge")} className="rounded-lg bg-civic px-4 py-2 text-white">{ack}</button>
      <button onClick={() => go("refer")} className="rounded-lg bg-leaf px-4 py-2 text-white">{refer}</button>
    </div>
  );
}
