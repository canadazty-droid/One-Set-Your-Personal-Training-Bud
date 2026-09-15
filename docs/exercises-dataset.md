# Exercises Dataset integration

Source: [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)  
Pinned commit: `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`

Additional source: [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db)  
Pinned commit: `a859101d633a01c4a1a920d6a8ce41dabba0705f`

Community reference source: [wger-project/wger](https://github.com/wger-project/wger)

Schema/code commit reviewed: `d1fb2489ccf472894cef34ab8fb37ad9b9f35635`

Data endpoint: `https://wger.de/api/v2/exerciseinfo/?limit=1000`

ONE SET uses these sources as non-media enrichment and reference sources.
The importer reads 1,324 Exercises Dataset records and 876 Free Exercise DB
records. It removes 135 exact-name duplicates, then reads the current complete
wger exercise-info snapshot. The 2026-09-01 import contained 871 wger records;
848 had an English name, readable instructions, and an allowed per-record
Creative Commons license. After exact-name deduplication, 771 were added. The
result is a 2,836-record union. It connects a record to a generated
workout only when the existing ONE SET movement and equipment are an exact
reviewed match. The complete non-media catalog remains searchable for learning.

Run:

```bash
npm run data:import:exercises
```

For an offline audit, point the importer at a previously downloaded copy:

```powershell
$env:EXERCISES_DATASET_FILE='path/to/exercises.json'
$env:FREE_EXERCISE_DB_FILE='path/to/free-exercise-db.json'
$env:WGER_EXERCISE_FILE='path/to/wger-exerciseinfo.json'
npm run data:import:exercises
```

Outputs:

- `app/exercise-dataset-enrichment.ts` — app-ready reviewed mappings
- `docs/exercises-dataset-import.json` — match count, unmatched records, and fuzzy suggestions for human review
- `app/exercise-catalog-manifest.ts` — generated catalog and per-source counts
- `public/data/exercises-catalog-index.json` — compact 2,836-record search index
- `public/data/exercises-catalog-details/*.json` — lazy-loaded Chinese/English instruction shards

## Product layers

- **Workout ready:** 107 curated ONE SET exercises with bilingual coaching and reviewed media.
- **Full reference:** 2,836 deduplicated non-media source records, searchable and readable.

The full reference layer never feeds the one-tap workout generator unless a
movement has been reviewed and mapped into the curated layer. The UI renders no
more than 40 catalog rows at once and loads a small detail shard only when a user
opens a movement.

## Rights boundary

The repository's code, dataset structure, metadata, and instruction text are
MIT-licensed. Its `images/` and `videos/` directories are a separate Gym Visual
work and are not covered by MIT. ONE SET does not copy, bundle, proxy, hotlink,
or display those images/GIFs. Adding them later requires a separate commercial
license from Gym Visual.

Free Exercise DB releases its repository under the Unlicense/public-domain
dedication. ONE SET imports 741 unique records from it after exact-name
deduplication. Its image files are still excluded because the original media
provenance has not been independently verified; repository openness alone is
not treated as proof that every photographed asset is safe to redistribute.

The importer intentionally never promotes fuzzy suggestions into the app. This
prevents a similar-looking exercise or different equipment variant from
receiving the wrong instructions.

wger is a community-maintained source. ONE SET imports only records with a
complete English translation, readable instructions, and a per-record CC0,
CC-BY-SA 3.0, or CC-BY-SA 4.0 license. Every imported detail keeps the author,
license URL, and original API record. wger records remain in the reference
layer and do not enter one-tap workouts until separately reviewed. Its media is
not imported by this data job; videos continue through the independent exact-
movement and commercial-rights review described in `docs/tutorial-sourcing.md`.

The wger data endpoint is a live community catalog rather than a Git commit.
The importer therefore validates a complete snapshot of at least 800 records
and writes the exact source count and generation time into
`docs/exercises-dataset-import.json`. A changed count is visible in review, but
a truncated or structurally invalid response stops the import.
