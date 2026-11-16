"use client";
import { useCallback } from "react";
import type { Dict } from "@/lib/i18n";
import { useToast } from "./Toast";

/**
 * Copy/share helpers for a path on this site (e.g. `/issue/JK-123`).
 * Clipboard failure is silent: the text stays selectable on screen.
 */
export function useShare(t: Dict, path: string, title: string) {
  const toast = useToast();

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("success", t.copied);
    } catch {
      /* clipboard unavailable */
    }
  }, [toast, t.copied]);

  const copyLink = useCallback(() => copy(`${window.location.origin}${path}`), [copy, path]);

  const share = useCallback(async () => {
    const url = `${window.location.origin}${path}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* cancelled or failed: fall back to copying */
      }
    }
    await copy(url);
  }, [copy, path, title]);

  return { copy, copyLink, share };
}
