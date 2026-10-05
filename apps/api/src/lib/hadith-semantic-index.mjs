import fs from "node:fs/promises";
import { createHash } from "node:crypto";

function decodeVector(encoded, dimensions) {
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length !== dimensions * 4) throw new Error("Hadith semantic vector dimension mismatch");
  const vector = new Float32Array(dimensions);
  for (let index = 0; index < dimensions; index += 1) vector[index] = bytes.readFloatLE(index * 4);
  return vector;
}

function cosine(left, right) {
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

export class HadithSemanticIndex {
  constructor(payload, embedder, { expectedManifestSha256 = null } = {}) {
    if (payload?.schema_version !== "1.0.0" || !Array.isArray(payload.documents)
      || !Number.isInteger(payload.metadata?.dimensions)
      || payload.metadata.model !== embedder.model || payload.metadata.dimensions !== embedder.dimensions
      || payload.metadata.indexed_count !== payload.documents.length
      || payload.documents.length > payload.metadata.validated_count
      || (expectedManifestSha256 && payload.metadata.manifest_sha256 !== expectedManifestSha256)) {
      throw new Error("Hadith semantic index is missing, stale or incompatible");
    }
    const seen = new Set();
    this.documents = payload.documents.map((document) => {
      if (!/^hadith:\d+:ar$/.test(document.id) || seen.has(document.id)
        || !/^[a-f0-9]{64}$/.test(document.matn_sha256)) throw new Error("Invalid Hadith semantic document");
      seen.add(document.id);
      return {
        id: document.id,
        title: document.title,
        citation_url: document.citation_url,
        matn_sha256: document.matn_sha256,
        matn: decodeVector(document.matn, embedder.dimensions),
        explanation: document.explanation ? decodeVector(document.explanation, embedder.dimensions) : null,
      };
    });
    this.embedder = embedder;
    this.metadata = payload.metadata;
  }

  static async load(filePath, embedder, { manifestPath } = {}) {
    const [raw, manifest] = await Promise.all([
      fs.readFile(filePath, "utf8"),
      manifestPath ? fs.readFile(manifestPath) : Promise.resolve(null),
    ]);
    return new HadithSemanticIndex(JSON.parse(raw), embedder, {
      expectedManifestSha256: manifest ? createHash("sha256").update(manifest).digest("hex") : null,
    });
  }

  async search(query, { limit = 20 } = {}) {
    const [queryVector] = await this.embedder.embed([query]);
    const ranked = this.documents.map((document) => {
      const matnScore = cosine(queryVector, document.matn);
      const explanationScore = document.explanation ? cosine(queryVector, document.explanation) : -1;
      return {
        id: document.id,
        title: document.title,
        citation_url: document.citation_url,
        source_family: "hadith",
        state: "candidate_requires_full_fetch",
        retrieval: {
          mode: "semantic_whole_hadith_and_separate_publisher_explanation",
          score: Number(Math.max(matnScore, explanationScore).toFixed(5)),
          matched_fields: [matnScore >= explanationScore ? "whole_hadith_matn" : "publisher_explanation"],
          indexed_matn_sha256: document.matn_sha256,
        },
      };
    }).sort((left, right) => right.retrieval.score - left.retrieval.score);
    const unique = [];
    const seenMatn = new Set();
    for (const candidate of ranked) {
      const checksum = candidate.retrieval.indexed_matn_sha256;
      if (seenMatn.has(checksum)) continue;
      seenMatn.add(checksum);
      unique.push(candidate);
      if (unique.length >= limit) break;
    }
    return unique;
  }
}
