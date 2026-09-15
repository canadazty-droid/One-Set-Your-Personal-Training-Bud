import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const videoIds = [1, 2, 6, 11, 12, 13, 14, 17, 23, 24, 31, 35, 37, 44, 48, 50, 51, 55, 58, 66, 71, 72, 74, 79];
const commonsSlugs = ["bent-over-row", "hanging-crunches", "leg-raises", "kettlebell-farmer-walks"];

test("ships the curated licensed coach tutorial set", async () => {
  const manifest = await readFile(new URL("app/exercise-tutorials.ts", root), "utf8");
  const attribution = await readFile(new URL("THIRD_PARTY_MEDIA.md", root), "utf8");

  assert.match(manifest, /CC BY-SA 4\.0/);
  assert.match(manifest, /Goulart/);
  assert.match(manifest, /Royalty-free commercial use/);
  assert.match(manifest, /Your Move B\.V\./);
  assert.match(manifest, /Wikimedia Commons/);
  assert.match(manifest, /CC BY 3\.0/);
  assert.match(manifest, /FitnessScape/);
  assert.match(manifest, /Taco fleur/);
  assert.match(attribution, /device\/location metadata/);
  assert.match(attribution, /may not be resold or redistributed/);
  assert.match(attribution, /Wikimedia Commons/);
  assert.match(attribution, /Creative Commons Attribution 3\.0/);

  await Promise.all(videoIds.flatMap(id => [
    access(new URL(`public/exercises/tutorials/wger-${id}.mp4`, root)),
    access(new URL(`public/exercises/tutorials/wger-${id}.jpg`, root)),
  ]));

  const sizes = await Promise.all(videoIds.map(id => stat(new URL(`public/exercises/tutorials/wger-${id}.mp4`, root))));
  assert.ok(sizes.every(file => file.size > 500_000));

  await Promise.all(commonsSlugs.flatMap(slug => [
    access(new URL(`public/exercises/tutorials/commons-${slug}.mp4`, root)),
    access(new URL(`public/exercises/tutorials/commons-${slug}.jpg`, root)),
  ]));
});

test("every approved tutorial mapping ships a playable local MP4 and poster", async () => {
  const manifest = await readFile(new URL("app/exercise-tutorials.ts", root), "utf8");
  const files = [...manifest.matchAll(/(?:wger\((\d+),|yourMove\("([^"]+)"\)|commons\("([^"]+)"\s*,)/g)].map(match =>
    match[1] ? `wger-${match[1]}` : match[2] ? `ymove-${match[2]}` : `commons-${match[3]}`
  );
  assert.equal(files.length, 47, `expected 47 approved mappings, found ${files.length}`);
  await Promise.all(files.flatMap(name => [
    access(new URL(`public/exercises/tutorials/${name}.mp4`, root)),
    access(new URL(`public/exercises/tutorials/${name}.jpg`, root)),
  ]));
});

test("keeps kettlebell and dumbbell goblet-squat footage matched to the right equipment", async () => {
  const manifest = await readFile(new URL("app/exercise-tutorials.ts", root), "utf8");
  assert.match(manifest, /Goblet_Squat:\s*yourMove\("kettlebell-goblet-squat"\)/);
  assert.match(manifest, /Dumbbell_Goblet_Squat:\s*yourMove\("dumbbell-goblet-squat"\)/);
});

test("keeps newly sourced real-person footage matched to exact movements", async () => {
  const manifest = await readFile(new URL("app/exercise-tutorials.ts", root), "utf8");
  assert.match(manifest, /Standing_Calf_Raise_Machine:\s*wger\(14,/);
  assert.match(manifest, /Bent_Over_Barbell_Row:\s*commons\("bent-over-row"/);
  assert.match(manifest, /Hanging_Knee_Raise:\s*commons\("hanging-crunches"/);
  assert.match(manifest, /Hanging_Leg_Raise:\s*commons\("leg-raises"/);
  assert.match(manifest, /Kettlebell_Suitcase_Carry:\s*commons\("kettlebell-farmer-walks"/);
  assert.match(manifest, /Seated_Cable_Rows:\s*yourMove\("seated-cable-row-neutral-grip"\)/);
  assert.match(manifest, /Cable_Rope_Overhead_Triceps_Extension:\s*yourMove\("overhead-cable-rope-extension"\)/);
});

test("renders honest source labels and interactive playback controls", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const css = await readFile(new URL("app/globals.css", root), "utf8");

  assert.match(page, /真人动作示范/);
  assert.match(page, /不冒充真人教学视频/);
  assert.match(page, /0\.5× 慢放/);
  assert.match(page, /镜像跟练/);
  assert.match(page, /tutorial\.sourceUrl/);
  assert.match(page, /tutorial\.provider/);
  assert.match(css, /licensed-coach-video/);
  assert.match(css, /object-fit:contain/);
});
