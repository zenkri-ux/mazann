import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePlannerRoadmap, summarizePlannerEvaluation } from "@mazann/domain/planner-evaluation";

const testCase = {
  id: "TEST",
  name: "اختبار",
  expected_terms: ["التثبت", "الأخبار", "النشر"],
  requires_clarification: true,
};

function roadmap(overrides = {}) {
  return {
    generation_mode: "model_assisted",
    topic_analysis: { intent: "التثبت من الأخبار قبل النشر" },
    axes: [
      { role: "foundation", title: "معنى التثبت", research_question: "ما معنى التثبت من الأخبار؟", purpose: "ضبط المفهوم", rationale: "يؤسس البحث", evidence_requirements: ["quran", "tafsir"] },
      { role: "context", title: "سياق المنصات", research_question: "كيف ينتشر الخبر في المنصات؟", purpose: "فهم الواقع", rationale: "يراعي الجمهور", evidence_requirements: ["hadith", "approved_research"] },
      { role: "outcome", title: "قرار قبل النشر", research_question: "ما خطوات التحقق العملية؟", purpose: "تغيير السلوك", rationale: "يحقق المقصد", evidence_requirements: ["quran", "sirah"] },
    ],
    human_review: { questions: ["س1", "س2", "س3", "ما المنصات الأكثر استخدامًا؟"] },
    ...overrides,
  };
}

test("passes a specific, distinct, model-assisted roadmap", () => {
  const result = evaluatePlannerRoadmap(testCase, roadmap());
  assert.equal(result.passed, true);
  assert.equal(result.checks.find((item) => item.id === "no_invented_citation").passed, true);
});

test("blocks deterministic templates from the intelligence gate", () => {
  const result = evaluatePlannerRoadmap(testCase, roadmap({ generation_mode: "methodology_template" }));
  const summary = summarizePlannerEvaluation([result]);
  assert.equal(result.passed, false);
  assert.equal(summary.status, "blocked_model_not_configured");
});

test("fails when generated planning invents a sacred citation", () => {
  const unsafe = roadmap();
  unsafe.axes[0].purpose = "قال الله تعالى نصًا مقترحًا";
  const result = evaluatePlannerRoadmap(testCase, unsafe);
  assert.equal(result.passed, false);
  assert.equal(result.checks.find((item) => item.id === "no_invented_citation").passed, false);
});
