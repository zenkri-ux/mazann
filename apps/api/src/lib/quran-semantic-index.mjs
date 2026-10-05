import fs from "node:fs/promises";
import { createHash } from "node:crypto";

function decodeVector(encoded, dimensions) {
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length !== dimensions * 4) throw new Error("Semantic vector dimension mismatch");
  const vector = new Float32Array(dimensions);
  for (let index = 0; index < dimensions; index += 1) vector[index] = bytes.readFloatLE(index * 4);
  return vector;
}

export function encodeVector(values) {
  const bytes = Buffer.allocUnsafe(values.length * 4);
  values.forEach((value, index) => bytes.writeFloatLE(value, index * 4));
  return bytes.toString("base64");
}

function similarity(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  return dot / (Math.sqrt(leftNorm * rightNorm) || 1);
}

export class QuranSemanticIndex {
  constructor(payload, embedder, { expectedSourceSha256 = null } = {}) {
    if (payload?.schema_version !== "1.0.0" || !Array.isArray(payload.documents)
      || !Number.isInteger(payload.metadata?.dimensions) || payload.documents.length !== 6236
      || payload.metadata.model !== embedder.model || payload.metadata.dimensions !== embedder.dimensions
      || (expectedSourceSha256 && payload.metadata.source_sha256 !== expectedSourceSha256)) {
      throw new Error("Quran semantic index is missing, stale or incompatible");
    }
    this.embedder = embedder;
    this.metadata = payload.metadata;
    this.documents = payload.documents.map((document) => ({
      id: document.id,
      title: document.title,
      citation_url: document.citation_url,
      quran: decodeVector(document.quran, embedder.dimensions),
      explanation: decodeVector(document.explanation, embedder.dimensions),
    }));
  }

  static async load(filePath, embedder, { sourceIndexPath } = {}) {
    const [raw, source] = await Promise.all([
      fs.readFile(filePath, "utf8"),
      sourceIndexPath ? fs.readFile(sourceIndexPath) : Promise.resolve(null),
    ]);
    return new QuranSemanticIndex(JSON.parse(raw), embedder, {
      expectedSourceSha256: source ? createHash("sha256").update(source).digest("hex") : null,
    });
  }

  async search(query, { limit = 20 } = {}) {
    const [queryVector] = await this.embedder.embed([query]);
    return this.documents.map((document) => {
      const quranScore = similarity(queryVector, document.quran);
      const explanationScore = similarity(queryVector, document.explanation);
      return {
        id: document.id,
        title: document.title,
        citation_url: document.citation_url,
        source_family: "quran",
        state: "candidate_requires_full_fetch",
        retrieval: {
          mode: "semantic_whole_ayah_and_separate_explanation",
          score: Number(Math.max(quranScore, explanationScore).toFixed(5)),
          matched_fields: [quranScore >= explanationScore ? "quran_text" : "published_explanation"],
        },
      };
    }).sort((left, right) => right.retrieval.score - left.retrieval.score).slice(0, limit);
  }
}
