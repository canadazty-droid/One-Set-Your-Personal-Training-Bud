# ONE SET source snapshot

This repository contains the current ONE SET source snapshot, without prior Git
history, production hosting identifiers, local secrets, browser records or build
archives. Uploading this repository does not change the existing hosted app.

## Local development

Use Node.js 22.13 or newer. Run `npm ci`, then `npm run dev`.
Run `npm test` for the unit tests and `npm run build` for a production build.
After building, run `npm start` to preview the built Cloudflare application
locally. A plain Node `vinext start` cannot load its `cloudflare:` bindings.
See `.env.example` for optional local configuration; never commit real secrets.

The existing server integration targets Cloudflare Workers and D1. This is not
a promise of drop-in Vercel compatibility. Configure a deployment environment
separately before enabling cloud account or database features.
`hosting.example.json` documents the required logical database binding without
identifying the existing production site. Tests use this example when no local
`.openai/hosting.json` exists. The Vite configuration uses the same fallback for
local builds; deployment still needs its own project setup.

## Data and readiness

The web MVP supports device-local workout records. Clearing browser data can
remove those records. Cross-device synchronization and complete real-person
video coverage have not been fully acceptance-tested.

## Third-party assets

Keep `THIRD_PARTY_MEDIA.md` and embedded per-record attribution. Public source
availability is not a blanket license for the application or its assets.
Different datasets and videos retain their own licenses and restrictions;
in particular, do not redistribute Your Move clips as a standalone library.
