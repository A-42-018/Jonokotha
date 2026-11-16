"use client";
import { useEffect } from "react";
import { useNumerals, usePersonalModes } from "./usePersonalization";

/** Puts the chosen modes on <html> (`data-simple`, `data-voice`) so CSS can shorten copy. Renders nothing. */
export default function PersonalizationApplier() {
  const [modes] = usePersonalModes();
  const [numerals] = useNumerals();
  useEffect(() => {
    const el = document.documentElement;
    if (modes.simple) el.dataset.simple = "true"; else delete el.dataset.simple;
    if (modes.voiceFirst) el.dataset.voice = "true"; else delete el.dataset.voice;
  }, [modes.simple, modes.voiceFirst]);
  useEffect(() => { document.documentElement.dataset.numerals = numerals; }, [numerals]);
  return null;
}
