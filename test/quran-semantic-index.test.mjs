import assert from "node:assert/strict";
import test from "node:test";
import { OpenAIEmbeddingClient } from "../apps/api/src/lib/openai-embedding-client.mjs";
import { QuranSemanticIndex, encodeVector } from "../apps/api/src/lib/quran-semantic-index.mjs";

test("embedding client preserves input ordering and never accepts partial vectors", async () => {
  const embedder = new OpenAIEmbeddingClient({
    apiKey: "test-only", model: "text-embedding-3-large", dimensions: 2,
    fetchImpl: async () => ({ ok: true, json: async () => ({ data: [
      { index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] },
    ] }) }),
  });
  assert.deepEqual(await embedder.embed(["أمانة", "عدل"]), [[1, 0], [0, 1]]);
});

test("semantic index ranks complete ayat while keeping explanation vectors separate", async () => {
  const payload = {
    schema_version: "1.0.0", metadata: { model: "test-model", dimensions: 2, source_sha256: "abc" },
    documents: Array.from({ length: 6236 }, (_, index) => ({
      id: `quran:1:${index + 1}:ar`, title: `الآية ${index + 1}`, citation_url: "https://example.test",
      quran: encodeVector(index === 0 ? [1, 0] : [0, 1]),
      explanation: encodeVector(index === 1 ? [1, 0] : [0, 1]),
    })),
  };
  const index = new QuranSemanticIndex(payload, {
    model: "test-model", dimensions: 2, embed: async () => [[1, 0]],
  }, { expectedSourceSha256: "abc" });
  const results = await index.search("موضوع مختلف اللفظ", { limit: 2 });
  assert.deepEqual(results.map((item) => item.id), ["quran:1:1:ar", "quran:1:2:ar"]);
  assert.deepEqual(results[1].retrieval.matched_fields, ["published_explanation"]);
  assert.ok(results.every((item) => !Object.hasOwn(item, "text")));
});
