# KPI baselines measured in the pilot (B6.6)

Code: migration `0062` (`kpi_baselines`, `snapshot_kpi_baseline`, `record_manual_kpi`, `publish_kpi_baselines`, `withdraw_kpi_baselines`, view `public_kpi_baselines`), routes `POST /office/kpi-baselines/snapshot`, `/admin/kpi-baselines/*`, public `GET /kpi-baselines`.

## Flow

1. **Snapshot** (office manager or MP of that office, or admin): `POST /office/kpi-baselines/snapshot {constituency, days}` computes from the database via `office_kpis()` and stores **drafts**: received, median hours to first response, forwarding rate, reopen rate, handling hours with and without an accepted copilot draft, and the **north-star** (verified issues reaching a documented outcome per month).
2. **Manual measurements** (admin): `POST /admin/kpi-baselines/manual` for what no query can know: `accessibility_task_completion_pct`, `copilot_time_study_with_minutes` / `_without_minutes`, `citizen_satisfaction_pct`, `report_completion_rate_pct`. Each carries `n`, a `definition` and a `method` (10+ characters each).
3. **Publish** (admin): `POST /admin/kpi-baselines/publish {constituency, period_end}`. Only then does `public_kpi_baselines` show anything. An earlier published value for the same metric is withdrawn. `withdraw` takes a published set back with a reason.

Every public row has its definition, method, period and publication time. Any metric with fewer than 5 cases is suppressed (value and n hidden). Nothing is a ranking of people or offices.

## Definitions and honest limits

| Metric | Definition | Limits |
|---|---|---|
| North-star | Issues in the constituency with a status change to resolved, rejected, closed, duplicate or out of jurisdiction in the period (each of these needs a note, reason or master case in the state machine), x 30 / days | Counts outcomes, not whether the citizen was satisfied; "verified" here means created through verified accounts in this constituency, not demo |
| Time to first response | Median hours from submission to the first status change | A first status change can be a rejection; says nothing about quality |
| Copilot vs no copilot | Median hours to first response where an accepted or edited reply draft exists versus not | **Association, not effect**: offices choose when to use it. A fair comparison needs the time study below |
| Copilot time study (manual) | Staff time per reply on a fixed set of [20] cases, with and without the copilot, order alternated | Small n; staff learn; report the spread, not just the mean |
| Accessibility task completion (manual) | Share of testers who finish "report a problem" unaided, on a mid-range phone, in Bangla, including some who use voice, some with low vision using large text, and some first-time users | Test with [10+] people per group; say who they were |
| Satisfaction | From the in-app rating after closure | Self-selected; response rate must be shown next to it |

## Baseline versus later

The first snapshot **before** go-live (week -1, zero or demo data, so mostly suppressed) proves the pipeline. The baseline proper is the first [4] weeks of real use. Later snapshots are compared with it, with the number of cases next to every figure. Publish with the method, whatever the numbers say.
