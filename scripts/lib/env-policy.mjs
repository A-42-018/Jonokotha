// Checks a set of environment variables against config/environments.json. Pure: pass any object (process.env, a parsed file).
// Also refuses to treat a Supabase URL as production unless it is a hosted project different from the staging one (when SUPABASE_STAGING_URL is given).
export function checkEnvironment(name, env, config) {
  const spec = config[name];
  if (!spec || name.startsWith("_")) return { ok: false, problems: [`unknown environment "${name}" (use development, staging or production)`] };
  const problems = [];
  for (const k of spec.required) if (!env[k]) problems.push(`${k} is not set`);
  for (const [k, bad] of Object.entries(spec.forbidden_values ?? {})) if (bad.includes(env[k] ?? "")) problems.push(`${k} must not be "${env[k] ?? ""}" in ${name}`);
  for (const [k, good] of Object.entries(spec.required_values ?? {})) if (!good.includes(env[k] ?? "")) problems.push(`${k} must be ${good.join(" or ")} in ${name}`);
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const local = /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url);
  if (name !== "development" && local) problems.push(`NEXT_PUBLIC_SUPABASE_URL points at a local database in ${name}`);
  if (name === "production" && env.SUPABASE_STAGING_URL && env.SUPABASE_STAGING_URL === url) problems.push("production uses the same Supabase project as staging");
  if (name === "production" && /^sb_secret_|service_role/.test(env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "")) problems.push("NEXT_PUBLIC_SUPABASE_ANON_KEY holds a secret key");
  return { ok: problems.length === 0, problems };
}
