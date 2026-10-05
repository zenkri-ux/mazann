import { config } from "../apps/api/src/config.mjs";
import { IslamicContentMcpClient } from "@mazann/islamic-content-connector";
import { RecordCache } from "../apps/api/src/lib/record-cache.mjs";
import { QuranSearchIndex } from "../apps/api/src/lib/quran-search-index.mjs";
import { QuranSemanticIndex } from "../apps/api/src/lib/quran-semantic-index.mjs";
import { HadithSemanticIndex } from "../apps/api/src/lib/hadith-semantic-index.mjs";
import { OpenAIEmbeddingClient } from "../apps/api/src/lib/openai-embedding-client.mjs";
import { OpenAIEvidenceReranker } from "../apps/api/src/lib/openai-evidence-reranker.mjs";
import { EvidenceService } from "../apps/api/src/services/evidence-service.mjs";

if (!config.openaiApiKey || !config.openaiModel) throw new Error("Model configuration is required");
const quranIndex = await QuranSearchIndex.load(config.quranIndexPath);
const embedder = new OpenAIEmbeddingClient({ apiKey: config.openaiApiKey, model: config.openaiEmbeddingModel,
  dimensions: config.openaiEmbeddingDimensions, endpoint: config.openaiEmbeddingsUrl });
const quranSemanticIndex = await QuranSemanticIndex.load(config.quranSemanticIndexPath, embedder, { sourceIndexPath: config.quranIndexPath });
const hadithSemanticIndex = await HadithSemanticIndex.load(config.hadithSemanticIndexPath, embedder, { manifestPath: config.hadithManifestPath });
const service = new EvidenceService({
  client: new IslamicContentMcpClient({ endpoint: config.mcpUrl, timeoutMs: config.mcpTimeoutMs }),
  cache: new RecordCache(config.cacheDir, { fallbackDirectories: [config.seedCacheDir] }),
  cacheWrite: false, quranIndex, quranSemanticIndex, hadithSemanticIndex,
  reranker: new OpenAIEvidenceReranker({ apiKey: config.openaiApiKey, model: config.openaiModel,
    endpoint: config.openaiResponsesUrl }),
});
const roadmap = {
  roadmap_id: "compound_smoke", brief: { topic: "الكرم عند الصحابة", language: "ar" },
  axes: [{ axis_id: "examples", title: "مواقف الكرم عند الصحابة", research_question: "ما المواقف الثابتة التي يظهر فيها كرم الصحابة؟",
    purpose: "عرض أمثلة موثقة من أعمال الصحابة، مع فصلها عن التأصيل العام لفضيلة الكرم.", evidence_requirements: ["quran", "hadith"] }],
};
const result = await service.collectForRoadmap({ roadmap, perAxisLimit: 8, maxRecords: 6 });
console.log(JSON.stringify({
  records: result.records.map((item) => ({ id: item.record.id, source: item.record.source_family, role: item.relevance?.role,
    score: item.relevance?.score, relationship_score: item.relevance?.relationship_score,
    axis_id: item.relevance?.axis_id, reason: item.relevance?.reason })),
  rejected: result.rejected_by_relevance,
  unresolved: result.unresolved,
  search_failures: result.search_failures,
  relevance_warnings: result.relevance_warnings,
  queries: result.search_trace.map((trace) => ({ lexical: trace.compiled_query, semantic: trace.semantic_queries,
    top: trace.ranked_candidates.map(({ id }) => id) })),
}, null, 2));
