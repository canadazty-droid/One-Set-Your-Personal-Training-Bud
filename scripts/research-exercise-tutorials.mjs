import { readFile, writeFile } from "node:fs/promises";

const firecrawlKey = process.env.FIRECRAWL_API_KEY;
const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const requestedLimit = Number(process.argv.find(value => value.startsWith("--limit="))?.split("=")[1] || 10);
const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(25, requestedLimit)) : 10;

const coverage = JSON.parse(await readFile("docs/exercise-video-coverage.json", "utf8"));
const uncovered = coverage.exercises.filter(exercise => !exercise.hasLicensedRealVideo).slice(0, limit);
let candidates = [];
try { candidates = JSON.parse(await readFile("docs/tutorial-candidates.json", "utf8")); } catch {}

async function firecrawlSearch(exercise) {
  if (!firecrawlKey) return [];
  const response = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { authorization: `Bearer ${firecrawlKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      query: `\"${exercise.en}\" real person exercise demonstration video commercial use license`,
      limit: 5,
      sources: [{ type: "web" }],
    }),
  });
  if (!response.ok) throw new Error(`Firecrawl search failed with ${response.status}`);
  const body = await response.json();
  const results = body.data?.web || body.data || [];
  return results.map(result => ({
    discoveryMethod: "firecrawl",
    candidateUrl: result.url,
    title: result.title || "",
    description: result.description || "",
  }));
}

async function githubSearch(exercise) {
  if (!githubToken) return [];
  const query = encodeURIComponent(`\"${exercise.en}\" exercise video library in:name,description,readme`);
  const response = await fetch(`https://api.github.com/search/repositories?q=${query}&sort=updated&per_page=5`, {
    headers: {
      authorization: `Bearer ${githubToken}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "ONE-SET-media-research/1.0",
    },
  });
  if (!response.ok) throw new Error(`GitHub search failed with ${response.status}`);
  const body = await response.json();
  return (body.items || []).map(result => ({
    discoveryMethod: "github",
    candidateUrl: result.html_url,
    title: result.full_name,
    description: result.description || "",
    repositoryLicense: result.license?.spdx_id || null,
  }));
}

for (const exercise of uncovered) {
  const discovered = [...await firecrawlSearch(exercise), ...await githubSearch(exercise)];
  for (const result of discovered) {
    const key = `${exercise.id}|${result.candidateUrl}`;
    if (candidates.some(candidate => candidate.key === key)) continue;
    candidates.push({
      key,
      exerciseId: exercise.id,
      exerciseName: exercise.en,
      ...result,
      exactMovementMatch: null,
      realPersonVideo: null,
      mediaOwner: null,
      mediaLicense: null,
      commercialUseAllowed: null,
      attributionRequired: null,
      reviewStatus: "needs-human-license-review",
      discoveredAt: new Date().toISOString(),
    });
  }
  console.log(`${exercise.en}: ${discovered.length} candidates`);
}

await writeFile("docs/tutorial-candidates.json", `${JSON.stringify(candidates, null, 2)}\n`);
if (!firecrawlKey) console.warn("FIRECRAWL_API_KEY is missing; Firecrawl search was skipped.");
if (!githubToken) console.warn("GITHUB_TOKEN/GH_TOKEN is missing; GitHub API search was skipped.");
console.log(`Candidate ledger: ${candidates.length} records. Nothing is auto-approved or auto-published.`);
