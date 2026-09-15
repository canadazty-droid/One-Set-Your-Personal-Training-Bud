import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const videoIds = [1, 2, 6, 11, 12, 13, 14, 17, 23, 24, 31, 35, 37, 44, 48, 50, 51, 55, 58, 66, 71, 72, 74, 79];
const outputDir = join(process.cwd(), "public", "exercises", "tutorials");
const workingDir = join(tmpdir(), "one-set-wger-import");
const ffmpeg = process.env.FFMPEG_PATH;

if (!ffmpeg) {
  throw new Error("Set FFMPEG_PATH to an ffmpeg executable before running this importer.");
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "ONE-SET-media-import" } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function download(url, path) {
  const response = await fetch(url, { headers: { "user-agent": "ONE-SET-media-import" } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  await writeFile(path, new Uint8Array(await response.arrayBuffer()));
}

function transcode(input, output) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, [
      "-y", "-i", input,
      "-vf", "scale=-2:720:force_original_aspect_ratio=decrease,fps=24",
      "-map_metadata", "-1", "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "27",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart", output,
    ], { stdio: ["ignore", "ignore", "inherit"] });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)));
  });
}

function makePoster(input, output) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, [
      "-y", "-ss", "1.5", "-i", input, "-frames:v", "1", "-q:v", "3", output,
    ], { stdio: ["ignore", "ignore", "inherit"] });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`ffmpeg poster exited with ${code}`)));
  });
}

await mkdir(outputDir, { recursive: true });
await rm(workingDir, { recursive: true, force: true });
await mkdir(workingDir, { recursive: true });

for (const id of videoIds) {
  const output = join(outputDir, `wger-${id}.mp4`);
  const poster = join(outputDir, `wger-${id}.jpg`);
  try {
    await access(output);
    await access(poster);
    console.log(`Skipping ${id}: local tutorial already exists`);
    continue;
  } catch {}
  const metadata = await fetchJson(`https://wger.de/api/v2/video/${id}/`);
  if (metadata.license !== 2) throw new Error(`Video ${id} is not CC-BY-SA 4.0`);
  const input = join(workingDir, `wger-${id}.${metadata.video.split(".").pop() || "mov"}`);
  console.log(`Importing ${id}: ${metadata.exercise} · ${metadata.license_author}`);
  await download(metadata.video, input);
  await transcode(input, output);
  await makePoster(output, poster);
}

await rm(workingDir, { recursive: true, force: true });
console.log(`Imported ${videoIds.length} licensed tutorials to ${outputDir}`);
