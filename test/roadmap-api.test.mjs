import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "../apps/api/src/server.mjs";

async function withServer(run) {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("roadmap API returns a reviewable plan without external model access", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/research/roadmap`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic: "الرحمة في التعامل مع الضعفاء",
        target_audience: "جمهور عام",
        country_or_context: "السياق المحلي غير محدد",
        format: "خطبة جمعة",
        duration: "15–20 دقيقة",
        official_instruction_state: "none_declared",
        language: "ar"
      }),
    });
    assert.equal(response.status, 200);
    const roadmap = await response.json();
    assert.equal(roadmap.generation_mode, "methodology_template");
    assert.equal(roadmap.policy_gate.decision, "proceed");
    assert.equal(roadmap.axes.length, 3);
  });
});

test("roadmap API rejects a vague topic with a structured client error", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/research/roadmap`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: "الرحمة" }),
    });
    assert.equal(response.status, 400);
    const error = await response.json();
    assert.equal(error.error, "INVALID_RESEARCH_BRIEF");
    assert.equal(error.details.field, "topic");
  });
});

test("roadmap API refuses a personal fatwa before model planning or retrieval", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/research/roadmap`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic: "أفطرت متعمدًا فماذا أفعل الآن وهل تجب علي كفارة",
        target_audience: "حالة شخصية",
        country_or_context: "السعودية",
        format: "بحث",
        duration: "15 دقيقة",
        official_instruction_state: "none_declared",
        language: "ar",
      }),
    });
    assert.equal(response.status, 422);
    const error = await response.json();
    assert.equal(error.error, "PERSONAL_FATWA_REFERRAL_REQUIRED");
    assert.equal(error.details.content_level, "d");
    assert.match(error.details.safe_alternative, /جهة إفتاء/);
  });
});

test("roadmap evidence API rejects an invalid roadmap before source access", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/research/evidence`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roadmap: { roadmap_id: "invalid", axes: [] } }),
    });
    assert.equal(response.status, 400);
    const error = await response.json();
    assert.equal(error.error, "INVALID_ROADMAP_AXES");
  });
});
