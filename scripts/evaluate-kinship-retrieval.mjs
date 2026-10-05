import assert from "node:assert/strict";
import { config } from "../apps/api/src/config.mjs";
import { QuranSearchIndex } from "../apps/api/src/lib/quran-search-index.mjs";
import { QuranSemanticIndex } from "../apps/api/src/lib/quran-semantic-index.mjs";
import { OpenAIEmbeddingClient } from "../apps/api/src/lib/openai-embedding-client.mjs";
import { HadithSemanticIndex } from "../apps/api/src/lib/hadith-semantic-index.mjs";
import { RecordCache } from "../apps/api/src/lib/record-cache.mjs";
import { IslamicContentMcpClient } from "@mazann/islamic-content-connector";
import { compileRetrievalQuery, EvidenceService } from "../apps/api/src/services/evidence-service.mjs";

const topic = "أهمية صلة الرحم";
const axes = [
  ["ما المقصود بصلة الرحم؟", "كيف تعرض المصادر المعتمدة معنى الرحم والصلة؟"],
  ["مكانة صلة الرحم في البناء الإيماني والأخلاقي", "كيف تربط الأدلة صلة الرحم بالتقوى والإحسان والمسؤولية تجاه الأقارب؟"],
  ["صلة الرحم في واقع الأسرة والمجتمع", "ما صور التواصل والتكافل العائلي في واقع معاصر متنوع؟"],
  ["خطوات عملية متدرجة لاستدامة الصلة", "ما الخطوات الواقعية التي تساعد الفرد على بدء التواصل أو استعادته؟"],
  ["الصلة عند النزاع أو وجود الأذى", "كيف يمكن تناول الإصلاح وحفظ الروابط الأسرية دون تبرير الأذى؟"],
];

const quranIndex = await QuranSearchIndex.load(config.quranIndexPath);
let quranSemanticIndex = null;
let embedder = null;
if (config.openaiApiKey) {
  embedder = new OpenAIEmbeddingClient({
    apiKey: config.openaiApiKey,
    model: config.openaiEmbeddingModel,
    dimensions: config.openaiEmbeddingDimensions,
    endpoint: config.openaiEmbeddingsUrl,
  });
  quranSemanticIndex = await QuranSemanticIndex.load(config.quranSemanticIndexPath, embedder, {
    sourceIndexPath: config.quranIndexPath,
  });
}
const service = new EvidenceService({ client: null, cache: null, quranIndex, quranSemanticIndex });
const roadmap = { brief: { topic } };
const rows = [];
for (const [title, research_question] of axes) {
  const query = compileRetrievalQuery({ roadmap, axis: { title, research_question } });
  const result = await service.search({
    query,
    semanticQuery: [topic, title, research_question].join(". "),
    topic,
    sources: ["quran"],
    limit: 8,
  });
  const ids = result.candidates.map((candidate) => candidate.id);
  assert.ok(!ids.includes("quran:4:128:ar"), "Marital settlement is not evidence for kinship ties");
  assert.ok(!ids.includes("quran:23:2:ar"), "Prayer humility is not evidence for kinship ties");
  assert.ok(!ids.includes("quran:14:18:ar"), "An incidental simile is not primary kinship evidence");
  assert.ok(!ids.includes("quran:60:3:ar"), "An eschatological warning is not general kinship instruction");
  rows.push({ axis: title, query, mode: result.retrieval_mode, warnings: result.source_warnings, ids, channels: result.candidates.map((candidate) => candidate.retrieval?.channels ?? ["lexical"]) });
}
const all = new Set(rows.flatMap((row) => row.ids));
assert.ok(["quran:13:21:ar", "quran:17:26:ar", "quran:47:22:ar"].some((id) => all.has(id)));
console.log(JSON.stringify({ semantic_index_loaded: Boolean(quranSemanticIndex), topic, rows }, null, 2));

if (process.argv.includes("--full")) {
  const hadithSemanticIndex = embedder ? await HadithSemanticIndex.load(config.hadithSemanticIndexPath, embedder, {
    manifestPath: config.hadithManifestPath,
  }) : null;
  const fullService = new EvidenceService({
    client: new IslamicContentMcpClient({ endpoint: config.mcpUrl, timeoutMs: config.mcpTimeoutMs }),
    cache: new RecordCache(config.cacheDir, { fallbackDirectories: [config.seedCacheDir] }),
    cacheWrite: false,
    quranIndex,
    quranSemanticIndex,
    hadithSemanticIndex,
  });
  const roadmap = { roadmap_id: "kinship_regression", brief: { topic, language: "ar" }, axes: axes.map(([title, research_question], index) => ({
    axis_id: `axis_${index + 1}`,
    title,
    research_question,
    purpose: title,
    evidence_requirements: index === 2 ? ["hadith"] : ["quran", "hadith"],
  })) };
  const result = await fullService.collectForRoadmap({ roadmap, maxRecords: 10 });
  const ids = result.records.map((item) => item.record.id);
  assert.ok(!ids.includes("quran:4:128:ar"));
  assert.ok(!ids.includes("quran:23:2:ar"));
  console.log(JSON.stringify({ full_result: {
    records: result.records.map((item) => ({ id: item.record.id, source: item.record.source_family, suggested_axis: item.axis_ids?.[0] ?? null, searched_axes: item.search_axis_ids })),
    unresolved: result.unresolved,
    search_failures: result.search_failures,
  } }, null, 2));
}
