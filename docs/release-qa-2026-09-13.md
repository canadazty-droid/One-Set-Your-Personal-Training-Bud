# ONE SET release verification

Scope: existing web app, device-local training MVP. No new login, billing, AI provider, or database schema.

## Changes

- Only valid records in the last seven Pacific calendar days can drive recovery adjustments. History is retained; missing dates and future dates cannot describe current readiness.
- Missing ratings cannot imply low energy or justify progressive overload.
- Home, plan, progress and completion feedback use consistent adjustment rules.
- Guided completion saves confirmed sets only. Quick feedback keeps existing measurements and does not invent elapsed minutes.
- Existing data export includes local profile, readiness, four-week plan, generated workout and logs; cloud data is included only if available.

## Manual regression checklist

- [x] Local mobile welcome screen leads to Today without registration.
- [x] Enter `30 分钟，练胸和背`; see exercises, sets, reps, rests and completion action.
- [x] Guided flow: learn, explicitly start, enter actual reps, save set, rest, next exercise.
- [x] Refresh after first set; resume retains 1/3 completed sets and starts paused.
- [x] Complete all 3 sets; save feedback; Progress shows 3 recorded sets.
- [ ] Edit that day's feedback; existing measured sets remain unchanged in the rendered page.
- [x] Local JSON export succeeds without authentication; rendered notice confirms local download without cloud data.
- [x] English homepage smoke check at 390 px and 768 px; no horizontal overflow. Temporary viewport reset afterward.
- [x] September 13 quick log survives reload, shows untimed / zero measured sets; September 12 guided history still retains its 3 sets.
- [x] Saving soreness 10/10 makes next generated workout light, with three sets and a visible recovery reason.
- [ ] Final production smoke check after deploying this exact source.

Automated tests: 172 passing at preparation. Production build: successful before final deployment preparation.

## Release limitations

This is a testable web MVP, not a certification of commercial readiness. Local records are tied to the browser and may be lost when browser data is cleared; JSON export is a backup, not an implemented restore workflow. Cloud account/sync and payment are not acceptance-tested here. Not every exercise has a playable human video. Third-party tutorial availability depends on provider and network. No medical or biomechanical accuracy claim is made. Synthetic QA records are created only on localhost, not production.
