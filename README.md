# 练一下 · ONE SET Fitness OS

A runnable AI-native fitness MVP whose core does **not** call OpenAI, ChatGPT, or any external LLM API. Its “AI” behavior is deterministic:

`profile → 4-week rules engine → workout log → weekly review → new plan version`

The app remains compatible with an external AI client through its MCP server. The client can read and write data, while plan generation and adjustment stay inside ONE SET’s rules.

## Why Cloudflare D1 instead of Supabase

This project was already deployed with OpenAI Sites, vinext, Drizzle, and a bound Cloudflare D1 database. Replacing that working stack with Supabase/Vercel would add a second auth and deployment system without improving the MVP loop. D1 + Drizzle provides the same required persistence with fewer moving parts. The domain rules, CLI, MCP server, and API routes remain portable if a later migration is needed.

## Install and run

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. For local CLI/MCP development, set `FORM_DEV_AUTH=1` in the app environment and use a development email.

Copy `.env.example` to `.env.local` and adjust values. Production users authenticate through Sign in with ChatGPT or a revocable `form_live_…` integration token; production never trusts a raw email header.

## Database

Drizzle schema: `db/schema.ts`. SQL migrations: `drizzle/`.

The current deployment uses the D1 binding named `DB`, declared in `.openai/hosting.json`. Migrations `0007`–`0009` add onboarding and recovery data, four-week plan versions, materialized training days/exercises, weight history, and complete audit fields.

## Product flow

1. Visit `/onboarding`; every required field is validated.
2. Saving the profile automatically generates a four-week plan and opens `/dashboard`.
3. `/training-plan` shows all four weeks with exercises, sets, reps, rest, and coaching notes.
4. `/workout-log` saves sets plus difficulty, energy, soreness, and notes.
5. `/review` calculates the last seven days without an AI API.
6. “Apply as a new plan version” saves a new version and preserves the old plan.

The original `/` experience remains the simple one-tap workout home.

## WeChat Mini Program MVP

The native client lives in `apps/wechat-mini-program`. It preserves the Web app and has exactly five primary tabs: 今天、训练、计划、进度、我的, plus the short onboarding route.

```bash
npm run wechat:build
```

Import `apps/wechat-mini-program` in WeChat DevTools. Replace `touristappid` with the registered AppID, configure `WECHAT_APPID` and `WECHAT_APP_SECRET`, and allowlist the deployed ONE SET HTTPS origin. The client is native WXML/WXSS/JavaScript, not a WebView.

Shared deterministic generation, plan import, natural-language logging, and workout summary rules live in `packages/workout-domain`; the build command produces the Mini Program-compatible module.

```text
WeChat Mini Program ─┐
Web ─────────────────┼→ typed HTTP API → D1 / workout domain
CLI ─────────────────┤
MCP ─────────────────┘
```

`wx.login()` exchanges its code at `/api/auth/wechat`. The WeChat `openid` is stored only as an identity-provider key; sessions resolve to a canonical ONE SET user ID.

## CLI

Run `node cli/form.mjs` for full help. The requested commands are:

```bash
node cli/form.mjs create-user --name Paul --gender male --age 35 --height 178 --weight 80 --goal muscle_gain --experience intermediate --days 4 --minutes 50 --equipment gym --style hypertrophy
node cli/form.mjs generate-plan
node cli/form.mjs log-workout --exercise Goblet_Squat --sets 3 --reps 10 --weight 20 --difficulty 7 --energy 8 --soreness 3
node cli/form.mjs log-workout --missed --difficulty 5 --energy 3 --soreness 7 --notes "Recovery day"
node cli/form.mjs weekly-review
node cli/form.mjs list-plans
node cli/form.mjs list-logs
```

Environment:

```bash
FORM_API_URL=http://localhost:3000
FORM_DEV_USER=dev@form.local
# or use the revocable token copied from the app
FORM_API_TOKEN=form_live_...
```

The package also exposes `oneset` and supports:

```bash
oneset auth status
oneset profile get
oneset workout today
oneset workout list
oneset workout create --focus upper
oneset workout log --workout <id> --exercise bench --weight 80 --reps 8
oneset exercise history squat
oneset prs
```

## MCP server

```bash
FORM_API_URL=http://localhost:3000 FORM_API_TOKEN=form_live_... node mcp/server.mjs
```

Required tools:

- `get_user_profile`
- `update_user_profile`
- `generate_training_plan`
- `get_today_workout`
- `log_workout`
- `get_weekly_review`
- `adjust_next_week_plan`
- `get_progress`
- `create_workout`
- `update_workout`
- `update_training_goal`

Legacy Form tools remain available for compatibility. Every tool has a JSON schema, writes through the same authenticated API, and makes no external LLM request.

## Tests

```bash
npm test
npm run build
```

The rule tests verify onboarding validation, four-week progression, review thresholds, immutable plan versioning, MCP tools, low-energy Mini Program generation, deterministic Chinese plan import, and one-sentence logging without invented values. Existing product tests cover the one-tap workout, logging, camera feedback, privacy, and responsive UI constraints.

## Seed data

With the local app running:

```bash
node scripts/seed.mjs
```

This creates a sample profile, a four-week plan, and three completed workouts through the public app API.

## Manual QA checklist

- Submit onboarding with one blank required field; confirm a clear error and no navigation.
- Complete onboarding; confirm `/dashboard` opens and today/week data appears.
- Confirm `/plan` redirects to the four-week plan and the third week has higher volume than week one.
- Save a completed workout with per-exercise notes; then save a missed workout and confirm both appear in history/review.
- Add today's body weight on the dashboard and confirm the latest change is shown.
- Open `/review`; compare completion rate against the last seven days of logs.
- Apply the review; confirm plan version increases and the earlier version remains in `list-plans`.
- Run MCP `tools/list`; confirm the seven required tools and no sensitive profile fields.
- Test at 390px viewport; confirm navigation, form labels, and primary actions remain readable.

## Current scope

Complete: onboarding data model and route, four-week deterministic generator, daily logs with recovery feedback, dashboard/plan/log/review routes, weekly review rules, immutable plan adjustment, CLI, MCP, D1 persistence, automated tests, and public Sites deployment support.

Intentionally not included: payments, social feed, coach dashboard, native mobile app, external LLM calls, or medical diagnosis. The dashboard now stores longitudinal weight entries and shows the latest change; richer charts can be added after the MVP is validated with real users.
