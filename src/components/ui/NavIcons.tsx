import type { ReactNode } from "react";

function Svg({ children, className = "size-6" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" className={className}>
      {children}
    </svg>
  );
}

export const HomeIcon = () => <Svg><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></Svg>;
export const AreaIcon = () => <Svg><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></Svg>;
export const IdeaIcon = () => <Svg><path d="M9 18h6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" /></Svg>;
export const PersonIcon = () => <Svg><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" /></Svg>;
export const PlusIcon = () => <Svg className="size-7"><path d="M12 5v14M5 12h14" /></Svg>;
export const BellIcon = () => <Svg><path d="M6 17V11a6 6 0 1 1 12 0v6l1.5 2h-15L6 17Z" /><path d="M10 21h4" /></Svg>;
