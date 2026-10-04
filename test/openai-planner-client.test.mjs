import test from "node:test";
import assert from "node:assert/strict";
import { OpenAIPlannerClient } from "@mazann/openai-planner";

const draft = {
  topic_analysis: { topic_type: "قيمي", intent: "فهم وتطبيق", audience_need: "أمثلة واقعية", sensitivity_note: "تجنب التعميم" },
  axes: [],
  clarifying_questions: [],
  quality_review: { overlap_check: "لا تكرار", audience_fit: "مناسب", scope_check: "منضبط", remaining_gap: "المراجعة البشرية" },
};

test("OpenAI planner requests private structured output through the Responses API", async () => {
  let requestBody;
  const client = new OpenAIPlannerClient({
    apiKey: "test-key",
    model: "test-model",
    fetchImpl: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      assert.equal(init.headers.authorization, "Bearer test-key");
      return {
        ok: true,
        json: async () => ({
          id: "resp_test",
          model: "test-model",
          output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(draft) }] }],
        }),
      };
    },
  });
  const result = await client.plan({ brief: {}, methodology: {}, policyGate: {} });
  assert.equal(requestBody.store, false);
  assert.equal(requestBody.text.format.type, "json_schema");
  assert.equal(requestBody.text.format.strict, true);
  assert.equal(result.response_id, "resp_test");
  assert.deepEqual(result.draft, draft);
});

test("OpenAI planner exposes provider failures without leaking credentials", async () => {
  const client = new OpenAIPlannerClient({
    apiKey: "secret-not-to-return",
    model: "test-model",
    fetchImpl: async () => ({ ok: false, status: 429 }),
  });
  await assert.rejects(() => client.plan({ brief: {}, methodology: {}, policyGate: {} }), (error) => {
    assert.equal(error.code, "PLANNER_HTTP_ERROR");
    assert.doesNotMatch(error.message, /secret-not-to-return/);
    return true;
  });
});
