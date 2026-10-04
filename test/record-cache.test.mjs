import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { RecordCache } from "../apps/api/src/lib/record-cache.mjs";

test("cache writes and restores a versioned canonical record", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mazann-cache-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const cache = new RecordCache(directory);
  const record = { id: "quran:4:58:ar", validation: { status: "valid" } };
  const written = await cache.write(record);
  const restored = await cache.read(record.id);
  assert.equal(written.cache_schema_version, "1.0.0");
  assert.deepEqual(restored.record, record);
});

test("cache reads the immutable seed fallback without writing into it", async (t) => {
  const runtime = await fs.mkdtemp(path.join(os.tmpdir(), "mazann-runtime-"));
  const seed = await fs.mkdtemp(path.join(os.tmpdir(), "mazann-seed-"));
  t.after(() => Promise.all([fs.rm(runtime, { recursive: true, force: true }), fs.rm(seed, { recursive: true, force: true })]));
  const seeded = new RecordCache(seed);
  const record = { id: "hadith:42:ar", validation: { status: "valid" } };
  await seeded.write(record);
  const runtimeCache = new RecordCache(runtime, { fallbackDirectories: [seed] });
  assert.deepEqual((await runtimeCache.read(record.id)).record, record);
});
