# Demo data and environments

- `POST /api/v1/admin/demo-data {action: load|reset}` loads a small sample (announcement, project, idea in the demo area) or removes demo rows (announcements, projects, ideas, questions). Sample issues are kept (their content is immutable by design); `scripts/seed-demo.mjs` resets those with the service role.
- It is **refused in production** twice: `APP_ENV` or `VERCEL_ENV` is `production` (403), and `app_settings.environment` is `production` or missing (409 `rule_not_met`). Set `environment` to `development` or `staging` in non-production databases:
  `update app_settings set value = '"staging"' where key = 'environment';` and `"production"` in production before launch.
- Demo accounts never get production data; no fake verified MP exists; never send a demo case to a real agency.
