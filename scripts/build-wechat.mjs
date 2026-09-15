import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "packages/workout-domain/index.mjs");
const targetPath = resolve(root, "apps/wechat-mini-program/shared/workout-domain.js");
let source = await readFile(sourcePath, "utf8");
const exported = [];
source = source.replace(/export function ([A-Za-z0-9_]+)\s*\(/g, (_, name) => { exported.push(name); return `function ${name}(`; });
source = source.replace(/export \{ EXERCISES, GROUP_LABELS \};?/, "");
source = source.replace(/globalThis\.crypto\?\.randomUUID/g, "typeof crypto !== 'undefined' && crypto.randomUUID");
source += `\nmodule.exports = { ${[...exported, "EXERCISES", "GROUP_LABELS"].join(", ")} };\n`;
await mkdir(dirname(targetPath), { recursive: true });
await writeFile(targetPath, `// Generated from packages/workout-domain/index.mjs. Do not edit directly.\n${source}`, "utf8");
console.log("Built WeChat shared workout domain.");
