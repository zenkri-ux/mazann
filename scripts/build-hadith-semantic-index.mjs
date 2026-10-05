import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { OpenAIEmbeddingClient } from "../apps/api/src/lib/openai-embedding-client.mjs";
import { encodeVector } from "../apps/api/src/lib/quran-semantic-index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.resolve(root, process.env.MAZANN_HADITH_MANIFEST_PATH ?? "data/hadith-source-manifest.json");
const outputPath = path.resolve(root, process.env.MAZANN_HADITH_SEMANTIC_INDEX_PATH ?? "data/hadith-semantic-index.json");
const recordsDir = path.join(root, "data/runtime/hadith-source-records");
const partsDir = path.join(root, "data/runtime/hadith-semantic-parts");
const model = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-large";
const dimensions = Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 512);
if (!Number.isInteger(dimensions) || dimensions < 64 || dimensions > 3072) throw new Error("Invalid embedding dimensions");
const manifestBytes = await fs.readFile(manifestPath);
const manifestSha256 = createHash("sha256").update(manifestBytes).digest("hex");
const manifest = JSON.parse(manifestBytes);
if (manifest.schema_version !== "1.0.0" || manifest.records?.length !== manifest.metadata?.validated_count) {
  throw new Error("Complete official HadeethEnc source manifest required");
}
const embedder = new OpenAIEmbeddingClient({ apiKey: process.env.OPENAI_API_KEY, model, dimensions, timeoutMs: 90_000 });
await fs.mkdir(partsDir, { recursive: true });
const sourceRecords = [];
for (const entry of manifest.records) {
  const record = JSON.parse(await fs.readFile(path.join(recordsDir, `${entry.id}.json`), "utf8"));
  const checksum = createHash("sha256").update(record.hadeeth, "utf8").digest("hex");
  if (String(record.id) !== entry.id || checksum !== entry.matn_sha256) throw new Error(`Source drift at ${entry.id}`);
  sourceRecords.push({ entry, record });
}

async function embedMany(values) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try { return await embedder.embed(values); }
    catch (error) {
      lastError = error;
      if (error.status && error.status < 500 && error.status !== 429) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
  if (values.length === 1) return [null];
  if (lastError.status !== 400 && lastError.status !== 413) throw lastError;
  const split = Math.floor(values.length / 2);
  return [...await embedMany(values.slice(0, split)), ...await embedMany(values.slice(split))];
}

const documents = [];
const skipped = [];
for (let start = 0; start < sourceRecords.length; start += 32) {
  const batch = sourceRecords.slice(start, start + 32);
  const partPath = path.join(partsDir, `${String(start).padStart(5, "0")}.json`);
  let part;
  try {
    part = JSON.parse(await fs.readFile(partPath, "utf8"));
    if (part.manifest_sha256 !== manifestSha256 || part.model !== model || part.dimensions !== dimensions
      || part.start !== start || part.count !== batch.length) throw new Error("Stale checkpoint");
  } catch {
    part = { manifest_sha256: manifestSha256, model, dimensions, start, count: batch.length, documents: [], skipped: [] };
    const matnVectors = await embedMany(batch.map(({ record }) => record.hadeeth));
    const withExplanations = batch.map(({ record }, index) => ({ index, text: String(record.explanation ?? "").trim() }))
      .filter(({ text }) => text);
    const explanationVectors = withExplanations.length
      ? await embedMany(withExplanations.map(({ text }) => text)) : [];
    const explanations = new Map(withExplanations.map(({ index }, position) => [index, explanationVectors[position]]));
    for (const [index, { entry, record }] of batch.entries()) {
      const matn = matnVectors[index];
      if (matn) {
        const explanation = explanations.get(index);
        part.documents.push({
          id: `hadith:${entry.id}:ar`,
          title: record.title,
          citation_url: `https://hadeethenc.com/ar/browse/hadith/${entry.id}`,
          matn_sha256: entry.matn_sha256,
          matn: encodeVector(matn),
          explanation: explanation ? encodeVector(explanation) : null,
        });
      } else {
        // Never shorten a narration to fit a model limit.
        part.skipped.push({ id: entry.id, reason: "whole_matn_embedding_failed" });
      }
    }
    await fs.writeFile(partPath, JSON.stringify(part), "utf8");
  }
  documents.push(...part.documents);
  skipped.push(...part.skipped);
  process.stdout.write(`embedded ${documents.length}/${sourceRecords.length}; skipped ${skipped.length}\n`);
}
const payload = {
  schema_version: "1.0.0",
  metadata: {
    generated_at: new Date().toISOString(),
    source: manifest.metadata.source,
    source_url: manifest.metadata.source_url,
    manifest_sha256: manifestSha256,
    model, dimensions,
    listed_unique_count: manifest.metadata.listed_unique_count,
    validated_count: manifest.metadata.validated_count,
    indexed_count: documents.length,
    skipped_count: skipped.length,
    unit: "whole_publisher_hadith_matn",
    fields: ["whole_hadith_matn", "separate_publisher_explanation_when_available"],
    display_policy: "vectors locate candidates only; a complete official record must be fetched and checked before display",
  },
  documents,
  skipped,
};
await fs.writeFile(`${outputPath}.tmp`, JSON.stringify(payload), "utf8");
await fs.rename(`${outputPath}.tmp`, outputPath);
process.stdout.write(`wrote ${documents.length} complete hadith vectors to ${outputPath}\n`);
