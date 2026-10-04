import assert from "node:assert/strict";
import test from "node:test";
import { EvidenceService, EvidenceUnavailableError } from "../apps/api/src/services/evidence-service.mjs";

const validCachedRecord = {
  id: "quran:4:58:ar",
  validation: { status: "valid" },
};

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
