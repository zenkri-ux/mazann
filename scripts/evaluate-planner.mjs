import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OpenAIPlannerClient } from "@mazann/openai-planner";
import { evaluatePlannerRoadmap, summarizePlannerEvaluation } from "@mazann/domain/planner-evaluation";
import { TopicPlanningService } from "../apps/api/src/services/topic-planning-service.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const suite = JSON.parse(await fs.readFile(path.join(root, "evaluation/planner-intelligence-cases.json"), "utf8"));
const providerName = (process.env.MAZANN_PLANNER_PROVIDER ?? "deterministic").toLowerCase();
let provider = null;

if (providerName === "openai") {
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
    console.error("BLOCKED: MAZANN_PLANNER_PROVIDER=openai requires OPENAI_API_KEY and OPENAI_MODEL.");
    process.exitCode = 2;
  } else {
    provider = new OpenAIPlannerClient({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL,
      endpoint: process.env.OPENAI_RESPONSES_URL,
      timeoutMs: Number.parseInt(process.env.MAZANN_PLANNER_TIMEOUT_MS ?? "30000", 10),
    });
  }
}

const service = new TopicPlanningService({ provider });
const results = [];
for (const testCase of suite.cases) {
  const roadmap = await service.create(testCase.input);
  results.push(evaluatePlannerRoadmap(testCase, roadmap));
}

const report = summarizePlannerEvaluation(results, {
  suite_version: suite.version,
  evaluated_at: new Date().toISOString(),
  requested_provider: providerName,
  model: process.env.OPENAI_MODEL || null,
});
console.log(JSON.stringify(report, null, 2));
if (report.status !== "passed") process.exitCode = 2;
