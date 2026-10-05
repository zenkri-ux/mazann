import assert from "node:assert/strict";
import test from "node:test";
import { compileRetrievalQuery, EvidenceService, EvidenceUnavailableError } from "../apps/api/src/services/evidence-service.mjs";

const validCachedRecord = {
  id: "quran:4:58:ar",
  validation: { status: "valid" },
};

test("retrieval query compiler turns a long methodological question into source-searchable Arabic terms", () => {
  const query = compileRetrievalQuery({
    roadmap: { brief: { topic: "الرحمة في التعامل مع الضعفاء" } },
    axis: {
      title: "تأصيل معنى الرحمة وصلته بحفظ الكرامة",
      research_question: "كيف تؤسس النصوص الشرعية لمعنى الرحمة في معاملة من يواجهون ضعفًا أو حاجة؟",
    },
  });
  assert.equal(query, "الرحمة التعامل الضعفاء وصلته بحفظ الكرامة تؤسس");
  assert.ok(query.length < 96);
  assert.ok(!query.includes("كيف"));
});

test("retrieval query compiler uses a declared amanah query instead of diluting the intent with context words", () => {
  const query = compileRetrievalQuery({
    roadmap: { brief: { topic: "الأمانة وأثرها في بناء الثقة داخل المجتمع" } },
    axis: {
      title: "أثر الأمانة في المجتمع",
      research_question: "كيف ترتبط الأمانة بالثقة والتعاون بين الناس؟",
    },
  });
  assert.equal(query, "الأمانة أداء خيانة");
});

test("evidence service exposes cache fallback and upstream failure", async () => {
  const service = new EvidenceService({
    client: { callTool: async () => { throw Object.assign(new Error("offline"), { code: "MCP_NETWORK_ERROR" }); } },
    cache: { read: async () => ({ cached_at: "2026-10-04T09:00:00.000Z", record: validCachedRecord }) },
    cacheWrite: false,
  });
  const result = await service.quran({ surah: 4, ayah: 58 });
  assert.equal(result.retrieval_mode, "cache");
  assert.equal(result.upstream_error.code, "MCP_NETWORK_ERROR");
});

test("search retries a source reported unavailable and recovers its candidates", async () => {
  let calls = 0;
  const service = new EvidenceService({
    client: {
      async callTool() {
        calls += 1;
        if (calls === 1) return {
          content: [{ type: "text", text: "quran: unavailable (timed out after 5000ms)" }],
          structuredContent: { results: [] },
        };
        return {
          content: [{ type: "text", text: "quran: 1 of 1" }],
          structuredContent: { results: [{ id: "quran:21:107:ar", title: "الأنبياء 21:107", url: "https://islamenc.com/ar/quran/21/107" }] },
        };
      },
    },
    cache: { read: async () => null, write: async () => {} },
  });

  const result = await service.search({ query: "الرحمة", sources: ["quran"] });
  assert.equal(calls, 2);
  assert.equal(result.retry_count, 1);
  assert.deepEqual(result.source_warnings, []);
  assert.deepEqual(result.candidates.map((candidate) => candidate.id), ["quran:21:107:ar"]);
});

test("search distinguishes a persistent source timeout from no matches", async () => {
  const service = new EvidenceService({
    client: {
      async callTool() {
        return {
          content: [{ type: "text", text: "quran: unavailable (timed out after 5000ms)" }],
          structuredContent: { results: [] },
        };
      },
    },
    cache: { read: async () => null, write: async () => {} },
  });

  const result = await service.search({ query: "الأمانة", sources: ["quran"] });
  assert.equal(result.candidates.length, 0);
  assert.deepEqual(result.source_warnings, [{ source: "quran", code: "SOURCE_UNAVAILABLE_AFTER_RETRY" }]);
});

test("search uses local Quran ranking and keeps Hadith on the official live connector", async () => {
  const calls = [];
  const service = new EvidenceService({
    client: {
      async callTool(name, args) {
        calls.push({ name, args });
        return {
          content: [{ type: "text", text: "hadith: 1 of 1" }],
          structuredContent: { results: [{ id: "hadith:3016:ar", title: "حديث", url: "https://hadeethenc.com/ar/browse/hadith/3016" }] },
        };
      },
    },
    cache: { read: async () => null, write: async () => {} },
    quranIndex: {
      search: () => [{
        id: "quran:21:107:ar", source_family: "quran",
        retrieval: { score: 12.3, query_coverage: 1, matched_fields: ["quran_text"] },
      }],
    },
  });
  const result = await service.search({ query: "الرحمة", sources: ["quran", "hadith"] });
  assert.deepEqual(calls[0].args.sources, ["hadith"]);
  assert.deepEqual(result.candidates.map((candidate) => candidate.id), ["quran:21:107:ar", "hadith:3016:ar"]);
  assert.equal(result.retrieval_mode, "local_quran_bm25_and_live_mcp");
});

