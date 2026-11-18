// Dev-period demo login. Signs in to real, pre-created accounts (supabase/seed/demo_users.sql) so RLS, office scopes and the staff gate still apply.
// One account per role except admin, which is never offered. Off unless DEMO_LOGIN=true on the server. Remove the env var (and the demo users) before real use.

/** `staff` is the office manager (kept as `staff` so the original button and account keep working). */
export const DEMO_ROLES = ["citizen", "staff", "officer", "mp", "liaison", "moderator"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export const DEMO_EMAILS: Record<DemoRole, string> = {
  citizen: "demo-citizen@jonokotha.test",
  staff: "demo-staff@jonokotha.test",
  officer: "demo-officer@jonokotha.test",
  mp: "demo-mp@jonokotha.test",
  liaison: "demo-liaison@jonokotha.test",
  moderator: "demo-moderator@jonokotha.test",
};

export const demoEnabled = () => process.env.DEMO_LOGIN === "true" && Boolean(process.env.DEMO_PASSWORD);

export const parseDemoRole = (v: unknown): DemoRole | null => (DEMO_ROLES as readonly string[]).includes(v as string) ? (v as DemoRole) : null;

/** Where each role starts: the page that role actually works on. */
const LANDING: Record<DemoRole, string> = {
  citizen: "/report",
  staff: "/office",
  officer: "/office/mine",
  mp: "/office",
  liaison: "/office/agency",
  moderator: "/admin/moderation",
};
export const demoLanding = (role: DemoRole) => LANDING[role];
