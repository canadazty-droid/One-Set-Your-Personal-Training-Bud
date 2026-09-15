import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SOURCE_REPOSITORY = "https://github.com/hasaneyldrm/exercises-dataset";
const SOURCE_COMMIT = "7455efae41b330c265e7cd4b78dfa848e7ce5ebd";
const SOURCE_DATA_URL = `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/${SOURCE_COMMIT}/data/exercises.json`;
const FREE_SOURCE_REPOSITORY = "https://github.com/yuhonas/free-exercise-db";
const FREE_SOURCE_COMMIT = "a859101d633a01c4a1a920d6a8ce41dabba0705f";
const FREE_SOURCE_DATA_URL = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${FREE_SOURCE_COMMIT}/dist/exercises.json`;
const WGER_SOURCE_REPOSITORY = "https://github.com/wger-project/wger";
const WGER_SOURCE_COMMIT = "d1fb2489ccf472894cef34ab8fb37ad9b9f35635";
const WGER_SOURCE_DATA_URL = "https://wger.de/api/v2/exerciseinfo/?limit=1000";
const WGER_MINIMUM_SOURCE_COUNT = 800;
const LOCAL_DATASET = process.env.EXERCISES_DATASET_FILE;
const LOCAL_FREE_DATASET = process.env.FREE_EXERCISE_DB_FILE;
const LOCAL_WGER_DATASET = process.env.WGER_EXERCISE_FILE;
const root = resolve(import.meta.dirname, "..");

// Deliberately narrow aliases. A dataset record is connected only when the movement
// and equipment are the same; fuzzy suggestions are audit-only.
const sourceNameAliases = {
  "Wall_Push-Up": ["wall push-up"],
  "Kneeling_Push-Up": ["knee push-up"],
  Bodyweight_Box_Squat: ["bodyweight box squat"],
  Supported_Split_Squat: ["split squat"],
  "Chest-Supported_Dumbbell_Row": ["dumbbell incline row"],
  "Incline_Push-Up": ["incline push-up"],
  Butt_Lift_Bridge: ["glute bridge"],
  Leverage_Chest_Press: ["lever chest press"],
  Leg_Extensions: ["lever leg extension"],
  Lying_Leg_Curls: ["lever lying leg curl"],
  Hammer_Curls: ["dumbbell hammer curl"],
  "Triceps_Pushdown_-_Rope_Attachment": ["cable rope pushdown"],
  Side_Lateral_Raise: ["dumbbell lateral raise"],
  Seated_Cable_Rows: ["cable seated row"],
  "Neutral-Grip_Lat_Pulldown": ["cable neutral grip lat pulldown"],
  Reverse_Pec_Deck: ["lever reverse fly"],
  Machine_Shoulder_Press: ["lever shoulder press"],
  Assisted_Dip_Machine: ["assisted triceps dip"],
  Cable_Biceps_Curl: ["cable biceps curl"],
  Dumbbell_Bench_Press: ["dumbbell bench press"],
  Incline_Dumbbell_Press: ["dumbbell incline bench press"],
  Standing_Cable_Chest_Press: ["cable standing chest press"],
  Dumbbell_Bicep_Curl: ["dumbbell biceps curl"],
  "Cable_One_Arm_Tricep_Extension": ["cable one arm tricep pushdown"],
  Cable_Rope_Overhead_Triceps_Extension: ["cable overhead triceps extension rope attachment"],
  "One-Arm_Dumbbell_Row": ["dumbbell one arm bent-over row"],
  Romanian_Deadlift: ["barbell romanian deadlift"],
  Goblet_Squat: ["dumbbell goblet squat"],
  Dumbbell_Lunges: ["dumbbell lunge"],
  Barbell_Hip_Thrust: ["barbell hip thrust"],
  Seated_Leg_Curl: ["lever seated leg curl"],
  Seated_Calf_Raise: ["lever seated calf raise"],
  Standing_Calf_Raise_Machine: ["lever standing calf raise"],
  Machine_Hip_Adduction: ["lever seated hip adduction"],
  Face_Pull: ["cable standing face pull"],
  Cable_Wood_Chop: ["cable wood chop"],
  Bird_Dog: ["bird dog"],
  Dead_Bug: ["dead bug"],
  Plank: ["front plank"],
  Hanging_Knee_Raise: ["assisted hanging knee raise"],
  Hanging_Leg_Raise: ["hanging leg raise"],
  Pushups: ["push-up"],
  "Barbell_Bench_Press_-_Medium_Grip": ["barbell bench press"],
  Bent_Over_Barbell_Row: ["barbell bent over row"],
  Barbell_Deadlift: ["barbell deadlift"],
  Barbell_Full_Squat: ["barbell full squat"],
  Cable_Crossover: ["cable crossover"],
  Pullups: ["pull-up"],
  "Dips_-_Triceps_Version": ["triceps dip"],
  "EZ-Bar_Curl": ["ez barbell curl"],
};

const normalize = value => value
  .toLowerCase()
  .replaceAll("&", " and ")
  .replace(/\b(single|one)[ -]?arm\b/g, "one arm")
  .replace(/\bpushups?\b/g, "push up")
  .replace(/\bpullups?\b/g, "pull up")
  .replace(/\bbiceps\b/g, "bicep")
  .replace(/\btriceps\b/g, "tricep")
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

const tokens = value => new Set(normalize(value).split(" ").filter(word => word.length > 2));
const similarity = (left, right) => {
  const a = tokens(left);
  const b = tokens(right);
  const overlap = [...a].filter(token => b.has(token)).length;
  return overlap / Math.max(1, new Set([...a, ...b]).size);
};

const fetchText = async url => {
  const response = await fetch(url, { headers: { "user-agent": "one-set-dataset-importer" } });
  if (!response.ok) throw new Error(`Dataset download failed: ${response.status} ${response.statusText}`);
  return response.text();
};

const loadDataset = async () => {
  const raw = LOCAL_DATASET
    ? await readFile(resolve(root, LOCAL_DATASET), "utf8")
    : await fetchText(SOURCE_DATA_URL);
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length !== 1324) {
    throw new Error(`Expected 1,324 source records, received ${Array.isArray(parsed) ? parsed.length : "invalid JSON"}`);
  }
  return parsed;
};

const loadFreeDataset = async () => {
  const raw = LOCAL_FREE_DATASET
    ? await readFile(resolve(root, LOCAL_FREE_DATASET), "utf8")
    : await fetchText(FREE_SOURCE_DATA_URL);
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length !== 876) {
    throw new Error(`Expected 876 Free Exercise DB records, received ${Array.isArray(parsed) ? parsed.length : "invalid JSON"}`);
  }
  return parsed;
};

const loadWgerDataset = async () => {
  const raw = LOCAL_WGER_DATASET
    ? await readFile(resolve(root, LOCAL_WGER_DATASET), "utf8")
    : await fetchText(WGER_SOURCE_DATA_URL);
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed?.results) || parsed.count < WGER_MINIMUM_SOURCE_COUNT || parsed.results.length !== parsed.count) {
    throw new Error(`Expected a complete wger snapshot with at least ${WGER_MINIMUM_SOURCE_COUNT} records, received ${Array.isArray(parsed?.results) ? parsed.results.length : "invalid JSON"}`);
  }
  return parsed.results;
};

const bodyPartByMuscle = {
  abdominals: "waist",
  abductors: "upper legs",
  adductors: "upper legs",
  biceps: "upper arms",
  calves: "lower legs",
  chest: "chest",
  forearms: "lower arms",
  glutes: "upper legs",
  hamstrings: "upper legs",
  lats: "back",
  "lower back": "back",
  "middle back": "back",
  neck: "neck",
  quadriceps: "upper legs",
  shoulders: "shoulders",
  traps: "back",
  triceps: "upper arms",
};

const equipmentAliases = {
  bands: "band",
  "body only": "body weight",
  "e-z curl bar": "ez barbell",
  "exercise ball": "stability ball",
  kettlebells: "kettlebell",
  machine: "leverage machine",
};

const freeCatalogId = sourceId => {
  let hash = 2166136261;
  for (const character of sourceId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `f${((hash >>> 0) % 16).toString(16)}-${sourceId}`;
};

const freeBodyPart = item => item.category === "cardio"
  ? "cardio"
  : bodyPartByMuscle[item.primaryMuscles?.[0]] || "waist";

const freeEquipment = value => equipmentAliases[value] || value || "body weight";

const wgerBodyPart = value => ({
  Abs: "waist",
  Arms: "upper arms",
  Back: "back",
  Calves: "lower legs",
  Cardio: "cardio",
  Chest: "chest",
  Legs: "upper legs",
  Shoulders: "shoulders",
})[value] || "other";

const decodeHtml = value => value
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));

const plainText = value => decodeHtml(String(value || "")
  .replace(/<br\s*\/?\s*>/gi, "\n")
  .replace(/<\/(?:p|li|div|h[1-6])>/gi, "\n")
  .replace(/<[^>]*>/g, " "))
  .replace(/\r/g, "")
  .replace(/[ \t]+/g, " ")
  .replace(/ *\n */g, "\n")
  .trim();

const wgerInstructionSteps = translation => {
  const source = translation?.description || translation?.description_source || "";
  const listItems = [...String(source).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map(match => plainText(match[1]))
    .filter(Boolean);
  if (listItems.length) return listItems;
  const paragraphs = plainText(source).split(/\n+/).map(value => value.trim()).filter(Boolean);
  return paragraphs.length ? paragraphs : [];
};

const wgerCatalogId = sourceId => `w${(Number(sourceId) % 16).toString(16)}-${sourceId}`;

const source = await readFile(resolve(root, "app/exercise-data.ts"), "utf8");
const localExercises = [...source.matchAll(/ex\(\{id:"([^"]+)",zh:"([^"]+)",en:"([^"]+)"/g)]
  .map(match => ({ id: match[1], zh: match[2], en: match[3] }));
const dataset = await loadDataset();
const freeDataset = await loadFreeDataset();
const wgerDataset = await loadWgerDataset();
const byName = new Map();
for (const exercise of dataset) {
  const key = normalize(exercise.name);
  const entries = byName.get(key) || [];
  entries.push(exercise);
  byName.set(key, entries);
}

const approved = {};
const unmatched = [];
const ambiguous = [];
for (const local of localExercises) {
  const acceptedNames = [local.en, ...(sourceNameAliases[local.id] || [])];
  const candidates = acceptedNames.flatMap(name => byName.get(normalize(name)) || []);
  const unique = [...new Map(candidates.map(item => [item.id, item])).values()];
  if (unique.length === 1) {
    const match = unique[0];
    approved[local.id] = {
      datasetId: match.id,
      sourceName: match.name,
      category: match.category,
      bodyPart: match.body_part,
      equipment: match.equipment,
      target: match.target,
      muscleGroup: match.muscle_group,
      secondaryMuscles: match.secondary_muscles,
      instructionStepsZh: match.instruction_steps?.zh || [],
      instructionStepsEn: match.instruction_steps?.en || [],
    };
  } else if (unique.length > 1) {
    ambiguous.push({ ...local, candidates: unique.map(item => ({ id: item.id, name: item.name, equipment: item.equipment })) });
  } else {
    const suggestions = dataset
      .map(item => ({ id: item.id, name: item.name, equipment: item.equipment, score: similarity(local.en, item.name) }))
      .filter(item => item.score >= 0.35)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    unmatched.push({ ...local, suggestions });
  }
}

const generated = `// Generated by scripts/import-exercises-dataset.mjs. Do not edit by hand.\n` +
`// Non-media metadata and instruction text: MIT. Images/GIFs are intentionally excluded.\n` +
`export type ExerciseDatasetEnrichment = {\n` +
`  datasetId: string; sourceName: string; category: string; bodyPart: string; equipment: string;\n` +
`  target: string; muscleGroup: string; secondaryMuscles: string[];\n` +
`  instructionStepsZh: string[]; instructionStepsEn: string[];\n` +
`};\n\n` +
`export const exerciseDatasetSource = {\n` +
`  repository: ${JSON.stringify(SOURCE_REPOSITORY)},\n` +
`  commit: ${JSON.stringify(SOURCE_COMMIT)},\n` +
`  license: "MIT (non-media data and instruction text only)",\n` +
`} as const;\n\n` +
`const enrichments: Record<string, ExerciseDatasetEnrichment> = ${JSON.stringify(approved, null, 2)};\n\n` +
`export const getExerciseDatasetEnrichment = (exerciseId: string) => enrichments[exerciseId] ?? null;\n` +
`export const exerciseDatasetEnrichmentCount = Object.keys(enrichments).length;\n`;

