# Exercise tutorial sourcing

The product accepts a tutorial only when all five checks pass:

1. A real person performs the movement.
2. The movement and equipment exactly match the ONE SET exercise.
3. The media owner or authorized provider is identifiable.
4. Commercial in-app use is explicitly allowed.
5. The source URL, license, author, and required attribution are stored in the app manifest.

Run `npm run media:audit` to regenerate the current curated-exercise coverage report.
Run `npm run media:research -- --limit=10` to research the next uncovered movements.
The research command can use `FIRECRAWL_API_KEY` and `GITHUB_TOKEN`/`GH_TOKEN`.
It writes candidates to `docs/tutorial-candidates.json`, but never downloads,
approves, or publishes them automatically. A repository's MIT license does not
prove that bundled third-party videos are commercially licensed.

Approved importers:

- `npm run media:import:wger` requires `FFMPEG_PATH` and verifies wger license id 2 (CC BY-SA 4.0).
- `npm run media:import:ymove` downloads the provider's 25-clip commercial-use collection, limited to exact matches listed in the importer.
- `npm run media:import:commons` requires `FFMPEG_PATH`, verifies each Wikimedia Commons file's author and license through the MediaWiki API, retries rate limits, and imports only the four reviewed exact matches in its allowlist.

Rejected sources remain excluded when the repository license does not establish
the provenance and commercial-use rights of bundled videos. In particular,
`arhxam/free-exercise-db-with-videos` states that its video provenance is
unknown, while `semih-turan/fitness-exercises-dataset` prohibits commercial
use. Neither source is imported.

Firecrawl's hosted API requires a key. Without it, the audit still runs and the
candidate ledger remains safe; Firecrawl discovery is simply skipped rather
than replaced by unlicensed scraping.
