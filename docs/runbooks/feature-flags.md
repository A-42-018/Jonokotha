# Feature flags and capability labels

- Flags are rows in `feature_flags` (`GET /api/v1/features` is public). Change with `POST /api/v1/admin/feature-flags {key, enabled, data_status?}` (admin, audited). Caches expire within 15 seconds per server instance.
- Switching a flag off makes its routes answer 404 `feature_disabled`; clients should hide the feature. Use it as the kill switch for `idea_comments`, `polls` and `video_reports` if abuse appears.
- `data_status` labels what users see: `live` (real, current), `sample` (example content), `demo` (demo account data), `planned` (not built or not confirmed). Never mark something `live` that is not. `official_registration`, `sms_verification` and `open311_api` stay `planned` until the matching integration or release exists.
- Every response carries `data_status`; records that say `is_sample`/`is_demo` override a `live` flag.