const report = {
  generatedAt: new Date().toISOString(),
  sourceRepository: SOURCE_REPOSITORY,
  sourceCommit: SOURCE_COMMIT,
  sourceExerciseCount: dataset.length,
  secondarySourceRepository: FREE_SOURCE_REPOSITORY,
  secondarySourceCommit: FREE_SOURCE_COMMIT,
  secondarySourceLicense: "Unlicense / public domain dedication",
  secondarySourceExerciseCount: freeDataset.length,
  tertiarySourceRepository: WGER_SOURCE_REPOSITORY,
  tertiarySourceCommit: WGER_SOURCE_COMMIT,
  tertiarySourceDataUrl: WGER_SOURCE_DATA_URL,
  tertiarySourceLicense: "Per-record CC0, CC-BY-SA 3.0, or CC-BY-SA 4.0",
  tertiarySourceExerciseCount: wgerDataset.length,
  localExerciseCount: localExercises.length,
  approvedExactMatches: Object.keys(approved).length,
  unmatched,
  ambiguous,
  mediaImported: false,
  mediaReason: "Gym Visual images and GIFs are excluded because cloning the repository does not grant a reuse license.",
};

const trainingReadyByDatasetId = Object.fromEntries(
  Object.entries(approved).map(([localId, item]) => [item.datasetId, localId]),
);
const catalogIndex = dataset.map(item => ({
  id: item.id,
  source: "exercises-dataset",
  sourceId: item.id,
  name: item.name,
  category: item.category,
  bodyPart: item.body_part,
  equipment: item.equipment,
  target: item.target,
  muscleGroup: item.muscle_group,
  secondaryMuscles: item.secondary_muscles || [],
  ...(trainingReadyByDatasetId[item.id] ? { trainingReadyId: trainingReadyByDatasetId[item.id] } : {}),
}));
const existingCatalogNames = new Set(catalogIndex.map(item => normalize(item.name)));
const freeAdditions = freeDataset.filter(item => !existingCatalogNames.has(normalize(item.name)));
for (const item of freeAdditions) {
  const primary = item.primaryMuscles?.[0] || "general";
  catalogIndex.push({
    id: freeCatalogId(item.id),
    source: "free-exercise-db",
    sourceId: item.id,
    name: item.name,
    category: item.category,
    bodyPart: freeBodyPart(item),
    equipment: freeEquipment(item.equipment),
    target: primary,
    muscleGroup: primary,
    secondaryMuscles: item.secondaryMuscles || [],
    level: item.level || undefined,
    force: item.force || undefined,
    mechanic: item.mechanic || undefined,
  });
  existingCatalogNames.add(normalize(item.name));
}
report.deduplicatedSecondaryRecords = freeDataset.length - freeAdditions.length;
report.addedSecondaryRecords = freeAdditions.length;
report.secondaryMediaImported = false;
report.secondaryMediaReason = "Free Exercise DB image origins are not independently verified, so only public-domain text and metadata are imported.";

