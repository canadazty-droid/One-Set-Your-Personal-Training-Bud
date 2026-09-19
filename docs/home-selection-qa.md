# Homepage selection check

Scope: keep the one-tap homepage, remove the second disclosure inside custom
selection, expose existing target filters and confirm equipment/time/target.
Interaction reference: https://github.com/workout-lol/workout-lol (MIT).
No external source code or media was copied.

## Automated checks

- 172 existing unit/source-regression tests passed.
- Production build completed using the public example hosting configuration.
- These tests do not establish live-production acceptance.

## Local built-app browser check

Tested at http://localhost:4174/ with Vite preview (Cloudflare runtime):

- Enter homepage, expand custom selection: targets visible without another click.
- Chest + 30 minutes + dumbbells updates the visible selection summary.
- Generate: chest workout renders with sets/reps/rest and Complete workout.
- While generating, target and duration buttons are disabled.
- English switch preserves usable controls; Lower body > Front thighs updates
  the summary and displays a check mark on the selected button.
- Mobile target buttons measure approximately 48 CSS pixels tall.
- At mobile/tablet/desktop viewport overrides (390/820/1280), document width
  remained within the viewport. Browser zoom affects actual CSS viewport width.

## Repeat manually

1. npm ci; npm test; npm run build; npm start.
2. Open the printed local address and enter the homepage.
3. Choose equipment, expand custom selection, select a target and duration.
4. Confirm summary matches; generate and inspect the resulting workout.
5. Repeat with English and mobile width; check keyboard focus and selected state.

This change is not a Vercel migration and has not been published to the original
chatgpt.site deployment. Cloud account/database flows were not tested here.
