import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProjectStore, ProjectStoreError } from "../apps/api/src/lib/project-store.mjs";

async function temporaryStore() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mazann-projects-"));
  let tick = 0;
  return {
    directory,
    store: new ProjectStore(directory, { clock: () => new Date(`2026-10-04T12:0${tick++}:00.000Z`) }),
  };
}

test("project store saves, lists and restores the complete research state", async (context) => {
  const { directory, store } = await temporaryStore();
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const saved = await store.save({
    title: "الرحمة في التعامل مع الضعفاء",
    current_view: "evidence",
    brief: { topic: "الرحمة في التعامل مع الضعفاء" },
    roadmap: { axes: [{ axis_id: "foundation" }] },
    evidence: [{ record: { id: "hadith:1:ar" }, decision: "accepted" }],
  });
  const restored = await store.get(saved.project_id);
  assert.deepEqual(restored, saved);
  const listed = await store.list();
  assert.equal(listed[0].evidence_count, 1);
  assert.equal(listed[0].accepted_count, 1);
});

test("project store updates in place while preserving creation time", async (context) => {
  const { directory, store } = await temporaryStore();
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const first = await store.save({ title: "بحث أول", evidence: [] });
  const updated = await store.save({ project_id: first.project_id, title: "بحث أول محدث", evidence: [] });
  assert.equal(updated.project_id, first.project_id);
  assert.equal(updated.created_at, first.created_at);
  assert.notEqual(updated.updated_at, first.updated_at);
});

test("project store rejects invalid identifiers and underspecified titles", async () => {
  const { store } = await temporaryStore();
  await assert.rejects(() => store.get("../secret"), (error) => error instanceof ProjectStoreError && error.code === "INVALID_PROJECT_ID");
  await assert.rejects(() => store.save({ title: "أ" }), /عنوان البحث/);
});