const allowedWgerLicenses = new Set(["CC0", "CC-BY-SA 3", "CC-BY-SA 4"]);
const wgerCandidates = wgerDataset.flatMap(item => {
  const translation = item.translations?.find(entry => entry.language === 2 && entry.name?.trim());
  const instructionStepsEn = wgerInstructionSteps(translation);
  if (!translation || !allowedWgerLicenses.has(item.license?.short_name) || !instructionStepsEn.length) return [];
  return [{ item, translation, instructionStepsEn }];
});
const wgerAdditions = [];
for (const candidate of wgerCandidates) {
  const key = normalize(candidate.translation.name);
  if (existingCatalogNames.has(key)) continue;
  existingCatalogNames.add(key);
  wgerAdditions.push(candidate);
  const primaryMuscles = candidate.item.muscles?.map(muscle => muscle.name_en || muscle.name).filter(Boolean) || [];
  const secondaryMuscles = candidate.item.muscles_secondary?.map(muscle => muscle.name_en || muscle.name).filter(Boolean) || [];
  const primary = primaryMuscles[0] || candidate.item.category?.name || "General";
  const equipment = candidate.item.equipment?.map(entry => entry.name).filter(Boolean) || [];
  catalogIndex.push({
    id: wgerCatalogId(candidate.item.id),
    source: "wger",
    sourceId: String(candidate.item.id),
    name: candidate.translation.name.trim(),
    category: candidate.item.category?.name === "Cardio" ? "cardio" : "strength",
    bodyPart: wgerBodyPart(candidate.item.category?.name),
    equipment: equipment.length ? equipment.join(" + ").replace("none (bodyweight exercise)", "body weight") : "body weight",
    target: primary,
    muscleGroup: primaryMuscles.join(" · ") || primary,
    secondaryMuscles,
  });
}
report.tertiaryEligibleRecords = wgerCandidates.length;
report.deduplicatedTertiaryRecords = wgerCandidates.length - wgerAdditions.length;
report.addedTertiaryRecords = wgerAdditions.length;
report.tertiaryExcludedRecords = wgerDataset.length - wgerCandidates.length;
report.tertiaryMediaImported = false;
report.tertiaryMediaReason = "wger exercise text is imported with per-record attribution. Images and videos remain in the separate media review pipeline.";
report.catalogExerciseCount = catalogIndex.length;
const detailShards = new Map();
for (const item of dataset) {
  const shard = item.id.slice(0, 2);
  const entries = detailShards.get(shard) || [];
  entries.push({
    id: item.id,
    source: "exercises-dataset",
    sourceId: item.id,
    name: item.name,
    category: item.category,
    bodyPart: item.body_part,
    equipment: item.equipment,
    target: item.target,
    muscleGroup: item.muscle_group,
    secondaryMuscles: item.secondary_muscles || [],
    instructionStepsZh: item.instruction_steps?.zh || [],
    instructionStepsEn: item.instruction_steps?.en || [],
    ...(trainingReadyByDatasetId[item.id] ? { trainingReadyId: trainingReadyByDatasetId[item.id] } : {}),
  });
  detailShards.set(shard, entries);
}
for (const item of freeAdditions) {
  const id = freeCatalogId(item.id);
  const shard = id.slice(0, 2);
  const entries = detailShards.get(shard) || [];
  const primary = item.primaryMuscles?.[0] || "general";
  entries.push({
    id,
    source: "free-exercise-db",
    sourceId: item.id,
    name: item.name,
    category: item.category,
    bodyPart: freeBodyPart(item),
    equipment: freeEquipment(item.equipment),
    target: primary,
    muscleGroup: primary,
    secondaryMuscles: item.secondaryMuscles || [],
    instructionStepsZh: [],
    instructionStepsEn: item.instructions || [],
    level: item.level || undefined,
    force: item.force || undefined,
    mechanic: item.mechanic || undefined,
  });
  detailShards.set(shard, entries);
}
for (const candidate of wgerAdditions) {
  const id = wgerCatalogId(candidate.item.id);
  const shard = id.slice(0, 2);
  const entries = detailShards.get(shard) || [];
  const primaryMuscles = candidate.item.muscles?.map(muscle => muscle.name_en || muscle.name).filter(Boolean) || [];
  const secondaryMuscles = candidate.item.muscles_secondary?.map(muscle => muscle.name_en || muscle.name).filter(Boolean) || [];
  const primary = primaryMuscles[0] || candidate.item.category?.name || "General";
  const equipment = candidate.item.equipment?.map(entry => entry.name).filter(Boolean) || [];
  entries.push({
    id,
    source: "wger",
    sourceId: String(candidate.item.id),
    name: candidate.translation.name.trim(),
    category: candidate.item.category?.name === "Cardio" ? "cardio" : "strength",
    bodyPart: wgerBodyPart(candidate.item.category?.name),
    equipment: equipment.length ? equipment.join(" + ").replace("none (bodyweight exercise)", "body weight") : "body weight",
    target: primary,
    muscleGroup: primaryMuscles.join(" · ") || primary,
    secondaryMuscles,
    instructionStepsZh: [],
    instructionStepsEn: candidate.instructionStepsEn,
    license: candidate.item.license.short_name,
    licenseUrl: candidate.item.license.url,
    licenseAuthor: candidate.item.license_author || "wger community contributor",
    sourceUrl: `https://wger.de/api/v2/exerciseinfo/${candidate.item.id}/`,
  });
  detailShards.set(shard, entries);
}

