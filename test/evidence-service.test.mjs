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
  assert.deepEqual(result.records[0].axis_ids, ["foundation", "context"]);
  assert.equal(result.unresolved.length, 0);
  assert.equal(result.search_trace.length, 2);
  assert.equal(result.search_trace[0].original_question, "ما الأصل؟");
  assert.ok(result.search_trace[0].compiled_query.includes("الأصل"));
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
