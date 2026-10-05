import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../apps/api/src/config.mjs";
import { QuranSearchIndex } from "../apps/api/src/lib/quran-search-index.mjs";
import { QuranSemanticIndex } from "../apps/api/src/lib/quran-semantic-index.mjs";
import { OpenAIEmbeddingClient } from "../apps/api/src/lib/openai-embedding-client.mjs";
import { EvidenceService } from "../apps/api/src/services/evidence-service.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lexical = await QuranSearchIndex.load(config.quranIndexPath);
const embedder = new OpenAIEmbeddingClient({
  apiKey: config.openaiApiKey, model: config.openaiEmbeddingModel,
  dimensions: config.openaiEmbeddingDimensions, endpoint: config.openaiEmbeddingsUrl,
});
const semantic = await QuranSemanticIndex.load(config.quranSemanticIndexPath, embedder, {
  sourceIndexPath: config.quranIndexPath,
});
const service = new EvidenceService({ client: {}, cache: {}, quranIndex: lexical, quranSemanticIndex: semantic });
const cases = JSON.parse(await fs.readFile(path.join(root, "evaluation/quran-retrieval-cases.json"), "utf8"));
const results = [];
for (const item of cases) {
  const result = await service.search({ query: item.query, sources: ["quran"], limit: 5 });
  const firstRank = result.candidates.findIndex((candidate) => item.expected_ids.includes(candidate.id)) + 1;
  results.push({
    case_id: item.case_id,
    query: item.query,
    expected_ids: item.expected_ids,
    first_relevant_rank: firstRank || null,
    returned: result.candidates.map((candidate) => ({ id: candidate.id, channels: candidate.retrieval?.channels ?? [] })),
  });
}
const paraphraseQueries = [
  "التعامل المسؤول مع الأخبار غير المؤكدة",
  "حماية من لا يستطيع الدفاع عن حقه",
  "صدق الإنسان في ما اؤتمن عليه",
];
const paraphraseProbes = [];
for (const query of paraphraseQueries) {
  const lexicalOnly = lexical.search(query, { limit: 5 });
  const fused = await service.search({ query, sources: ["quran"], limit: 5 });
  paraphraseProbes.push({
    query,
    lexical_ids: lexicalOnly.map((item) => item.id),
    hybrid_ids: fused.candidates.map((item) => item.id),
    note: "Unlabelled exploration; a qualified reviewer must judge relevance before using this as a quality claim",
  });
}
const report = {
  evaluated_at: new Date().toISOString(),
  mode: "quran_bm25_semantic_rrf",
  model: semantic.metadata.model,
  dimensions: semantic.metadata.dimensions,
  cases: results.length,
  hit_at_5: results.filter((item) => item.first_relevant_rank).length / results.length,
  mrr: Number((results.reduce((sum, item) => sum + (item.first_relevant_rank ? 1 / item.first_relevant_rank : 0), 0) / results.length).toFixed(4)),
  results,
  paraphrase_probes: paraphraseProbes,
};
await fs.writeFile(path.join(root, "evaluation/quran-hybrid-results.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ cases: report.cases, hit_at_5: report.hit_at_5, mrr: report.mrr })}\n`);
