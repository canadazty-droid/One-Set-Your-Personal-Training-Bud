/** ONE SET Fitness OS MCP server. Deterministic app tools; no external AI calls. */
const API_URL = (process.env.FORM_API_URL || "http://localhost:3000").replace(/\/$/, "");
const DEV_USER = process.env.FORM_DEV_USER || process.env.FORM_DEV_EMAIL || "";
const API_TOKEN = process.env.FORM_API_TOKEN || "";

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: {
    "content-type": "application/json", ...(API_TOKEN ? { authorization: `Bearer ${API_TOKEN}` } : {}),
    ...(DEV_USER ? { "x-form-dev-user": DEV_USER } : {}), ...(options.headers || {}),
  }});
  const text = await response.text(); let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(data.error || data.raw || `Request failed (${response.status})`);
  return data;
}

const profileProperties = {
  displayName: { type: "string" }, gender: { type: "string" }, age: { type: "number", minimum: 13, maximum: 100 },
  height_cm: { type: "number", minimum: 100, maximum: 250 }, weight_kg: { type: "number", minimum: 30, maximum: 350 },
  trainingGoal: { type: "string", enum: ["fatloss", "muscle", "strength", "general"] },
  level: { type: "string", enum: ["beginner", "intermediate", "advanced"] }, weeklyDays: { type: "number", minimum: 2, maximum: 6 },
  session_length_minutes: { type: "number", minimum: 20, maximum: 120 }, equipment: { type: "string", enum: ["gym", "dumbbell", "bodyweight"] },
  injuries_or_limitations: { type: "string", maxLength: 500 }, preferred_training_style: { type: "string", maxLength: 80 },
};

