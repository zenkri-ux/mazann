import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const recordDir = path.join(root, "data/runtime/hadith-source-records");
const outputPath = path.join(root, "data/hadith-source-manifest.json");
const base = "https://hadeethenc.com/api/v1";
const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function officialJson(route) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${base}${route}`, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw Object.assign(new Error(`HadeethEnc HTTP ${response.status}`), { status: response.status });
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt === 5 || (error.status && error.status < 500 && error.status !== 429)) break;
      await pause(attempt * 1_500);
    }
  }
  throw lastError;
}

const roots = await officialJson("/categories/roots/?language=ar");
if (!Array.isArray(roots) || !roots.length) throw new Error("Official Arabic root categories unavailable");
const listed = new Map();
const categories = [];
for (const category of roots) {
  const categoryId = String(category.id);
  const first = await officialJson(`/hadeeths/list/?language=ar&category_id=${categoryId}&page=1&per_page=1000`);
  const lastPage = Number(first.meta?.last_page);
  const total = Number(first.meta?.total_items);
  if (!Number.isInteger(lastPage) || lastPage < 1 || !Number.isInteger(total)) throw new Error(`Invalid pagination for ${categoryId}`);
  const pages = [first];
  for (let page = 2; page <= lastPage; page += 1) {
    pages.push(await officialJson(`/hadeeths/list/?language=ar&category_id=${categoryId}&page=${page}&per_page=1000`));
  }
  const rows = pages.flatMap((page) => page.data ?? []);
  if (rows.length !== total) throw new Error(`Category ${categoryId}: listed ${rows.length} but API reports ${total}`);
  for (const row of rows) {
    const id = String(row.id);
    if (!/^\d+$/.test(id)) throw new Error(`Invalid HadeethEnc ID ${id}`);
    const current = listed.get(id) ?? { id, categories: [] };
    current.categories.push(categoryId);
    listed.set(id, current);
  }
  categories.push({ id: categoryId, title: category.title, reported_count: total });
  process.stdout.write(`category ${categoryId}: ${rows.length}; unique so far ${listed.size}\n`);
}

await fs.mkdir(recordDir, { recursive: true });
const entries = [...listed.values()].sort((a, b) => Number(a.id) - Number(b.id));
const valid = [];
const rejected = [];
let cursor = 0;
async function worker() {
  while (cursor < entries.length) {
    const entry = entries[cursor++];
    const recordPath = path.join(recordDir, `${entry.id}.json`);
    try {
      let record;
      try { record = JSON.parse(await fs.readFile(recordPath, "utf8")); }
      catch { record = await officialJson(`/hadeeths/one/?language=ar&id=${entry.id}`); }
      if (String(record.id) !== entry.id || typeof record.hadeeth !== "string"
        || record.hadeeth.trim().length < 20 || /\.\.\.|…/u.test(record.hadeeth)
        || !String(record.grade ?? "").trim() || !String(record.attribution ?? "").trim()) {
        rejected.push({ id: entry.id, reason: "incomplete_or_unattributed_official_record" });
        continue;
      }
      await fs.writeFile(recordPath, JSON.stringify(record), "utf8");
      valid.push({
        id: entry.id,
        categories: entry.categories,
        matn_sha256: sha256(record.hadeeth),
        explanation_sha256: sha256(String(record.explanation ?? "")),
        has_reference: Boolean(String(record.reference ?? "").trim()),
        has_explanation: Boolean(String(record.explanation ?? "").trim()),
      });
    } catch (error) {
      rejected.push({ id: entry.id, reason: "fetch_failed", code: error.status ?? error.code ?? "UNKNOWN" });
    }
    const processed = valid.length + rejected.length;
    if (processed % 100 === 0 || processed === entries.length) {
      process.stdout.write(`fetched ${processed}/${entries.length}; valid ${valid.length}; rejected ${rejected.length}\n`);
    }
    await pause(120);
  }
}
await Promise.all(Array.from({ length: 5 }, () => worker()));
valid.sort((a, b) => Number(a.id) - Number(b.id));
rejected.sort((a, b) => Number(a.id) - Number(b.id));
const payload = {
  schema_version: "1.0.0",
  metadata: {
    generated_at: new Date().toISOString(),
    source: "HadeethEnc official Arabic REST API",
    source_url: `${base}/hadeeths/one/?language=ar&id={id}`,
    scope: "Arabic records discoverable from the seven root categories; not the entirety of canonical Hadith literature",
    integrity_policy: "whole publisher matn with matching ID, grade and attribution; no ellipsis; no scholarly re-authentication implied",
    listed_unique_count: entries.length,
    validated_count: valid.length,
    rejected_count: rejected.length,
    categories,
  },
  records: valid,
  rejected,
};
await fs.writeFile(`${outputPath}.tmp`, JSON.stringify(payload), "utf8");
await fs.rename(`${outputPath}.tmp`, outputPath);
process.stdout.write(`wrote manifest: ${valid.length}/${entries.length} complete publisher records\n`);