const outputFile = resolve(root, "app/exercise-dataset-enrichment.ts");
const reportFile = resolve(root, "docs/exercises-dataset-import.json");
const catalogIndexFile = resolve(root, "public/data/exercises-catalog-index.json");
const catalogDetailDirectory = resolve(root, "public/data/exercises-catalog-details");
const catalogManifestFile = resolve(root, "app/exercise-catalog-manifest.ts");
await mkdir(dirname(outputFile), { recursive: true });
await mkdir(dirname(reportFile), { recursive: true });
await mkdir(dirname(catalogIndexFile), { recursive: true });
await mkdir(catalogDetailDirectory, { recursive: true });
await writeFile(catalogManifestFile, `// Generated by scripts/import-exercises-dataset.mjs. Do not edit by hand.\nexport const EXERCISE_CATALOG_COUNT = ${catalogIndex.length};\nexport const EXERCISE_CATALOG_SOURCE_COUNTS = { exercisesDataset: ${dataset.length}, freeExerciseDb: ${freeAdditions.length}, wger: ${wgerAdditions.length} } as const;\n`, "utf8");
await writeFile(outputFile, generated, "utf8");
await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(catalogIndexFile, `${JSON.stringify(catalogIndex)}\n`, "utf8");
for (const [shard, entries] of detailShards) {
  await writeFile(resolve(catalogDetailDirectory, `${shard}.json`), `${JSON.stringify(entries)}\n`, "utf8");
}

console.log(`Imported ${Object.keys(approved).length}/${localExercises.length} exact exercise matches from ${dataset.length} source records.`);
console.log(`Unmatched: ${unmatched.length}; ambiguous: ${ambiguous.length}; media imported: no.`);
console.log(`Generated ${catalogIndex.length} catalog index records across ${detailShards.size} lazy detail shards.`);
console.log(`Added ${freeAdditions.length}/${freeDataset.length} Free Exercise DB records after removing ${freeDataset.length - freeAdditions.length} exact-name duplicates.`);
console.log(`Added ${wgerAdditions.length}/${wgerDataset.length} licensed wger text records after quality filtering and exact-name deduplication.`);
