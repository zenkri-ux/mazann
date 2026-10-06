import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../apps/api/src/config.mjs";
import { IslamicContentMcpClient } from "@mazann/islamic-content-connector";
import { OpenAIPlannerClient } from "@mazann/openai-planner";
import { TopicPlanningService } from "../apps/api/src/services/topic-planning-service.mjs";
import { EvidenceService } from "../apps/api/src/services/evidence-service.mjs";
import { RecordCache } from "../apps/api/src/lib/record-cache.mjs";
import { QuranSearchIndex } from "../apps/api/src/lib/quran-search-index.mjs";
import { QuranSemanticIndex } from "../apps/api/src/lib/quran-semantic-index.mjs";
import { HadithSemanticIndex } from "../apps/api/src/lib/hadith-semantic-index.mjs";
import { HadithLocatorIndex } from "../apps/api/src/lib/hadith-locator-index.mjs";
import { TafsirLinkIndex } from "../apps/api/src/lib/tafsir-link-index.mjs";
import { OpenAIEmbeddingClient } from "../apps/api/src/lib/openai-embedding-client.mjs";
import { OpenAIEvidenceReranker } from "../apps/api/src/lib/openai-evidence-reranker.mjs";
import { acceptsRelevance, RELEVANCE_THRESHOLDS } from "../apps/api/src/lib/evidence-relevance.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.join(root, "evaluation/retrieval-threshold-topics-2026-10-06.json");
const reportPath = path.join(root, "evaluation/retrieval-threshold-results-2026-10-06.json");
const reviewPath = path.join(root, "evaluation/retrieval-threshold-review-2026-10-06.csv");
const priorityReviewPath = path.join(root, "evaluation/retrieval-threshold-priority-review-2026-10-06.csv");
const requestedCount = Number.parseInt(process.argv.find((arg) => arg.startsWith("--count="))?.split("=")[1] ?? "15", 10);
if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 15) throw new Error("--count must be 1..15");
if (!config.openaiApiKey || !config.openaiModel) throw new Error("The live benchmark needs the configured OPENAI_API_KEY and OPENAI_MODEL");

const suite = JSON.parse(await fs.readFile(inputPath, "utf8"));
if (suite.topics.length !== 15 || new Set(suite.topics).size !== 15) throw new Error("Expected 15 distinct, title-only topics");
const existing = await fs.readFile(reportPath, "utf8").then(JSON.parse).catch((error) => {
  if (error.code === "ENOENT") return null;
  throw error;
});
if (existing && (existing.suite_version !== suite.version || JSON.stringify(existing.input_topics) !== JSON.stringify(suite.topics))) {
  throw new Error("Existing report belongs to a different suite; preserve it before starting a new run");
}
const report = existing ?? {
  suite_version: suite.version,
  started_at: new Date().toISOString(),
  git_revision: process.env.MAZANN_BENCHMARK_REVISION ?? null,
  mode: "actual_model_plan_unedited_axes_full_source_fetch_and_rerank",
  fixed_input_defaults: { official_instruction_state: "none_declared", ...{ target_audience: "جمهور عام", format: "خطبة جمعة", duration: "15–20 دقيقة", country_or_context: "السياق المحلي للمستخدم" } },
  input_topics: suite.topics,
  model: config.openaiModel,
  embedding_model: config.openaiEmbeddingModel,
  current_thresholds: RELEVANCE_THRESHOLDS,
  topics: [],
};

