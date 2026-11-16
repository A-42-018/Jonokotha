// Rules for migrations that go through the reviewed CI/CD flow (docs/aibc/runbooks/deploy-and-rollback.md). Pure functions so tests can feed them text.
//   1. numbers are 4 digits, unique and strictly increasing (gaps are allowed: each phase owns a range)
//   2. every new table says `if not exists` (re-runnable) and enables row level security in the same file
//   3. destructive statements (drop table/column/schema, truncate, alter column type) need a line `-- destructive-approved: <reason>` in the file,
//      because the database is fixed by a forward migration, never by undoing one (rollback plan)
//   4. no grants of write privileges to anon
export function lintMigrations(files, since = 24) {
  const problems = [];
  const seen = new Map();
  let prev = 0;
  for (const f of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    const m = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(f.name);
    if (!m) { problems.push(`${f.name}: name must look like 0123_short_name.sql`); continue; }
    const n = Number(m[1]);
    if (seen.has(n)) problems.push(`${f.name}: number ${m[1]} is also used by ${seen.get(n)}`);
    seen.set(n, f.name);
    if (n <= prev && !seen.has(n)) problems.push(`${f.name}: numbers must increase`);
    prev = Math.max(prev, n);
    if (n < since) continue;
    const sql = f.sql.replace(/--[^\n]*/g, (c) => (/^--\s*destructive-approved:/.test(c) ? c : ""));
    const tables = [...sql.matchAll(/create\s+table\s+(if\s+not\s+exists\s+)?(?:public\.)?([a-z_0-9]+)/gi)];
    for (const t of tables) {
      if (!t[1]) problems.push(`${f.name}: create table ${t[2]} needs "if not exists"`);
      if (!new RegExp(`alter\\s+table\\s+(?:public\\.)?${t[2]}\\s+enable\\s+row\\s+level\\s+security`, "i").test(sql)) problems.push(`${f.name}: table ${t[2]} must enable row level security in the same file`);
    }
    const destructive = /\bdrop\s+(table|column|schema)\b|\btruncate\b|alter\s+column\s+[a-z_0-9]+\s+(set\s+data\s+)?type\b/i.test(sql);
    if (destructive && !/--\s*destructive-approved:\s*\S+/.test(f.sql)) problems.push(`${f.name}: destructive statement without "-- destructive-approved: <reason>"`);
    if (/grant\s+(insert|update|delete|all)[^;]*\sto\s[^;]*\banon\b/i.test(sql)) problems.push(`${f.name}: anon must never receive write privileges`);
  }
  return problems;
}
