import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const videos = [
  {
    slug: "bent-over-row",
    title: "File:Bent-over row - exercise demonstration video.webm",
    author: "FitnessScape",
    license: "CC BY 3.0",
  },
  {
    slug: "hanging-crunches",
    title: "File:Hanging crunches - exercise demonstration video.webm",
    author: "FitnessScape",
    license: "CC BY 3.0",
  },
  {
    slug: "leg-raises",
    title: "File:Leg raises - exercise demonstration video.webm",
    author: "FitnessScape",
    license: "CC BY 3.0",
  },
  {
    slug: "kettlebell-farmer-walks",
    title: "File:Kettlebell Farmer Walks.webm",
    author: "Taco fleur",
    license: "CC BY-SA 4.0",
  },
];

const outputDir = join(process.cwd(), "public", "exercises", "tutorials");
const workingDir = join(tmpdir(), "one-set-commons-import");
const ffmpeg = process.env.FFMPEG_PATH;

if (!ffmpeg) throw new Error("Set FFMPEG_PATH to an ffmpeg executable before running this importer.");

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function fetchWithRetry(url, options, label) {
  const delays = [0, 1500, 3000, 6000, 12000];
  let lastError;
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) await wait(delays[attempt]);
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      lastError = new Error(`${label} returned ${response.status}`);
      if (response.status !== 429 && response.status < 500) throw lastError;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function fetchMetadata(title) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  for (const [key, value] of Object.entries({
    action: "query",
    format: "json",
    prop: "imageinfo",
    titles: title,
    iiprop: "url|mime|extmetadata",
  })) url.searchParams.set(key, value);
  const response = await fetchWithRetry(url, { headers: { "user-agent": "ONE-SET-media-import/1.0" } }, url.toString());
  const page = Object.values((await response.json()).query?.pages || {})[0];
  return page?.imageinfo?.[0] || null;
}

async function download(url, path) {
  const response = await fetchWithRetry(url, { headers: { "user-agent": "ONE-SET-media-import/1.0" } }, url);
  await writeFile(path, new Uint8Array(await response.arrayBuffer()));
}

function runFfmpeg(args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { stdio: ["ignore", "ignore", "inherit"] });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`${label} exited with ${code}`)));
  });
}

await mkdir(outputDir, { recursive: true });
await rm(workingDir, { recursive: true, force: true });
await mkdir(workingDir, { recursive: true });

for (const item of videos) {
  const output = join(outputDir, `commons-${item.slug}.mp4`);
  const poster = join(outputDir, `commons-${item.slug}.jpg`);
  try {
    await access(output);
    await access(poster);
    console.log(`${item.slug}: already imported`);
    continue;
  } catch {}

  const metadata = await fetchMetadata(item.title);
  const ext = metadata?.extmetadata || {};
  const license = ext.LicenseShortName?.value;
  const author = (ext.Artist?.value || "").replace(/<[^>]+>/g, "").trim();
  if (!metadata?.url || !metadata.mime?.startsWith("video/")) throw new Error(`${item.title} has no video source`);
  if (license !== item.license) throw new Error(`${item.title} license changed from ${item.license} to ${license}`);
  if (!author.toLowerCase().includes(item.author.toLowerCase())) throw new Error(`${item.title} author changed from ${item.author} to ${author}`);

  const sourceUrl = new URL(metadata.url);
  const extension = sourceUrl.pathname.split(".").pop() || "webm";
  const input = join(workingDir, `${item.slug}.${extension}`);
  await download(sourceUrl.toString(), input);
  await runFfmpeg([
    "-y", "-i", input,
    "-vf", "scale=-2:720:force_original_aspect_ratio=decrease,fps=24",
    "-map_metadata", "-1", "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "25",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", output,
  ], `ffmpeg transcode for ${item.slug}`);
  await runFfmpeg(["-y", "-ss", "1", "-i", output, "-frames:v", "1", "-q:v", "3", poster], `poster for ${item.slug}`);
  console.log(`${item.slug}: ${license} · ${author}`);
  await wait(500);
}

await rm(workingDir, { recursive: true, force: true });
console.log(`Imported ${videos.length} Wikimedia Commons tutorials to ${outputDir}`);
