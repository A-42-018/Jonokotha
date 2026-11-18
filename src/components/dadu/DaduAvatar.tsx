"use client";
import { useSyncExternalStore } from "react";
import type { Mood } from "@/lib/helper/types";

/**
 * Jomir Dadu, flat and hand-drawn: ivory panjabi with gold buttons and a green collar, red gamchha, round glasses, white hair, moustache and beard, a walking stick.
 * Colours are fixed (the same in light and dark). Poses change the mouth, eyebrows and one arm; "talk" animates the mouth, and nothing moves under reduced motion.
 * Palette follows LandShield BD's helper. The picture is decorative (`aria-hidden`): his name is always in the text beside it.
 */
const C = { ivory: "#FBFAF5", green: "#006A4E", gold: "#D6B25C", red: "#C73A2E", skin: "#C48A5E", hair: "#F4F1EA", wood: "#6E4527", frame: "#3A2B20", ink: "#2B2018" };

const subscribe = (cb: () => void) => { const m = window.matchMedia("(prefers-reduced-motion: reduce)"); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Mouth({ mood, still }: { mood: Mood; still: boolean }) {
  if (mood === "talk") {
    return (
      <ellipse cx="60" cy="68" rx="4.5" ry="2.6" fill={C.ink}>
        {!still && <animate attributeName="ry" values="1.2;3.6;1.6;3.2;1.2" dur="0.7s" repeatCount="indefinite" />}
      </ellipse>
    );
  }
  if (mood === "sorry") return <path d="M54 70 Q60 65.5 66 70" stroke={C.ink} strokeWidth="2" fill="none" strokeLinecap="round" />;
  if (mood === "think") return <ellipse cx="62" cy="69" rx="2.2" ry="1.8" fill={C.ink} />;
  if (mood === "happy" || mood === "greet") return <path d="M52 66 Q60 76 68 66 Z" fill={C.ink} />;
  return <path d="M54 67 Q60 72 66 67" stroke={C.ink} strokeWidth="2" fill="none" strokeLinecap="round" />;
}

export default function DaduAvatar({ mood = "idle", size = "full", className }: { mood?: Mood; size?: "head" | "full"; className?: string }) {
  const still = useSyncExternalStore(subscribe, reduced, () => true);
  const brow = mood === "sorry" ? ["M40 40 L56 43", "M80 40 L64 43"] : mood === "think" ? ["M40 42 L56 40", "M80 38 L64 38"] : ["M40 40 Q48 36 56 40", "M80 40 Q72 36 64 40"];
  const wave = mood === "greet" || mood === "happy";
  return (
    <svg viewBox={size === "head" ? "22 12 76 76" : "0 0 120 150"} className={className} aria-hidden="true" focusable="false">
      {size === "full" && (
        <g>
          {/* walking stick */}
          <path d="M104 100 L106 146" stroke={C.wood} strokeWidth="4" strokeLinecap="round" />
          <path d="M104 100 Q104 92 97 94" stroke={C.wood} strokeWidth="4" fill="none" strokeLinecap="round" />
          {/* panjabi */}
          <path d="M26 150 L30 98 Q34 84 60 84 Q86 84 90 98 L94 150 Z" fill={C.ivory} stroke="#E4E0D2" strokeWidth="1.5" />
          <path d="M60 84 L60 150" stroke="#E4E0D2" strokeWidth="1.5" />
          <path d="M48 84 Q60 98 72 84" fill="none" stroke={C.green} strokeWidth="4" strokeLinecap="round" />
          {[100, 114, 128].map((y) => <circle key={y} cx="60" cy={y} r="2.4" fill={C.gold} />)}
          {/* gamchha */}
          <path d="M34 92 Q60 108 86 92 L90 100 Q60 118 30 100 Z" fill={C.red} />
          <path d="M80 100 L88 132 L80 130 L76 104 Z" fill={C.red} />
          {/* arms */}
          <path d="M30 100 Q22 120 30 134" stroke={C.ivory} strokeWidth="10" fill="none" strokeLinecap="round" />
          {wave ? <path d="M90 100 Q104 90 98 70" stroke={C.ivory} strokeWidth="10" fill="none" strokeLinecap="round" /> : <path d="M90 100 Q100 118 104 100" stroke={C.ivory} strokeWidth="10" fill="none" strokeLinecap="round" />}
          {wave && <circle cx="98" cy="68" r="5.5" fill={C.skin} />}
        </g>
      )}
      {/* head */}
      <ellipse cx="33" cy="52" rx="8" ry="11" fill={C.hair} />
      <ellipse cx="87" cy="52" rx="8" ry="11" fill={C.hair} />
      <ellipse cx="60" cy="50" rx="27" ry="31" fill={C.skin} />
      <path d="M36 36 Q60 14 84 36 Q60 26 36 36 Z" fill={C.hair} />
      {/* eyebrows, eyes, glasses */}
      {brow.map((d) => <path key={d} d={d} stroke={C.hair} strokeWidth="4" fill="none" strokeLinecap="round" />)}
      <circle cx="48" cy="50" r="9.5" fill="#FFFFFF55" stroke={C.frame} strokeWidth="2.4" />
      <circle cx="72" cy="50" r="9.5" fill="#FFFFFF55" stroke={C.frame} strokeWidth="2.4" />
      <path d="M57.5 50 L62.5 50" stroke={C.frame} strokeWidth="2.4" />
      {mood === "happy" ? (
        <>
          <path d="M44 51 Q48 46 52 51" stroke={C.ink} strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d="M68 51 Q72 46 76 51" stroke={C.ink} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx={mood === "think" ? 50 : 48} cy={mood === "think" ? 48 : 50} r="2.6" fill={C.ink} />
          <circle cx={mood === "think" ? 74 : 72} cy={mood === "think" ? 48 : 50} r="2.6" fill={C.ink} />
        </>
      )}
      {/* nose, moustache, beard, mouth */}
      <path d="M60 52 Q57 60 61 61" stroke="#9E6B45" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M60 80 Q40 88 40 66 Q50 74 60 70 Q70 74 80 66 Q80 88 60 80 Z" fill={C.hair} />
      <path d="M44 64 Q52 60 60 64 Q68 60 76 64 Q68 70 60 66 Q52 70 44 64 Z" fill={C.hair} stroke="#E4E0D2" strokeWidth="1" />
      <Mouth mood={mood} still={still} />
      {mood === "think" && <path d="M86 70 Q96 74 92 84" stroke={C.skin} strokeWidth="6" fill="none" strokeLinecap="round" />}
    </svg>
  );
}
