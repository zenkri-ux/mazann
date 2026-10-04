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

function governingInstruction(input, state) {
  if (state !== "verified") return null;
  const value = input.governing_instruction;
  if (!value || typeof value !== "object") {
    throw new RoadmapInputError("أضف بيانات التعميم أو الموضوع الرسمي", { field: "governing_instruction" });
  }
  const requiredPoints = Array.isArray(value.required_points)
    ? value.required_points.map((item) => cleanText(item, "required_points", { max: 240 })).slice(0, 8)
    : cleanText(value.required_points ?? "", "required_points", { min: 4, max: 1_000 })
      .split(/\r?\n|[؛;]/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
  if (!requiredPoints.length) {
    throw new RoadmapInputError("أضف نقطة واحدة على الأقل مطلوبة في التوجيه", { field: "required_points" });
  }
  return {
    issuing_authority: cleanText(value.issuing_authority, "issuing_authority", { min: 2, max: 160 }),
    title: cleanText(value.title, "instruction_title", { min: 4, max: 240 }),
    reference: cleanText(value.reference, "instruction_reference", { min: 3, max: 500 }),
    required_points: requiredPoints,
  };
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
  const instruction = governingInstruction(input, instructionState);

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
  const policyDecision = instructionState === "unverified" ? "proceed_with_visible_caveat" : "proceed";

  return {
    roadmap_id: roadmapId({ ...brief, official_instruction_state: instructionState, governing_instruction: instruction }),
    methodology: { id: "friday_sermon_research", version: "1.0.0" },
    generation_mode: "methodology_template",
    planner_status: { state: "methodology_only", provider: null, model: null },
    brief,
    policy_gate: {
      official_instruction_state: instructionState,
      decision: policyDecision,
      content_level: "requires_classification",
      governing_instruction: instruction,
      note: instructionState === "verified"
        ? `تراعي الخطة التوجيه «${instruction.title}» الصادر عن ${instruction.issuing_authority}، وتبقى مرجعيته منفصلة عن الأدلة الشرعية.`
        : instructionState === "none_declared"
          ? "سجل المستخدم أن الموضوع من اختياره ولا يعمل بناءً على تعميم خاص."
          : "لم يتحقق المستخدم بعد من وجود تعميم خاص؛ يمكن متابعة البحث مع إبقاء التذكير ظاهرًا قبل اعتماد الحقيبة.",
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

export function enhanceTopicRoadmap(base, draft, { provider, model, responseId = null } = {}) {
  if (!draft || !Array.isArray(draft.axes) || draft.axes.length < 3 || draft.axes.length > 5) {
    throw new RoadmapInputError("مخرجات التخطيط لا تحتوي عددًا صالحًا من المحاور", { field: "axes" });
  }
  const allowedRoles = new Set(["foundation", "context", "application", "outcome"]);
  const allowedEvidence = new Set(["quran", "hadith", "tafsir", "sirah", "approved_research"]);
  const weights = draft.axes.map((axis) => {
    if (!allowedRoles.has(axis.role)) throw new RoadmapInputError("وظيفة محور غير صالحة", { field: "role" });
    if (!Number.isInteger(axis.time_weight) || axis.time_weight < 1 || axis.time_weight > 10) {
      throw new RoadmapInputError("وزن زمني غير صالح", { field: "time_weight" });
    }
    return axis.time_weight;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const normalizedWeights = weights.map((weight) => weight / totalWeight);
  const minutes = allocate(durationMinutes(base.brief.duration), normalizedWeights);
  const axes = draft.axes.map((axis, index) => {
    const requirements = [...new Set(axis.evidence_requirements ?? [])];
    if (!requirements.length || requirements.some((item) => !allowedEvidence.has(item))) {
      throw new RoadmapInputError("متطلبات دليل غير صالحة", { field: "evidence_requirements" });
    }
    return {
      axis_id: `axis_${String(index + 1).padStart(2, "0")}`,
      role: axis.role,
      title: cleanText(axis.title, "axis_title", { min: 4, max: 160 }),
      research_question: cleanText(axis.research_question, "research_question", { min: 8, max: 320 }),
      purpose: cleanText(axis.purpose, "axis_purpose", { min: 8, max: 320 }),
      rationale: cleanText(axis.rationale, "axis_rationale", { min: 8, max: 320 }),
      evidence_requirements: requirements,
      time_minutes: minutes[index],
      risk_flags: Array.isArray(axis.risk_flags)
        ? axis.risk_flags.map((item) => cleanText(item, "risk_flag", { max: 180 })).slice(0, 5)
        : [],
    };
  });
  const questions = Array.isArray(draft.clarifying_questions)
    ? draft.clarifying_questions.map((item) => cleanText(item, "clarifying_question", { max: 240 })).slice(0, 3)
    : [];
  return {
    ...base,
    generation_mode: "model_assisted",
    planner_status: { state: "completed", provider, model, response_id: responseId },
    topic_analysis: draft.topic_analysis,
    axes,
    planning_quality: draft.quality_review,
    human_review: {
      ...base.human_review,
      questions: [...questions, ...base.human_review.questions].slice(0, 5),
    },
  };
}