test("Quran search fuses lexical and semantic candidate ranks without promoting snippets", async () => {
  const service = new EvidenceService({
    client: {}, cache: {},
    quranIndex: { search: () => [
      { id: "quran:1:1:ar", source_family: "quran", retrieval: { mode: "local_fielded_bm25", score: 5 } },
    ] },
    quranSemanticIndex: { search: async () => [
      { id: "quran:2:1:ar", source_family: "quran", retrieval: { mode: "semantic", score: 0.8 } },
      { id: "quran:1:1:ar", source_family: "quran", retrieval: { mode: "semantic", score: 0.7 } },
    ] },
  });
  const result = await service.search({ query: "معنى بصياغة مختلفة", sources: ["quran"], limit: 2 });
  assert.equal(result.retrieval_mode, "quran_lexical_semantic_rrf");
  assert.equal(result.candidates[0].id, "quran:1:1:ar");
  assert.deepEqual(result.candidates[0].retrieval.channels, ["lexical", "semantic"]);
  assert.ok(result.candidates.every((candidate) => !Object.hasOwn(candidate, "text")));
});

test("strong lexical Quran anchor is not displaced by overlapping semantic distractors", async () => {
  const service = new EvidenceService({
    client: {}, cache: {},
    quranIndex: { search: () => [
      { id: "quran:5:1:ar", source_family: "quran", retrieval: { query_coverage: 0.75 } },
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `quran:9:${index + 1}:ar`, source_family: "quran", retrieval: { query_coverage: 0.25 },
      })),
    ] },
    quranSemanticIndex: { search: async () => Array.from({ length: 10 }, (_, index) => ({
      id: `quran:9:${index + 1}:ar`, source_family: "quran", retrieval: { score: 0.9 - index * 0.01 },
    })) },
  });
  const result = await service.search({ query: "الوفاء بالعقود والعهود", sources: ["quran"], limit: 5 });
  assert.equal(result.candidates[0].id, "quran:5:1:ar");
});

test("declared thematic expansion can preserve a source-grounded Quran anchor", async () => {
  const service = new EvidenceService({
    client: {}, cache: {},
    quranIndex: { search: () => [
      { id: "quran:49:6:ar", source_family: "quran", retrieval: { query_coverage: 0, matched_fields: ["curated_topic_expansion"] } },
      { id: "quran:99:4:ar", source_family: "quran", retrieval: { query_coverage: 0.2 } },
    ] },
    quranSemanticIndex: { search: async () => [
      { id: "quran:99:4:ar", source_family: "quran", retrieval: { score: 0.8 } },
    ] },
  });
  const result = await service.search({ query: "التعامل المسؤول مع الأخبار غير المؤكدة", sources: ["quran"], limit: 2 });
  assert.equal(result.candidates[0].id, "quran:49:6:ar");
});

test("Quran semantic outage is visible and lexical retrieval remains available", async () => {
  const service = new EvidenceService({
    client: {}, cache: {},
    quranIndex: { search: () => [{ id: "quran:1:1:ar", source_family: "quran" }] },
    quranSemanticIndex: { search: async () => { throw new Error("offline"); } },
  });
  const result = await service.search({ query: "الموضوع", sources: ["quran"] });
  assert.equal(result.candidates[0].id, "quran:1:1:ar");
  assert.deepEqual(result.source_warnings, [{ source: "quran_semantic", code: "SEMANTIC_UNAVAILABLE_LEXICAL_FALLBACK" }]);
});