const tools = [
  { name: "get_user_profile", description: "Read the current user's non-sensitive fitness profile.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "update_user_profile", description: "Validate and update fitness onboarding details.", inputSchema: { type: "object", properties: profileProperties, additionalProperties: false } },
  { name: "generate_training_plan", description: "Generate and save a deterministic four-week plan from the profile.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_today_workout", description: "Return today's workout from the active plan.", inputSchema: { type: "object", properties: { day: { type: "number", minimum: 0, maximum: 6 } }, additionalProperties: false } },
  { name: "log_workout", description: "Save a completed workout plus 1-10 difficulty, energy, and soreness feedback.", inputSchema: { type: "object", properties: {
    plan_id: { type: "string" }, workout_date: { type: "string" }, completed: { type: "boolean", description: "False records a missed planned workout." }, focus: { type: "string", enum: ["full", "upper", "lower", "pushpull", "core"] },
    duration: { type: "number", minimum: 1, maximum: 300 }, perceived_difficulty: { type: "number", minimum: 1, maximum: 10 },
    energy_level: { type: "number", minimum: 1, maximum: 10 }, soreness_level: { type: "number", minimum: 1, maximum: 10 }, notes: { type: "string", maxLength: 1000 },
    completed_exercises: { type: "array", minItems: 0, maxItems: 100, items: { type: "object", properties: {
      exercise_name: { type: "string" }, actual_sets: { type: "number", minimum: 1, maximum: 20 }, actual_reps: { type: "number", minimum: 1, maximum: 500 }, weight_used: { type: "number", minimum: 0, maximum: 1000 }, notes: { type: "string" },
    }, required: ["exercise_name", "actual_sets", "actual_reps"], additionalProperties: false } },
  }, required: ["completed_exercises", "perceived_difficulty", "energy_level", "soreness_level"], additionalProperties: false } },
  { name: "get_weekly_review", description: "Calculate or read the rule-based review for a seven-day period.", inputSchema: { type: "object", properties: { week_end: { type: "string", description: "Optional YYYY-MM-DD" } }, additionalProperties: false } },
  { name: "adjust_next_week_plan", description: "Create a new plan version from the weekly review without overwriting history.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_profile", description: "Legacy alias for get_user_profile.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_training_goals", description: "Read goal and training preferences.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_recent_workouts", description: "Read recent completed workouts.", inputSchema: { type: "object", properties: { limit: { type: "number" } }, additionalProperties: false } },
  { name: "get_exercise_history", description: "Read progression for an exercise.", inputSchema: { type: "object", properties: { exercise: { type: "string" } }, additionalProperties: false } },
  { name: "get_personal_records", description: "Read personal records.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_progress", description: "Read recent workouts and personal records for the authenticated user.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "create_workout", description: "Create an in-progress workout for the authenticated user.", inputSchema: { type: "object", properties: { focus: { type: "string", enum: ["full", "upper", "lower", "pushpull", "core"] }, planId: { type: "string" } }, additionalProperties: false } },
  { name: "update_workout", description: "Complete an existing workout after sets have been logged.", inputSchema: { type: "object", properties: { workoutId: { type: "string" }, duration: { type: "number" }, rating: { type: "string" } }, required: ["workoutId"], additionalProperties: false } },
  { name: "update_training_goal", description: "Update the authenticated user's training goal.", inputSchema: { type: "object", properties: { trainingGoal: { type: "string", enum: ["fatloss", "muscle", "strength", "general"] } }, required: ["trainingGoal"], additionalProperties: false } },
  { name: "create_workout_plan", description: "Save an externally authored workout plan.", inputSchema: { type: "object", properties: { name: { type: "string" }, days: { type: "array" } }, required: ["name", "days"] } },
  { name: "update_workout_plan", description: "Update an existing saved workout plan.", inputSchema: { type: "object", properties: { planId: { type: "string" }, name: { type: "string" }, days: { type: "array" }, activate: { type: "boolean" } }, required: ["planId"] } },
  { name: "log_set", description: "Log one completed set.", inputSchema: { type: "object", properties: { workoutId: { type: "string" }, exercise: { type: "string" }, setNumber: { type: "number" }, weightLb: { type: "number" }, reps: { type: "number" } }, required: ["exercise", "weightLb", "reps"] } },
  { name: "complete_workout", description: "Complete an in-progress workout.", inputSchema: { type: "object", properties: { workoutId: { type: "string" }, duration: { type: "number" }, rating: { type: "string" } }, required: ["workoutId"] } },
];

function validateValue(value, schema, path) {
  if (!schema) return;
  if (schema.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) throw new Error(`${path} must be a number`);
  if (schema.type === "string" && typeof value !== "string") throw new Error(`${path} must be a string`);
  if (schema.type === "boolean" && typeof value !== "boolean") throw new Error(`${path} must be a boolean`);
  if (schema.type === "array") {
    if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
    if (schema.minItems !== undefined && value.length < schema.minItems) throw new Error(`${path} requires at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) throw new Error(`${path} allows at most ${schema.maxItems} items`);
    value.forEach((item, index) => validateValue(item, schema.items, `${path}[${index}]`));
  }
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} must be an object`);
    for (const key of schema.required || []) if (value[key] === undefined) throw new Error(`${path}.${key} is required`);
    if (schema.additionalProperties === false) for (const key of Object.keys(value)) if (!schema.properties?.[key]) throw new Error(`${path}.${key} is not supported`);
    for (const [key, child] of Object.entries(schema.properties || {})) if (value[key] !== undefined) validateValue(value[key], child, `${path}.${key}`);
  }
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${path} must be one of: ${schema.enum.join(", ")}`);
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) throw new Error(`${path} must be at least ${schema.minimum}`);
  if (typeof value === "number" && schema.maximum !== undefined && value > schema.maximum) throw new Error(`${path} must be at most ${schema.maximum}`);
  if (typeof value === "string" && schema.maxLength !== undefined && value.length > schema.maxLength) throw new Error(`${path} is too long`);
}

function validateToolArguments(name, args) {
  const tool = tools.find(item => item.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  validateValue(args, tool.inputSchema, "arguments");
}

async function handleTool(name, args) {
  switch (name) {
    case "get_user_profile": return api("/api/profile");
    case "get_profile": return api("/api/profile");
    case "get_training_goals": { const data = await api("/api/profile"); return { goals: data.goals }; }
    case "get_recent_workouts": { const data = await api("/api/workouts"); return { workouts: (data.workouts || []).slice(0, Number(args.limit) || 10) }; }
    case "get_exercise_history": return api(`/api/exercise-history${args.exercise ? `?exercise=${encodeURIComponent(args.exercise)}` : ""}`);
    case "get_personal_records": return api("/api/personal-records");
    case "get_progress": { const [workouts, records] = await Promise.all([api("/api/workouts"), api("/api/personal-records")]); return { workouts: workouts.workouts || [], records: records.records || [] }; }
    case "create_workout": return api("/api/workouts", { method: "POST", body: JSON.stringify({ action: "start_workout", focus: args.focus || "full", planId: args.planId, source: "mcp" }) });
    case "update_workout": return api("/api/workouts", { method: "POST", body: JSON.stringify({ action: "complete_workout", workoutId: args.workoutId, duration: args.duration, rating: args.rating, source: "mcp" }) });
    case "update_training_goal": return api("/api/profile", { method: "PUT", body: JSON.stringify({ trainingGoal: args.trainingGoal }) });
    case "update_user_profile": return api("/api/profile", { method: "PUT", body: JSON.stringify(args) });
    case "generate_training_plan": return api("/api/plans/generate", { method: "POST", body: "{}" });
    case "get_today_workout": return api(`/api/plans/today${Number.isInteger(args.day) ? `?day=${args.day}` : ""}`);
    case "get_weekly_review": return api(`/api/review${args.week_end ? `?weekEnd=${encodeURIComponent(args.week_end)}` : ""}`);
    case "adjust_next_week_plan": return api("/api/plans/adjust", { method: "POST", body: "{}" });
    case "create_workout_plan": return api("/api/plans", { method: "POST", body: JSON.stringify({ name: args.name, days: args.days, activate: true }) });
    case "update_workout_plan": return api("/api/plans", { method: "PATCH", body: JSON.stringify(args) });
    case "log_set": return api("/api/workouts", { method: "POST", body: JSON.stringify({ action: "log_set", workoutId: args.workoutId, exerciseId: args.exercise, setNumber: args.setNumber || 1, weightLb: args.weightLb, reps: args.reps, source: "mcp" }) });
    case "complete_workout": return api("/api/workouts", { method: "POST", body: JSON.stringify({ action: "complete_workout", workoutId: args.workoutId, duration: args.duration, rating: args.rating }) });
    case "log_workout": {
      if (args.completed !== false && args.completed_exercises.length === 0) throw new Error("completed_exercises must contain at least one exercise when completed is true");
      const performances = args.completed_exercises.flatMap(item => Array.from({ length: item.actual_sets }, (_, index) => ({ exerciseId: item.exercise_name, setNumber: index + 1, weightKg: item.weight_used || 0, reps: item.actual_reps, notes: item.notes || "" })));
      return api("/api/workouts", { method: "POST", body: JSON.stringify({
        plan_id: args.plan_id, date: args.workout_date, completed: args.completed !== false, focus: args.focus || "full", duration: args.duration || 45,
        perceived_difficulty: args.perceived_difficulty, energy_level: args.energy_level, soreness_level: args.soreness_level,
        notes: args.notes || "", source: "mcp", performances: performances.map(item => ({ ...item, source: "mcp" })),
      }) });
    }
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

const send = message => process.stdout.write(`${JSON.stringify(message)}\n`);
const success = (id, result) => send({ jsonrpc: "2.0", id, result });
const failure = (id, code, message) => send({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
async function receive(message) {
  if (!message || message.jsonrpc !== "2.0") return failure(message?.id, -32600, "Invalid request");
  if (message.method === "notifications/initialized") return;
  if (message.method === "initialize") return success(message.id, { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "oneset-fitness-os", version: "2.0.0" } });
  if (message.method === "ping") return success(message.id, {});
  if (message.method === "tools/list") return success(message.id, { tools });
  if (message.method === "tools/call") {
    try { const args = message.params?.arguments || {}; validateToolArguments(message.params?.name, args); const result = await handleTool(message.params?.name, args); return success(message.id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }); }
    catch (error) { return success(message.id, { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : "Tool failed" }] }); }
  }
  return failure(message.id, -32601, "Method not found");
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => {
  buffer += chunk; const lines = buffer.split(/\r?\n/); buffer = lines.pop() || "";
  for (const line of lines) { if (!line.trim()) continue; try { void receive(JSON.parse(line)); } catch { failure(null, -32700, "Parse error"); } }
});
