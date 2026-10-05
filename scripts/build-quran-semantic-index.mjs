import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { OpenAIEmbeddingClient } from "../apps/api/src/lib/openai-embedding-client.mjs";
import { encodeVector } from "../apps/api/src/lib/quran-semantic-index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.resolve(root, process.env.MAZANN_QURAN_INDEX_PATH ?? "data/quran-search-index.json");
const outputPath = path.resolve(root, process.env.MAZANN_QURAN_SEMANTIC_INDEX_PATH ?? "data/quran-semantic-index.json");
const partsDir = path.resolve(root, "data/runtime/quran-semantic-parts");
const model = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-large";
const dimensions = Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 512);
if (!Number.isInteger(dimensions) || dimensions < 64 || dimensions > 3072) throw new Error("Invalid embedding dimensions");

const sourceBytes = await fs.readFile(sourcePath);
const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
const source = JSON.parse(sourceBytes);
if (source?.schema_version !== "1.0.0" || source.documents?.length !== 6236
  || source.metadata?.unit !== "whole_ayah") throw new Error("Complete whole-ayah Quran source index required");
const embedder = new OpenAIEmbeddingClient({ apiKey: process.env.OPENAI_API_KEY, model, dimensions, timeoutMs: 90_000 });
await fs.mkdir(partsDir, { recursive: true });

async function embedBatch(inputs) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try { return await embedder.embed(inputs); }
    catch (error) {
      lastError = error;
      if (attempt === 5 || (error.status && error.status < 500 && error.status !== 429)) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
  throw lastError;
}

const documents = [];
const batchSize = 64;
for (let start = 0; start < source.documents.length; start += batchSize) {
  const batch = source.documents.slice(start, start + batchSize);
  const partPath = path.join(partsDir, `${String(start).padStart(5, "0")}.json`);
  let part;
  try {
    part = JSON.parse(await fs.readFile(partPath, "utf8"));
    if (part.source_sha256 !== sourceSha256 || part.model !== model || part.dimensions !== dimensions
      || part.documents?.length !== batch.length || part.documents.some((item, index) => item.id !== batch[index].id)) {
      throw new Error("Stale checkpoint");
    }
  } catch {
    const inputs = batch.flatMap((record) => [record.quran_search_text, record.explanation_search_text]);
    const vectors = await embedBatch(inputs);
    part = {
      source_sha256: sourceSha256, model, dimensions,
      documents: batch.map((record, index) => ({
        id: record.id,
        title: record.title,
        citation_url: record.citation_url,
        quran: encodeVector(vectors[index * 2]),
        explanation: encodeVector(vectors[index * 2 + 1]),
      })),
    };
    await fs.writeFile(partPath, JSON.stringify(part), "utf8");
  }
  documents.push(...part.documents);
  process.stdout.write(`embedded ${documents.length}/${source.documents.length} complete ayat\n`);
}

const output = {
  schema_version: "1.0.0",
  metadata: {
    generated_at: new Date().toISOString(),
    source_sha256: sourceSha256,
    source: source.metadata.source,
    model,
    dimensions,
    unit: "whole_ayah",
    fields: ["quran_text", "published_explanation"],
    display_policy: "vectors are candidate locators only; full official source fetch remains mandatory",
  },
  documents,
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.tmp`;
await fs.writeFile(temporaryPath, JSON.stringify(output), "utf8");
await fs.rename(temporaryPath, outputPath);
process.stdout.write(`wrote ${documents.length} whole-ayah vector pairs to ${outputPath}\n`);