test("Hadith semantic and official live candidates fuse by ID without treating vectors as evidence", async () => {
  const service = new EvidenceService({
    client: { callTool: async () => ({ structuredContent: { results: [
      { id: "hadith:2:ar", title: "من المصدر", url: "https://hadeethenc.com/ar/browse/hadith/2" },
    ] }, content: [] }) },
    cache: {},
    hadithSemanticIndex: { search: async () => [
      { id: "hadith:1:ar", title: "حديث", source_family: "hadith", retrieval: { score: 0.8 } },
      { id: "hadith:2:ar", title: "حديث", source_family: "hadith", retrieval: { score: 0.7, indexed_matn_sha256: "source-checksum" } },
    ] },
  });
  const result = await service.search({ query: "الرحمة بالضعفاء", sources: ["hadith"], limit: 3 });
  assert.equal(result.retrieval_mode, "hadith_live_lexical_semantic_rrf");
  assert.equal(result.candidates[0].id, "hadith:2:ar");
  assert.deepEqual(result.candidates[0].retrieval.channels, ["lexical", "semantic"]);
  assert.equal(result.candidates[0].retrieval.indexed_matn_sha256, "source-checksum");
  assert.ok(result.candidates.every((candidate) => candidate.state === "candidate_requires_full_fetch" || !Object.hasOwn(candidate, "text")));
});

test("Hadith semantic results survive a live search outage with an explicit warning", async () => {
  const service = new EvidenceService({
    client: { callTool: async () => { throw new Error("upstream offline"); } },
    cache: {},
    hadithSemanticIndex: { search: async () => [{ id: "hadith:1:ar", source_family: "hadith", state: "candidate_requires_full_fetch" }] },
  });
  const result = await service.search({ query: "الإحسان", sources: ["hadith"] });
  assert.equal(result.candidates[0].id, "hadith:1:ar");
  assert.deepEqual(result.source_warnings, [{ source: "hadith", code: "SOURCE_UNAVAILABLE_AFTER_RETRY" }]);
});

test("roadmap refuses an indexed Hadith when its fetched complete matn has changed", async () => {
  const service = new EvidenceService({ client: {}, cache: {} });
  service.search = async () => ({ candidates: [{
    id: "hadith:1:ar", source_family: "hadith", retrieval: { indexed_matn_sha256: "old" },
  }] });
  service.fetchCandidate = async () => ({ record: {
    id: "hadith:1:ar", checksum_sha256: "new", validation: { status: "valid" },
  } });
  const result = await service.collectForRoadmap({ roadmap: {
    roadmap_id: "roadmap_drift", brief: { topic: "الأمانة", language: "ar" },
    axes: [{ axis_id: "a", research_question: "ما أثر الأمانة؟", evidence_requirements: ["hadith"] }],
  } });
  assert.equal(result.records.length, 0);
  assert.equal(result.unresolved[0].code, "INDEXED_MATN_SOURCE_DRIFT");
});

test("evidence service abstains when live retrieval and cache both fail", async () => {
  const service = new EvidenceService({
    client: { callTool: async () => { throw new Error("offline"); } },
    cache: { read: async () => null },
    cacheWrite: false,
  });
  await assert.rejects(() => service.hadith({ id: "42" }), (error) => {
    assert.ok(error instanceof EvidenceUnavailableError);
    assert.equal(error.details.record_id, "hadith:42:ar");
    return true;
  });
});

test("candidate fetch routes only canonical Quran and Hadith ids", async () => {
  const service = new EvidenceService({ client: {}, cache: {}, cacheWrite: false });
  service.hadith = async ({ id }) => ({ routed: "hadith", id });
  service.quran = async ({ surah, ayah }) => ({ routed: "quran", surah, ayah });
  assert.deepEqual(await service.fetchCandidate({ id: "hadith:3016:ar" }), { routed: "hadith", id: "3016" });
  assert.deepEqual(await service.fetchCandidate({ id: "quran:4:58:ar" }), { routed: "quran", surah: 4, ayah: 58 });
  await assert.rejects(() => service.fetchCandidate({ id: "library:123:ar" }), /غير مدعوم/);
});

test("roadmap collection fetches complete unique records and preserves axis trace", async () => {
  const service = new EvidenceService({ client: {}, cache: {}, cacheWrite: false });
  service.search = async ({ query }) => ({
    candidates: query.includes("الأصل")
      ? [{ id: "quran:4:58:ar" }, { id: "hadith:3016:ar" }]
      : [{ id: "quran:4:58:ar" }],
  });
  service.fetchCandidate = async ({ id }) => ({
    retrieval_mode: "live",
    record: { id, validation: { status: "valid" } },
  });

  const result = await service.collectForRoadmap({
    roadmap: {
      roadmap_id: "roadmap_test",
      brief: { language: "ar" },
      axes: [
        { axis_id: "foundation", research_question: "ما الأصل؟", evidence_requirements: ["quran", "hadith"] },
        { axis_id: "context", research_question: "ما السياق؟", evidence_requirements: ["quran"] },
      ],
    },
  });
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.records[0].search_axis_ids, ["foundation", "context"]);
  assert.deepEqual(result.records[0].axis_ids, []);
  assert.equal(result.records[0].placement_status, "needs_user_assignment");
  assert.equal(result.unresolved.length, 0);
  assert.equal(result.search_trace.length, 2);
  assert.equal(result.search_trace[0].original_question, "ما الأصل؟");
  assert.ok(result.search_trace[0].compiled_query.includes("الأصل"));
  assert.ok(result.search_trace[0].semantic_query.includes("ما الأصل؟"));
});

