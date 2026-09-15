import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("imports licensed non-media exercise sources and excludes unverified media", async () => {
  const enrichment = await readFile(new URL("app/exercise-dataset-enrichment.ts", root), "utf8");
  const report = JSON.parse(await readFile(new URL("docs/exercises-dataset-import.json", root), "utf8"));
  const attribution = await readFile(new URL("THIRD_PARTY_MEDIA.md", root), "utf8");

  assert.match(enrichment, /7455efae41b330c265e7cd4b78dfa848e7ce5ebd/);
  assert.match(enrichment, /MIT \(non-media data and instruction text only\)/);
  assert.doesNotMatch(enrichment, /gif_url|"image"/);
  assert.equal(report.sourceExerciseCount, 1324);
  assert.equal(report.secondarySourceExerciseCount, 876);
  assert.match(report.secondarySourceCommit, /^[a-f0-9]{40}$/);
  assert.equal(report.secondarySourceLicense, "Unlicense / public domain dedication");
  assert.equal(report.deduplicatedSecondaryRecords, 135);
  assert.equal(report.addedSecondaryRecords, 741);
  assert.equal(report.tertiarySourceExerciseCount, 871);
  assert.equal(report.tertiaryEligibleRecords, 848);
  assert.equal(report.addedTertiaryRecords, 771);
  assert.equal(report.tertiaryExcludedRecords, 23);
  assert.equal(report.catalogExerciseCount, 2836);
  assert.ok(report.approvedExactMatches >= 36);
  assert.equal(report.mediaImported, false);
  assert.equal(report.secondaryMediaImported, false);
  assert.equal(report.tertiaryMediaImported, false);
  assert.match(attribution, /does not grant a reuse\s+license/);
  assert.match(attribution, /free-exercise-db/);
  assert.match(attribution, /provenance has not been independently verified/);
  assert.match(attribution, /wger-project\/wger/);
  assert.match(attribution, /per-record\s+Creative Commons license/);
});

test("renders dataset enrichment in the existing exercise detail flow", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const css = await readFile(new URL("app/globals.css", root), "utf8");

  assert.match(page, /getExerciseDatasetEnrichment\(exercise\.id\)/);
  assert.match(page, /补充动作资料/);
  assert.match(page, /Gym Visual 图片和 GIF 未导入/);
  assert.match(css, /\.dataset-evidence/);
});

test("ships the 2,836-record deduplicated catalog in a bounded lazy-loading UI", async () => {
  const indexRaw = await readFile(new URL("public/data/exercises-catalog-index.json", root), "utf8");
  const index = JSON.parse(indexRaw);
  const shardDirectory = new URL("public/data/exercises-catalog-details/", root);
  const shardFiles = (await readdir(shardDirectory)).filter(file => file.endsWith(".json"));
  const shardRecords = (await Promise.all(shardFiles.map(async file => JSON.parse(await readFile(new URL(file, shardDirectory), "utf8"))))).flat();
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const manifest = await readFile(new URL("app/exercise-catalog-manifest.ts", root), "utf8");

  assert.equal(index.length, 2836);
  assert.equal(shardRecords.length, 2836);
  assert.equal(new Set(index.map(item => item.id)).size, 2836);
  assert.equal(index.filter(item => item.source === "free-exercise-db").length, 741);
  assert.equal(index.filter(item => item.source === "exercises-dataset").length, 1324);
  assert.equal(index.filter(item => item.source === "wger").length, 771);
  assert.ok(index.some(item => item.id.startsWith("f") && item.sourceId === "90_90_Hamstring"));
  assert.ok(index.some(item => item.source === "wger" && item.name === "Body-Ups"));
  assert.match(manifest, /EXERCISE_CATALOG_COUNT = 2836/);
  assert.match(manifest, /wger: 771/);
  assert.doesNotMatch(indexRaw, /gif_url|"image"|media_id|gymvisual/i);
  assert.doesNotMatch(JSON.stringify(shardRecords), /gif_url|"image"|media_id|gymvisual/i);
  const wgerRecords = shardRecords.filter(item => item.source === "wger");
  assert.equal(wgerRecords.length, 771);
  assert.ok(wgerRecords.every(item => item.license && item.licenseAuthor && item.licenseUrl && item.sourceUrl));
  assert.ok(wgerRecords.every(item => item.instructionStepsEn.length > 0));
  assert.doesNotMatch(JSON.stringify(wgerRecords), /<\/?(?:p|li|div|script)\b/i);
  assert.match(page, /全部资料库/);
  assert.match(page, /训练就绪/);
  assert.match(page, /filtered\.slice\(0,visibleCount\)/);
  assert.match(page, /setVisibleCount\(count=>count\+40\)/);
  assert.match(page, /fetch\(EXERCISE_CATALOG_INDEX_URL/);
  assert.match(page, /暂未进入自动训练计划/);
  assert.match(page, /const\[media,setMedia\]=useState<"video"\|"all">\("video"\)/);
  assert.match(page, /getExerciseTutorial\(item\.trainingReadyId\)/);
  assert.match(page, /className="catalog-video-player"/);
  assert.match(page, /selectedTutorial\.src/);
  assert.match(page, /真人短视频演示/);
  assert.match(page, /中文翻译待审核，以下暂显示英文来源说明/);
  assert.match(page, /Exercises Dataset \+ Free Exercise DB \+ wger/);
  assert.match(page, /WGER COMMUNITY/);
  assert.match(page, /查看原始记录/);
});
