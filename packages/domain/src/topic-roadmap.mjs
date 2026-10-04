import { createHash } from "node:crypto";

export class RoadmapInputError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "RoadmapInputError";
    this.code = "INVALID_RESEARCH_BRIEF";
    this.status = 400;
    this.details = details;
  }
}

const allowedInstructionStates = new Set(["none_declared", "unverified", "verified"]);

function cleanText(value, field, { min = 1, max = 240 } = {}) {
  if (typeof value !== "string") throw new RoadmapInputError(`حقل ${field} مطلوب`, { field });
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length < min || cleaned.length > max) {
    throw new RoadmapInputError(`طول ${field} يجب أن يكون بين ${min} و${max} حرفًا`, { field, min, max });
  }
  return cleaned;
}

function durationMinutes(value) {
  const numbers = value.match(/\d+/g)?.map(Number) ?? [];
  if (!numbers.length) return 15;
  return numbers.length > 1 ? Math.round((numbers[0] + numbers[1]) / 2) : numbers[0];
}

function allocate(total, weights) {
  const safeTotal = Math.max(total, weights.length);
  const values = weights.map((weight) => Math.max(1, Math.floor(safeTotal * weight)));
  let remaining = safeTotal - values.reduce((sum, value) => sum + value, 0);
  for (let index = 0; remaining > 0; index = (index + 1) % values.length) {
    values[index] += 1;
    remaining -= 1;
  }
  return values;
}

function roadmapId(brief) {
  const digest = createHash("sha256").update(JSON.stringify(brief)).digest("hex").slice(0, 16);
  return `roadmap_${digest}`;
}

export function createTopicRoadmap(input = {}) {
  const topic = cleanText(input.topic, "topic", { min: 8, max: 240 });
  const targetAudience = cleanText(input.target_audience ?? "جمهور عام", "target_audience", { max: 100 });
  const format = cleanText(input.format ?? "خطبة جمعة", "format", { max: 100 });
  const duration = cleanText(input.duration ?? "15–20 دقيقة", "duration", { max: 50 });
  const countryOrContext = cleanText(input.country_or_context ?? "السياق المحلي للمستخدم", "country_or_context", { max: 120 });
  const intendedOutcome = cleanText(input.intended_outcome ?? "بناء فهم مؤصل يقود إلى تطبيق مسؤول", "intended_outcome", { max: 180 });
  const language = input.language ?? "ar";
  if (language !== "ar") throw new RoadmapInputError("الإصدار الحالي يدعم خارطة البحث العربية فقط", { field: "language" });

  const instructionState = input.official_instruction_state ?? "unverified";
  if (!allowedInstructionStates.has(instructionState)) {
    throw new RoadmapInputError("حالة التوجيه الرسمي غير صالحة", { field: "official_instruction_state" });
  }

  const brief = {
    topic,
    intended_outcome: intendedOutcome,
    target_audience: targetAudience,
    country_or_context: countryOrContext,
    format,
    duration,
    language,
  };
  const minutes = allocate(durationMinutes(duration), [0.3, 0.4, 0.3]);
  const policyDecision = instructionState === "verified"
    ? "proceed"
    : instructionState === "none_declared"
      ? "proceed_with_visible_caveat"
      : "hold_for_verification";

  return {
    roadmap_id: roadmapId({ ...brief, official_instruction_state: instructionState }),
    methodology: { id: "friday_sermon_research", version: "1.0.0" },
    generation_mode: "methodology_template",
    brief,
    policy_gate: {
      official_instruction_state: instructionState,
      decision: policyDecision,
      content_level: "requires_classification",
      note: instructionState === "verified"
        ? "سُجل وجود توجيه متحقق؛ يجب إرفاق مرجعه ونطاقه قبل جمع الأدلة."
        : "لم يتحقق النظام من توجيه رسمي نافذ؛ تبقى هذه نقطة مراجعة ظاهرة ولا يُفترض عدم وجوده.",
    },
    axes: [
      {
        axis_id: "foundation",
        role: "foundation",
        title: `تأصيل موضوع: ${topic}`,
        research_question: `ما المعنى المؤسس لموضوع «${topic}»، وما حدوده التي تمنع التوسع غير المنضبط؟`,
        purpose: "تثبيت المفهوم قبل الانتقال إلى التطبيقات، مع فصل النص الأصلي عن الشرح.",
        evidence_requirements: ["quran", "hadith", "tafsir"],
        time_minutes: minutes[0],
      },
      {
        axis_id: "context",
        role: "context",
        title: `صور الموضوع في واقع ${targetAudience}`,
        research_question: `أين يظهر موضوع «${topic}» في واقع ${targetAudience} ضمن ${countryOrContext}؟`,
        purpose: "اختيار صور مرتبطة بحال الجمهور من دون إسقاط دليل على سياق لم يراجع.",
        evidence_requirements: ["hadith", "sirah", "approved_research"],
        time_minutes: minutes[1],
      },
      {
        axis_id: "outcome",
        role: "outcome",
        title: "الأثر والتطبيق القابل للمراجعة",
        research_question: `كيف يقود هذا التأصيل إلى «${intendedOutcome}» بخطوات واقعية تناسب ${targetAudience}؟`,
        purpose: "تحويل المعرفة إلى تطبيق منضبط مع إظهار ما يحتاج إلى مراجعة متخصصة.",
        evidence_requirements: ["quran", "hadith", "approved_research"],
        time_minutes: minutes[2],
      },
    ],
    human_review: {
      required: true,
      checkpoint: "approve_or_edit_plan",
      questions: [
        "هل يعكس ترتيب المحاور حاجة الجمهور الفعلية؟",
        "هل يوجد توجيه رسمي نافذ يجب توثيقه قبل البحث؟",
        "هل يمكن تناول الموضوع ضمن المدة من دون اختزال مخل؟",
      ],
    },
    limitations: [
      "الخارطة تنظّم مسار البحث ولا تثبت حكمًا شرعيًا.",
      "متطلبات الأدلة فئات بحث وليست إحالات مكتملة قبل الاسترجاع والتحقق.",
      "يلزم اعتماد الباحث للخطة قبل جمع الأدلة.",
    ],
  };
}
