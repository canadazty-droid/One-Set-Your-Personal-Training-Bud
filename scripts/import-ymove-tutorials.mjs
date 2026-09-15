import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const videos = [
  ["barbell-back-squat", "fd0eaa34-d14b-4421-b41c-1669f93253b3"],
  ["barbell-bench-press", "dd7e706c-2086-4f4b-867f-d7fece2f720d"],
  ["barbell-deadlift", "b59952ca-1551-4c07-835d-ab78bfe9953c"],
  ["dumbbell-lateral-raise", "a16f0235-20eb-4306-b9cc-c01ae51b3b9b"],
  ["hammer-curls", "b11e6c6f-b2e8-44ca-95dc-adf0dcd34426"],
  ["single-arm-dumbbell-row", "d3fece95-c7e2-4794-ba8f-65a5b3e30a28"],
  ["dumbbell-goblet-squat", "a2a797d0-f6f6-436e-8616-6c1d93e73d67"],
  ["kettlebell-swing", "13263f92-5fe2-4d92-bec0-808f8b315620"],
  ["kettlebell-push-press", "3880aaa4-e1c0-4153-95d0-da44ea01e099"],
  ["kettlebell-romanian-deadlift", "e7175536-9d7d-4f5d-8d49-26c3411eac80"],
  ["kettlebell-goblet-squat", "198d4a7d-bc23-41f8-ad67-4fe9ab876b89"],
  ["lat-pulldown-v-grip", "9302ad5d-b97a-4b27-afae-611b6ce70a06"],
  ["seated-cable-row-neutral-grip", "499ccaa4-719d-40bd-b441-511291482471"],
  ["pec-deck-fly", "4d197e26-766c-4c5c-b937-9918e56c5b9b"],
  ["incline-machine-press", "35a53872-f47c-4ec6-9bdd-888eb1705572"],
  ["cable-tricep-pushdown", "9a550e2c-c55e-495d-b59e-b676c3d48a41"],
  ["overhead-cable-rope-extension", "c57e3719-a853-453f-b04a-da0c9475d6e7"],
  ["machine-bicep-curl", "6622f4ed-5af3-4275-af0e-7dc23dd8ff78"],
  ["high-cable-curl", "770e5cb2-882b-413a-8071-941acd8e4064"],
  ["lying-leg-curl", "34a512bf-baa1-48ac-a5b9-132073166018"],
  ["leg-extension", "3d0e78d0-1125-4d25-8bd4-9ca7ba3799e8"],
  ["hack-squat", "800cc264-d388-4200-8568-8f1df46e9be9"],
  ["glute-kickback-machine", "5611abf4-57f7-4153-b29d-a17cd7e2907d"],
  ["machine-reverse-fly", "31fa8cba-bf48-4c16-9cf9-6a3627ee9bea"],
  ["cable-woodchop-high-to-low", "e1f80c59-7160-4df2-babb-0aa0eeb54fea"],
];

const outputDir = join(process.cwd(), "public", "exercises", "tutorials");
await mkdir(outputDir, { recursive: true });

async function download(url, target, expectedPrefix) {
  const response = await fetch(url, { headers: { "user-agent": "ONE-SET-licensed-media-import/1.0" } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  const type = response.headers.get("content-type") || "";
  if (!type.startsWith(expectedPrefix)) throw new Error(`${url} returned unexpected ${type}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 10_000) throw new Error(`${url} returned only ${bytes.byteLength} bytes`);
  await writeFile(target, bytes);
  return bytes.byteLength;
}

for (const [slug, id] of videos) {
  const base = `https://ymove.app/api/free/${id}`;
  const videoPath = join(outputDir, `ymove-${slug}.mp4`);
  const posterPath = join(outputDir, `ymove-${slug}.jpg`);
  try {
    await access(videoPath);
    await access(posterPath);
    console.log(`${slug}: already imported`);
    continue;
  } catch {}
  const videoBytes = await download(base, videoPath, "video/");
  const posterBytes = await download(`${base}?type=thumbnail`, posterPath, "image/");
  console.log(`${slug}: ${(videoBytes / 1_000_000).toFixed(1)} MB video, ${(posterBytes / 1_000).toFixed(0)} KB poster`);
}

console.log(`Imported ${videos.length} Your Move tutorials with commercial-use permission.`);
