import { readFile, writeFile } from "node:fs/promises";

const exerciseSource = await readFile("app/exercise-data.ts", "utf8");
const tutorialSource = await readFile("app/exercise-tutorials.ts", "utf8");

const exercises = [...exerciseSource.matchAll(/id:"([^"]+)",zh:"([^"]+)",en:"([^"]+)"/g)]
  .map(match => ({ id: match[1], zh: match[2], en: match[3] }));
const tutorialBlock = tutorialSource.match(/const tutorials:[\s\S]*?= \{([\s\S]*?)\n\};/)?.[1] || "";
const tutorialIds = new Set([...tutorialBlock.matchAll(/^\s+(?:"([^"]+)"|([A-Za-z0-9_-]+)):\s+(?:wger|yourMove|commons)\(/gm)]
  .map(match => match[1] || match[2]));

const rows = exercises.map(exercise => ({ ...exercise, hasLicensedRealVideo: tutorialIds.has(exercise.id) }));
const covered = rows.filter(row => row.hasLicensedRealVideo).length;
const report = {
  generatedAt: new Date().toISOString(),
  totalExercises: rows.length,
  licensedRealVideoCount: covered,
  remainingCount: rows.length - covered,
  coveragePercent: Number((covered / rows.length * 100).toFixed(1)),
  exercises: rows,
};

await writeFile("docs/exercise-video-coverage.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(`Licensed real-person coverage: ${covered}/${rows.length} (${report.coveragePercent}%)`);
console.log(`Remaining: ${rows.filter(row => !row.hasLicensedRealVideo).map(row => row.en).join(", ")}`);
