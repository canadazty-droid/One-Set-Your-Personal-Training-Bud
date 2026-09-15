# Third-party exercise tutorial media

ONE SET includes a curated group of real-person exercise demonstrations from the
[wger exercise video library](https://wger.de/api/v2/video/). Each imported video
is credited in the product beside the player.

- Author: Goulart
- Provider: wger
- License: [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- Changes: source video was muted, resized to 720p, converted to H.264 MP4, and stripped of device/location metadata for reliable mobile web playback.

The source record for each video remains available from the URL shown in the
exercise tutorial player and in `app/exercise-tutorials.ts`.

ONE SET also includes exact-matching clips selected from the 25-video
[Your Move free exercise video library](https://ymove.app/free-exercise-videos).

- Author/provider: Your Move B.V.
- License: royalty-free commercial use in apps, websites, social media, adverts, and client materials
- Restriction: the clips may not be resold or redistributed as a standalone video library
- Changes: downloaded as the provider's app-ready 720p MP4; no watermark or attribution removal was performed

Only exact movement matches are connected to an exercise. The repeatable audit
and research workflow is documented in `docs/tutorial-sourcing.md`; discovered
GitHub or web assets are never published until the media owner's rights and
commercial-use license are verified separately from the repository's code license.

ONE SET also uses four individually reviewed real-person demonstrations from
[Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:Videos_of_people_demonstrating_strength_training_exercises).

- FitnessScape: bent-over row, hanging knee raise, and hanging leg raise under [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/)
- Taco fleur: one-sided kettlebell farmer walk under [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- Changes: videos were muted, resized to 720p where needed, converted to H.264 MP4, and stripped of embedded metadata for reliable mobile playback
- Attribution: the exact source page, author, license, and processing note are shown beside each player and stored in `app/exercise-tutorials.ts`

## hasaneyldrm/exercises-dataset

ONE SET imports only the MIT-licensed non-media metadata and multilingual
instruction text from the
[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)
repository, pinned to commit `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`.

The repository's Gym Visual thumbnails and GIFs are deliberately excluded. Its
LICENSE and NOTICE state that cloning the repository does not grant a reuse
license for those assets. Existing ONE SET tutorial videos keep their own
separate, verified licenses listed above.

## yuhonas/free-exercise-db

ONE SET imports public-domain exercise names, classifications, muscle metadata,
and instruction text from
[yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db), pinned
to commit `a859101d633a01c4a1a920d6a8ce41dabba0705f`.

The repository's exercise images are deliberately excluded. Their original
photographic provenance has not been independently verified, so the Unlicense
covering the repository is not used as a substitute for a media-rights audit.

## wger community exercise data

ONE SET imports a filtered text-only snapshot from the official
[wger-project/wger](https://github.com/wger-project/wger) exercise catalog.
Each accepted record keeps its contributor, original API URL, and per-record
Creative Commons license (CC0, CC-BY-SA 3.0, or CC-BY-SA 4.0). The catalog UI
shows that attribution beside the exercise instructions.

This data import does not copy wger images or videos. Media remains a separate
review path because a repository or API license does not replace the need to
verify the author, exact movement match, media-specific license, and commercial
reuse rights for every tutorial clip.
