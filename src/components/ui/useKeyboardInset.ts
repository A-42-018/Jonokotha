"use client";
import { useEffect, useState } from "react";

/**
 * Height in px of the on-screen keyboard (0 when closed), from the visual viewport.
 * A `position: fixed` bar uses it as `bottom` so it rides above the keyboard instead of hiding behind it.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}
