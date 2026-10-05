import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { HadithSemanticIndex } from "../apps/api/src/lib/hadith-semantic-index.mjs";
import { encodeVector } from "../apps/api/src/lib/quran-semantic-index.mjs";

const hash = createHash("sha256").update("متن كامل", "utf8").digest("hex");
const otherHash = createHash("sha256").update("متن آخر", "utf8").digest("hex");
const embedder = { model: "test-embedding", dimensions: 2, embed: async () => [[1, 0]] };
const payload = {
  schema_version: "1.0.0",
  metadata: { model: "test-embedding", dimensions: 2, indexed_count: 2, validated_count: 3 },
  documents: [
    { id: "hadith:1:ar", title: "حديث أول", citation_url: "https://hadeethenc.com/ar/browse/hadith/1", matn_sha256: hash,
      matn: encodeVector([1, 0]), explanation: encodeVector([0, 1]) },
    { id: "hadith:2:ar", title: "حديث ثان", citation_url: "https://hadeethenc.com/ar/browse/hadith/2", matn_sha256: otherHash,
      matn: encodeVector([0, 1]), explanation: null },
  ],
};

test("Hadith semantic search ranks whole publisher narrations and returns locators, never snippets", async () => {
  const index = new HadithSemanticIndex(payload, embedder);
  const candidates = await index.search("معنى الحديث", { limit: 2 });
  assert.deepEqual(candidates.map((candidate) => candidate.id), ["hadith:1:ar", "hadith:2:ar"]);
  assert.equal(candidates[0].retrieval.matched_fields[0], "whole_hadith_matn");
  assert.ok(candidates.every((candidate) => !Object.hasOwn(candidate, "text")));
});

test("Hadith index rejects stale models, impossible coverage and duplicate IDs", () => {
  assert.throws(() => new HadithSemanticIndex(payload, { ...embedder, model: "other" }), /incompatible/);
  assert.throws(() => new HadithSemanticIndex({ ...payload, metadata: { ...payload.metadata, validated_count: 1 } }, embedder), /incompatible/);
  assert.throws(() => new HadithSemanticIndex({ ...payload, documents: [payload.documents[0], payload.documents[0]] }, embedder), /Invalid Hadith/);
});

test("semantic search collapses identical whole matn variants while keeping indexed coverage unchanged", async () => {
  const duplicate = { ...payload.documents[0], id: "hadith:3:ar" };
  const index = new HadithSemanticIndex({
    ...payload,
    metadata: { ...payload.metadata, indexed_count: 3 },
    documents: [...payload.documents, duplicate],
  }, embedder);
  assert.equal(index.documents.length, 3);
  const candidates = await index.search("المعنى", { limit: 3 });
  assert.equal(candidates.length, 2);
  assert.ok(!candidates.some((candidate) => candidate.id === "hadith:3:ar"));
});
