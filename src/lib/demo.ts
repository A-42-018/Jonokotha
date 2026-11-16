// Dev-period demo login. Signs in to two real, pre-created accounts so RLS and the staff gate still apply.
// Off unless DEMO_LOGIN=true on the server. Remove the env var (and the demo users) before real use.

export const DEMO_ROLES = ["citizen", "staff"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export const DEMO_EMAILS: Record<DemoRole, string> = {
  citizen: "demo-citizen@jonokotha.test",
  staff: "demo-staff@jonokotha.test",
};

export const demoEnabled = () => process.env.DEMO_LOGIN === "true" && Boolean(process.env.DEMO_PASSWORD);

export const parseDemoRole = (v: unknown): DemoRole | null => (DEMO_ROLES as readonly string[]).includes(v as string) ? (v as DemoRole) : null;

export const demoLanding = (role: DemoRole) => (role === "staff" ? "/office" : "/report");
