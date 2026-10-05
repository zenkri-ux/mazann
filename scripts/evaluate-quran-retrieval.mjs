import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { QuranSearchIndex } from "../apps/api/src/lib/quran-search-index.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.resolve(projectRoot, "data/quran-search-index.json");
const casesPath = path.resolve(projectRoot, "evaluation/quran-retrieval-cases.json");
const outputPath = path.resolve(projectRoot, "evaluation/quran-retrieval-results.json");
const indexBytes = await fs.readFile(indexPath);
const index = new QuranSearchIndex(JSON.parse(indexBytes));
const cases = JSON.parse(await fs.readFile(casesPath, "utf8"));

const results = cases.map((testCase) => {
  const candidates = index.search(testCase.query, { limit: testCase.top_k });
  const rank = candidates.findIndex((candidate) => testCase.expected_ids.includes(candidate.id)) + 1;
  const candidatesContainNoSacredDisplayText = candidates.every((candidate) => !("text" in candidate));
  return {
    case_id: testCase.case_id,
    query: testCase.query,
    expected_ids: testCase.expected_ids,
    top_k: testCase.top_k,
    passed: rank > 0 && candidatesContainNoSacredDisplayText,
    first_relevant_rank: rank || null,
    candidates_contain_no_sacred_display_text: candidatesContainNoSacredDisplayText,
    returned: candidates.map((candidate) => ({
      id: candidate.id,
      score: candidate.retrieval.score,
      query_coverage: candidate.retrieval.query_coverage,
      matched_fields: candidate.retrieval.matched_fields,
    })),
  };
});

const passed = results.filter((result) => result.passed).length;
const reciprocalRank = results.reduce((sum, result) => sum + (result.first_relevant_rank ? 1 / result.first_relevant_rank : 0), 0) / results.length;
const report = {
  schema_version: "1.0.0",
  evaluated_at: new Date().toISOString(),
  index: {
    sha256: createHash("sha256").update(indexBytes).digest("hex"),
    units: index.metadata.document_count,
    unit_policy: index.metadata.unit,
    source: index.metadata.source,
    retrieval_fields: index.metadata.retrieval_fields,
  },
  metrics: {
    cases: results.length,
    passed,
    hit_rate_at_5: passed / results.length,
    mean_reciprocal_rank: Number(reciprocalRank.toFixed(4)),
  },
  safety_gate: {
    candidates_are_locators_only: results.every((result) => result.candidates_contain_no_sacred_display_text),
    exact_text_requires_full_official_fetch: true,
  },
  results,
};

await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report.metrics));
if (passed !== results.length || !report.safety_gate.candidates_are_locators_only) process.exitCode = 1;
