"use client";
import { useEffect } from "react";

/** Puts `data-theme="dark"` on <html> when the person's choice (or the phone, for "follow the phone") says dark. Renders nothing. */
export default function ThemeApplier() {
  useEffect(() => {
    // Spelled out so the build can fold it: with the flag off, the import below is dropped and the first-load JavaScript for `/` does not grow.
    if (process.env.NEXT_PUBLIC_FLAG_DARK_MODE !== "1" && process.env.NEXT_PUBLIC_FLAG_RELEASE11 !== "1") return;
    let stop = () => {};
    let gone = false;
    void import("./themeRuntime").then((m) => { if (!gone) stop = m.start(); });
    return () => { gone = true; stop(); };
  }, []);
  return null;
}