const planner = new TopicPlanningService({ provider: new OpenAIPlannerClient({
  apiKey: config.openaiApiKey, model: config.openaiModel,
  endpoint: config.openaiResponsesUrl, timeoutMs: config.plannerTimeoutMs,
}) });
const embedder = new OpenAIEmbeddingClient({
  apiKey: config.openaiApiKey, model: config.openaiEmbeddingModel,
  dimensions: config.openaiEmbeddingDimensions, endpoint: config.openaiEmbeddingsUrl,
});
const lexical = await QuranSearchIndex.load(config.quranIndexPath);
const quranSemantic = await QuranSemanticIndex.load(config.quranSemanticIndexPath, embedder, { sourceIndexPath: config.quranIndexPath });
const hadithSemantic = await HadithSemanticIndex.load(config.hadithSemanticIndexPath, embedder, { manifestPath: config.hadithManifestPath });
const hadithLocator = await HadithLocatorIndex.load(config.hadithLocatorPath);
const tafsirLinks = await TafsirLinkIndex.load(config.tafsirLinkPath);
const actualReranker = new OpenAIEvidenceReranker({
  apiKey: config.openaiApiKey, model: config.openaiModel,
  endpoint: config.openaiResponsesUrl, timeoutMs: 45_000,
});
let groundingRejected = new Set();
let assessed = [];
const observedQuran = {
  search: (...args) => lexical.search(...args),
  isTopicGrounded: (id, topic) => {
    const grounded = lexical.isTopicGrounded(id, topic);
    if (!grounded) groundingRejected.add(id);
    return grounded;
  },
};
const observedReranker = {
  model: actualReranker.model,
  expand: (...args) => actualReranker.expand(...args),
  assess: async (request) => {
    const assessments = await actualReranker.assess(request);
    const byId = new Map(assessments.map((item) => [item.id, item]));
    for (const item of request.records) {
      const score = byId.get(item.record.id);
      if (!score) continue;
      assessed.push({
        id: item.record.id,
        source_family: item.record.source_family,
        source_label: item.record.reference?.source_label_ar ?? null,
        citation_url: item.record.citation_url ?? null,
        full_record_verified: item.record.validation?.status === "valid",
        ...score,
        current_threshold_pass: acceptsRelevance(score),
      });
    }
    return assessments;
  },
};
const evidence = new EvidenceService({
  client: new IslamicContentMcpClient({ endpoint: config.mcpUrl, timeoutMs: config.mcpTimeoutMs }),
  cache: new RecordCache(config.cacheDir, { fallbackDirectories: [config.seedCacheDir] }),
  cacheWrite: false,
  quranIndex: observedQuran, quranSemanticIndex: quranSemantic,
  hadithSemanticIndex: hadithSemantic, hadithLocator, tafsirLinks,
  reranker: observedReranker,
});

