import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("ships five native Mini Program primary areas", async () => {
  const app = JSON.parse(await read("apps/wechat-mini-program/app.json"));
  assert.deepEqual(app.tabBar.list.map(item => item.text), ["今天", "训练", "计划", "进度", "我的"]);
  assert.ok(app.pages.includes("pages/onboarding/index"));
  assert.equal(app.tabBar.list.length, 5);
});

test("keeps the Mini Program workout loop native and one-tap", async () => {
  const [today, workout, plans, api] = await Promise.all([
    read("apps/wechat-mini-program/pages/today/index.wxml"),
    read("apps/wechat-mini-program/pages/workout/index.wxml"),
    read("apps/wechat-mini-program/pages/plans/index.wxml"),
    read("apps/wechat-mini-program/shared/api.js"),
  ]);
  assert.match(today, /生成今天训练/);
  assert.match(today, /导入训练计划/);
  assert.match(workout, /✓ 完成本组/);
  assert.match(workout, /上次/);
  assert.match(workout, /RPE \/ RIR \/ 组类型/);
  assert.match(plans, /一句话记录/);
  assert.match(api, /source: "mini_program"/);
});

test("adds canonical WeChat identity and structured set metadata", async () => {
  const [schema, migration, auth, route] = await Promise.all([
    read("db/schema.ts"), read("drizzle/0010_wechat_mini_program.sql"), read("lib/form/auth.ts"), read("app/api/auth/wechat/route.ts"),
  ]);
  assert.match(schema, /userIdentities/);
  assert.match(schema, /userSessions/);
  assert.match(migration, /ALTER TABLE `workout_sets` ADD `rpe`/);
  assert.match(migration, /ADD `set_type`/);
  assert.match(auth, /Bearer oneset_mp_/);
  assert.match(route, /jscode2session/);
  assert.match(route, /provider: "wechat"/);
});

test("preserves and expands CLI and authenticated MCP surfaces", async () => {
  const [pkg, cli, mcp] = await Promise.all([read("package.json"), read("cli/form.mjs"), read("mcp/server.mjs")]);
  assert.match(pkg, /"oneset": "cli\/form\.mjs"/);
  assert.match(cli, /group === "auth" && command === "status"/);
  for (const tool of ["get_progress", "create_workout", "update_workout", "update_training_goal"]) assert.match(mcp, new RegExp(`name: "${tool}"`));
  assert.doesNotMatch(mcp, /SELECT\s+\*/i);
});
