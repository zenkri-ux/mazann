import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../apps/api/src/config.mjs";
import { ensureReferenceProvenance } from "@mazann/domain";

const entries = await fs.readdir(config.seedCacheDir, { withFileTypes: true });
const records = [];

for (const entry of entries) {
  if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
  const payload = JSON.parse(await fs.readFile(path.join(config.seedCacheDir, entry.name), "utf8"));
  const record = ensureReferenceProvenance(payload.record);
  records.push({
    canonical_id: record.canonical_id,
    source_family: record.source_family,
    origin_platform: record.origin_platform,
    reference: record.reference,
    access: record.access,
    citation_url: record.citation_url,
    language: record.language,
    content_type: record.content_type,
    upstream_version: record.upstream_version,
    publication_status: record.publication_status,
    fetched_at: record.fetched_at,
    cached_at: payload.cached_at,
    checksum_sha256: record.checksum_sha256,
    validation_status: record.validation.status,
  });
}

records.sort((a, b) => a.canonical_id.localeCompare(b.canonical_id));
const generatedAt = records.map((record) => record.cached_at).sort().at(-1) ?? null;
const manifest = {
  schema_version: "1.0.0",
  generated_at: generatedAt,
  connector: {
    name: "Islamic Content",
    endpoint: config.mcpUrl,
    transport: "Streamable HTTP",
    authentication: "none",
    access: "read-only",
  },
  redistribution_note: "Keep exact source links and publisher attribution. Quran translation content must not be modified; confirm the upstream version before final publication.",
  records,
};

await fs.writeFile(
  path.join(config.projectRoot, "data", "source-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(`Wrote ${records.length} source records to data/source-manifest.json`);
