import assert from "node:assert/strict";
import test from "node:test";
import { acceptsRelevance, validateRelevanceAssessments } from "../apps/api/src/lib/evidence-relevance.mjs";
import { OpenAIEvidenceReranker } from "../apps/api/src/lib/openai-evidence-reranker.mjs";

const records = [{ record: { id: "quran:1:1:ar" } }, { record: { id: "hadith:2:ar" } }];
const axes = [{ axis_id: "history" }];

test("a high keyword score cannot override a weak compound relationship", () => {
  assert.equal(acceptsRelevance({ role: "direct", score: 94, relationship_score: 20 }), false);
  assert.equal(acceptsRelevance({ role: "direct", score: 82, relationship_score: 81 }), true);
  assert.equal(acceptsRelevance({ role: "contextual", score: 60, relationship_score: 25 }), true);
  assert.equal(acceptsRelevance({ role: "contextual", score: 59, relationship_score: 36 }), false);
  assert.equal(acceptsRelevance({ role: "contextual", score: 76, relationship_score: 24 }), false);
  assert.equal(acceptsRelevance({ role: "irrelevant", score: 100, relationship_score: 100 }), false);
});

test("reranker rejects missing, duplicated, unknown and malformed assessments", () => {
  const first = { id: "quran:1:1:ar", axis_id: "history", role: "contextual", score: 85, relationship_score: 30, reason: "تأصيل عام" };
  const second = { id: "hadith:2:ar", axis_id: "history", role: "direct", score: 86, relationship_score: 85, reason: "رواية مباشرة" };
  assert.deepEqual(validateRelevanceAssessments([first, second], records, axes), [first, second]);
  assert.throws(() => validateRelevanceAssessments([first], records, axes), /INCOMPLETE/);
  assert.throws(() => validateRelevanceAssessments([first, first], records, axes), /INVALID/);
  assert.throws(() => validateRelevanceAssessments([first, { ...second, axis_id: "invented" }], records, axes), /INVALID/);
});

test("OpenAI reranker submits complete source text and a strict structured relevance request", async () => {
  let request;
  const reranker = new OpenAIEvidenceReranker({ apiKey: "test-key", model: "test-model", fetchImpl: async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, json: async () => ({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ assessments: [{
      id: "hadith:2:ar", axis_id: "history", role: "direct", score: 88, relationship_score: 83, reason: "صلة مركبة",
    }] }) }] }] }) };
  } });
  const result = await reranker.assess({ topic: "الكرم عند الصحابة", axes, records: [{ record: {
    id: "hadith:2:ar", source_family: "hadith", text: "متن كامل عن كرم أحد الصحابة", metadata: { commentary: "شرح مستقل" },
  } }] });
  assert.equal(result[0].role, "direct");
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.store, false);
  assert.match(request.input, /الكرم عند الصحابة/u);
  assert.match(request.input, /متن كامل عن كرم أحد الصحابة/u);
});

test("query expansion keeps the compound relationship in two bounded semantic searches", async () => {
  const reranker = new OpenAIEvidenceReranker({ apiKey: "test-key", model: "test-model", fetchImpl: async () => ({
    ok: true, json: async () => ({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ queries: [
      "مواقف الصحابة في بذل المال وإكرام المحتاج",
      "أحاديث تصف إنفاق أصحاب النبي وإيثارهم",
    ] }) }] }] }),
  }) });
  const queries = await reranker.expand({ topic: "الكرم عند الصحابة", axis: { title: "مواقف الكرم", research_question: "ما مواقفهم؟" } });
  assert.equal(queries.length, 2);
  assert.ok(queries.every((query) => /الصحابة|أصحاب النبي/u.test(query)));
});
