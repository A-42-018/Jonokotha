/** Shared navigation rules for TopNav, BottomTabBar and MainShell. */

/** Routes where the phone tab bar is hidden: typing flows, where it would ride up over the keyboard. */
const TAB_BAR_HIDDEN = ["/report", "/login"];

export function isActivePath(path: string, href: string): boolean {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

export function tabBarHidden(path: string): boolean {
  return TAB_BAR_HIDDEN.some((p) => isActivePath(path, p));
}
