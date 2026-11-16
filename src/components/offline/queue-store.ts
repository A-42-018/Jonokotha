"use client";
import { flushQueue, QUEUE_KEY, sendReport, type FlushOutcome, type QueuedReport } from "@/lib/offline-queue";

// Same storage and change event as useLocalValue, so components using that hook update when this writes.
const EVENT = "jk-local-change";
let running: Promise<FlushOutcome> | null = null;

export function readQueue(): QueuedReport[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedReport[]; } catch { return []; }
}
export function writeQueue(list: QueuedReport[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Sends everything that is waiting. One run at a time, so two tabs or components never send the same report twice. */
export function flushNow(only?: string): Promise<FlushOutcome> {
  if (running) return running;
  const all = readQueue();
  const list = only ? all.filter((q) => q.id === only) : all;
  const rest = only ? all.filter((q) => q.id !== only) : [];
  running = (async () => {
    // A manual "send now" retries a report that was waiting for sign-in.
    const out = await flushQueue(list.map((q) => (q.state === "needs-signin" ? { ...q, state: "queued" as const } : q)), (q) => sendReport(q));
    const merged = only ? [...rest, ...out.list] : out.list;
    writeQueue(merged);
    return out;
  })().finally(() => { running = null; });
  return running;
}