function sortScores(left, right) {
  return (right.role === "direct") - (left.role === "direct")
    || right.score - left.score
    || right.relationship_score - left.relationship_score;
}
function csvCell(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function reviewCsv(results) {
  const headers = ["topic_number", "topic_title", "axis_id", "axis_title", "rank", "source_family", "record_id", "source_label", "citation_url", "model_role", "model_score", "relationship_score", "current_threshold_pass", "reviewer_label_direct_contextual_irrelevant", "reviewer_notes"];
  const rows = [headers.join(",")];
  for (const topic of results.filter((item) => item.status === "ok")) {
    const axisTitles = new Map(topic.axes.map((axis) => [axis.axis_id, axis.title]));
    for (const [index, item] of topic.top12.entries()) {
      rows.push([topic.topic_number, topic.title, item.axis_id, axisTitles.get(item.axis_id), index + 1,
        item.source_family, item.id, item.source_label, item.citation_url, item.role, item.score,
        item.relationship_score, item.current_threshold_pass, "", ""].map(csvCell).join(","));
    }
  }
  return `\ufeff${rows.join("\n")}\n`;
}
function priorityReviewCsv(results) {
  const headers = ["topic_number", "topic_title", "axis_title", "source_family", "record_id", "source_label", "citation_url", "sample_reason", "reviewer_label_direct_contextual_irrelevant", "reviewer_confidence_1_to_3", "reviewer_notes"];
  const rows = [headers.join(",")];
  for (const topic of results.filter((item) => item.status === "ok")) {
    const axisTitles = new Map(topic.axes.map((axis) => [axis.axis_id, axis.title]));
    const all = topic.all_assessed;
    const chosen = new Map();
    const add = (item, reason) => { if (item && !chosen.has(item.id)) chosen.set(item.id, reason); };
    add(all.find((item) => item.role === "direct" && item.current_threshold_pass), "strong_direct_control");
    add([...all].reverse().find((item) => item.role === "direct" && item.current_threshold_pass), "boundary_pass");
    add(all.find((item) => item.role === "direct" && !item.current_threshold_pass), "boundary_direct_reject");
    add(all.find((item) => item.role === "contextual"), "best_contextual_reject");
    for (const item of all) { if (chosen.size >= 4) break; add(item, "additional_top_candidate"); }
    for (const [id, reason] of chosen) {
      const item = all.find((candidate) => candidate.id === id);
      rows.push([topic.topic_number, topic.title, axisTitles.get(item.axis_id), item.source_family, item.id,
        item.source_label, item.citation_url, reason, "", "", ""].map(csvCell).join(","));
    }
  }
  return `\ufeff${rows.join("\n")}\n`;
}
async function writeIfChanged(filePath, content) {
  const current = await fs.readFile(filePath, "utf8").catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (current !== content) await fs.writeFile(filePath, content, "utf8");
}
async function save() {
  report.updated_at = new Date().toISOString();
  report.summary = {
    completed: report.topics.filter((item) => item.status === "ok").length,
    errors: report.topics.filter((item) => item.status === "error").length,
    current_pass_count: report.topics.reduce((sum, item) => sum + (item.current_pass_count ?? 0), 0),
    total_assessed: report.topics.reduce((sum, item) => sum + (item.assessed_count ?? 0), 0),
    note: "Scores are model judgments, not probabilities or ground truth. A qualified reviewer must label citations before selecting thresholds.",
  };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeIfChanged(reviewPath, reviewCsv(report.topics));
  await writeIfChanged(priorityReviewPath, priorityReviewCsv(report.topics));
}

for (let index = 0; index < requestedCount; index++) {
  if (report.topics.some((item) => item.topic_number === index + 1 && item.status === "ok")) continue;
  const title = suite.topics[index];
  groundingRejected = new Set();
  assessed = [];
  const started = Date.now();
  try {
    const roadmap = await planner.create({ topic: title, official_instruction_state: "none_declared" });
    const result = await evidence.collectForRoadmap({ roadmap, perAxisLimit: 8, maxRecords: 12 });
    const scored = [...assessed].sort(sortScores);
    const entry = {
      topic_number: index + 1,
      title,
      status: "ok",
      elapsed_seconds: Math.round((Date.now() - started) / 1000),
      planner_status: roadmap.planner_status,
      axes: roadmap.axes.map(({ axis_id, title: axisTitle, research_question, evidence_requirements }) => ({ axis_id, title: axisTitle, research_question, evidence_requirements })),
      search_trace: result.search_trace,
      grounding_rejected_unique_count: groundingRejected.size,
      grounding_rejected_sample: [...groundingRejected].slice(0, 20),
      assessed_count: scored.length,
      current_pass_count: scored.filter((item) => item.current_threshold_pass).length,
      displayed_count: result.records.length,
      rejected_by_relevance_count: result.rejected_by_relevance.length,
      unresolved: result.unresolved,
      search_failures: result.search_failures,
      relevance_warnings: result.relevance_warnings,
      top12: scored.slice(0, 12),
      all_assessed: scored,
    };
    report.topics = report.topics.filter((item) => item.topic_number !== index + 1).concat(entry).sort((a, b) => a.topic_number - b.topic_number);
    process.stdout.write(`${index + 1}/15 assessed=${entry.assessed_count} pass=${entry.current_pass_count} shown=${entry.displayed_count} grounding_rejected=${entry.grounding_rejected_unique_count} seconds=${entry.elapsed_seconds}\n`);
  } catch (error) {
    report.topics = report.topics.filter((item) => item.topic_number !== index + 1).concat({ topic_number: index + 1, title, status: "error", code: error.code ?? error.name ?? "ERROR", message: error.message }).sort((a, b) => a.topic_number - b.topic_number);
    process.stderr.write(`${index + 1}/15 error=${error.code ?? error.name ?? "ERROR"}\n`);
  }
  await save();
}
await save();
process.stdout.write(`report=${path.relative(root, reportPath)} reviewer_sheet=${path.relative(root, reviewPath)} priority_sheet=${path.relative(root, priorityReviewPath)}\n`);
if (report.topics.slice(0, requestedCount).some((item) => item.status !== "ok")) process.exitCode = 2;
