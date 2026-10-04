import test from "node:test";
import assert from "node:assert/strict";
import { TopicPlanningService } from "../apps/api/src/services/topic-planning-service.mjs";

const input = {
  topic: "الرحمة في التعامل مع الضعفاء",
  target_audience: "ناشئة",
  country_or_context: "السياق المحلي",
  format: "خطبة جمعة",
  duration: "15–20 دقيقة",
  official_instruction_state: "none_declared",
  language: "ar",
};

const draft = {
  topic_analysis: { topic_type: "قيمي سلوكي", intent: "بناء سلوك", audience_need: "صور قريبة", sensitivity_note: "عدم اختزال الضعف" },
  axes: [
    { role: "foundation", title: "الرحمة بوصفها أصلًا موجّهًا", research_question: "كيف تؤسس النصوص لمعنى الرحمة المنضبط؟", purpose: "تحديد المعنى والحدود قبل الأمثلة العملية.", rationale: "يمنع اختزال الرحمة في عاطفة عابرة.", evidence_requirements: ["quran", "hadith", "tafsir"], time_weight: 3, risk_flags: [] },
    { role: "context", title: "من هم الضعفاء في واقع الناشئة؟", research_question: "ما الصور القريبة التي يدركها الناشئة دون وصم أصحابها؟", purpose: "ربط المعنى بمواقف قابلة للفهم والمراجعة.", rationale: "يلائم الجمهور بدل استخدام أمثلة بعيدة عنه.", evidence_requirements: ["sirah", "approved_research"], time_weight: 3, risk_flags: ["تجنب الوصم"] },
    { role: "application", title: "ممارسات تحفظ الكرامة", research_question: "ما الممارسات اليومية التي تحول الرحمة إلى نصرة مسؤولة؟", purpose: "اقتراح انتقال عملي لا يتجاوز الأدلة المسترجعة.", rationale: "يصل البحث بالسلوك من دون ادعاء حكم جديد.", evidence_requirements: ["quran", "hadith"], time_weight: 4, risk_flags: [] },
  ],
  clarifying_questions: ["ما أبرز موقف يواجهه جمهور الناشئة؟"],
  quality_review: { overlap_check: "المحاور متمايزة", audience_fit: "الأمثلة موجهة للناشئة", scope_check: "لا فتوى", remaining_gap: "اختيار الأدلة" },
};

test("planning service upgrades the safe roadmap with validated model analysis", async () => {
  const service = new TopicPlanningService({
    provider: { plan: async () => ({ draft, provider: "openai", model: "test-model", response_id: "resp_test" }) },
  });
  const roadmap = await service.create(input);
  assert.equal(roadmap.generation_mode, "model_assisted");
  assert.equal(roadmap.planner_status.state, "completed");
  assert.equal(roadmap.axes[1].title, "من هم الضعفاء في واقع الناشئة؟");
  assert.equal(roadmap.axes.reduce((sum, axis) => sum + axis.time_minutes, 0), 18);
  assert.equal(roadmap.human_review.questions[0], "ما أبرز موقف يواجهه جمهور الناشئة؟");
});

test("planning service falls back visibly when the model provider fails", async () => {
  const service = new TopicPlanningService({
    provider: { plan: async () => { throw Object.assign(new Error("offline"), { code: "PLANNER_NETWORK_ERROR" }); } },
  });
  const roadmap = await service.create(input);
  assert.equal(roadmap.generation_mode, "methodology_template");
  assert.equal(roadmap.planner_status.state, "fallback");
  assert.equal(roadmap.planner_status.code, "PLANNER_NETWORK_ERROR");
});