test("semantic Quran query preserves each axis question even when lexical topic query is curated", async () => {
  const seen = [];
  const service = new EvidenceService({ client: {}, cache: {} });
  service.search = async (args) => { seen.push(args); return { candidates: [], source_warnings: [] }; };
  await service.collectForRoadmap({ roadmap: {
    roadmap_id: "roadmap_test", brief: { topic: "الأمانة وأثرها في الثقة" },
    axes: [
      { axis_id: "a", title: "الأصل", research_question: "ما أصل الأمانة؟" },
      { axis_id: "b", title: "التطبيق", research_question: "كيف نطبق الأمانة في المعاملات؟" },
    ],
  } });
  assert.equal(seen[0].query, seen[1].query);
  assert.notEqual(seen[0].semanticQuery, seen[1].semanticQuery);
  assert.ok(seen[1].semanticQuery.includes("المعاملات"));
});

test("roadmap collection exposes failed full fetches instead of promoting snippets", async () => {
  const service = new EvidenceService({ client: {}, cache: {}, cacheWrite: false });
  service.search = async () => ({ candidates: [{ id: "hadith:999:ar" }] });
  service.fetchCandidate = async () => { throw Object.assign(new Error("blocked"), { code: "EVIDENCE_UNAVAILABLE" }); };
  const result = await service.collectForRoadmap({
    roadmap: {
      roadmap_id: "roadmap_test",
      brief: { language: "ar" },
      axes: [{ axis_id: "foundation", research_question: "ما الأصل؟", evidence_requirements: ["hadith"] }],
    },
  });
  assert.equal(result.records.length, 0);
  assert.deepEqual(result.unresolved, [{ id: "hadith:999:ar", axis_ids: ["foundation"], code: "EVIDENCE_UNAVAILABLE" }]);
});

test("roadmap collection favors source diversity before filling the record limit", async () => {
  const service = new EvidenceService({ client: {}, cache: {}, cacheWrite: false });
  service.search = async () => ({ candidates: [
    { id: "hadith:1:ar", source_family: "hadith" },
    { id: "hadith:2:ar", source_family: "hadith" },
    { id: "quran:2:1:ar", source_family: "quran" },
  ] });
  service.fetchCandidate = async ({ id }) => ({ retrieval_mode: "live", record: { id } });
  const result = await service.collectForRoadmap({
    maxRecords: 2,
    roadmap: {
      roadmap_id: "roadmap_test",
      brief: { language: "ar" },
      axes: [{
        axis_id: "foundation",
        research_question: "ما الأصل المؤسس للموضوع؟",
        evidence_requirements: ["quran", "hadith"],
      }],
    },
  });
  assert.deepEqual(result.records.map((item) => item.record.id), ["quran:2:1:ar", "hadith:1:ar"]);
});

test("limited evidence budget gives every axis a first candidate before second-source enrichment", async () => {
  const service = new EvidenceService({ client: {}, cache: {}, cacheWrite: false });
  service.search = async ({ semanticQuery }) => {
    const axis = /محور (\d)/u.exec(semanticQuery)?.[1];
    return { candidates: [
      { id: `quran:${axis}:1:ar`, source_family: "quran" },
      { id: `hadith:${axis}:ar`, source_family: "hadith" },
    ], source_warnings: [] };
  };
  service.fetchCandidate = async ({ id }) => ({ retrieval_mode: "live", record: { id } });
  const result = await service.collectForRoadmap({ maxRecords: 6, roadmap: {
    roadmap_id: "roadmap_test", brief: { topic: "موضوع" },
    axes: [1, 2, 3, 4].map((number) => ({
      axis_id: `axis_${number}`, title: `محور ${number}`,
      research_question: `ما دليل محور ${number}؟`, evidence_requirements: ["quran", "hadith"],
    })),
  } });
  assert.ok([1, 2, 3, 4].every((number) => result.records.some((item) => item.record.id === `quran:${number}:1:ar`)));
});
