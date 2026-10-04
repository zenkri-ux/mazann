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
