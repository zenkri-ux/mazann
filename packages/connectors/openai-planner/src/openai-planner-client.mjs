export class PlannerProviderError extends Error {
  constructor(message, { code = "PLANNER_PROVIDER_ERROR", status, cause } = {}) {
    super(message, { cause });
    this.name = "PlannerProviderError";
    this.code = code;
    this.status = status;
  }
}

export const plannerDraftSchema = {
  type: "object",
  additionalProperties: false,
  required: ["topic_analysis", "axes", "clarifying_questions", "quality_review"],
  properties: {
    topic_analysis: {
      type: "object",
      additionalProperties: false,
      required: ["topic_type", "intent", "audience_need", "sensitivity_note"],
      properties: {
        topic_type: { type: "string" },
        intent: { type: "string" },
        audience_need: { type: "string" },
        sensitivity_note: { type: "string" },
      },
    },
    axes: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["role", "title", "research_question", "purpose", "rationale", "evidence_requirements", "time_weight", "risk_flags"],
        properties: {
          role: { type: "string", enum: ["foundation", "context", "application", "outcome"] },
          title: { type: "string" },
          research_question: { type: "string" },
          purpose: { type: "string" },
          rationale: { type: "string" },
          evidence_requirements: {
            type: "array",
            minItems: 1,
            items: { type: "string", enum: ["quran", "hadith", "tafsir", "sirah", "approved_research"] },
          },
          time_weight: { type: "integer", minimum: 1, maximum: 10 },
          risk_flags: { type: "array", items: { type: "string" } },
        },
      },
    },
    clarifying_questions: { type: "array", maxItems: 3, items: { type: "string" } },
    quality_review: {
      type: "object",
      additionalProperties: false,
      required: ["overlap_check", "audience_fit", "scope_check", "remaining_gap"],
      properties: {
        overlap_check: { type: "string" },
        audience_fit: { type: "string" },
        scope_check: { type: "string" },
        remaining_gap: { type: "string" },
      },
    },
  },
};

function responseText(payload) {
  for (const item of payload?.output ?? []) {
    if (item?.type !== "message") continue;
    const text = item.content?.find((content) => content?.type === "output_text")?.text;
    if (typeof text === "string" && text.trim()) return text;
  }
  return null;
}

export class OpenAIPlannerClient {
  constructor({ apiKey, model, endpoint = "https://api.openai.com/v1/responses", timeoutMs = 30_000, fetchImpl = globalThis.fetch } = {}) {
    if (!apiKey) throw new TypeError("OpenAI API key is required");
    if (!model) throw new TypeError("OpenAI model is required");
    if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
    this.apiKey = apiKey;
    this.model = model;
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
  }

  async plan({ brief, methodology, policyGate }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetch(this.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          store: false,
          instructions: [
            "أنت مخطط بحث مسؤول لمساعد خطيب جمعة، ولست مفتيًا ولا كاتب خطبة نهائية.",
            "حلل الموضوع والجمهور والسياق، ثم أنشئ محاور مختلفة فعلًا ومترابطة وغير متكررة.",
            "كل محور يجب أن يؤدي وظيفة بحثية محددة، وسؤالًا دقيقًا، وسببًا منهجيًا، ونوع الدليل المطلوب.",
            "لا تنشئ آية أو حديثًا أو حكمًا أو إحالة. اقترح فئات الأدلة فقط ليجلبها النظام لاحقًا من المصادر المعتمدة.",
            "التعميم الرسمي قيد تنظيمي لا دليل شرعي. راع نقاطه إن وجدت من دون نسبتها للوحي.",
            "اكتب العربية الواضحة المناسبة للمستخدم، وحدد الغموض أو الحساسية بدل إخفائهما.",
          ].join("\n"),
          input: JSON.stringify({ brief, methodology, policy_gate: policyGate }),
          text: {
            format: {
              type: "json_schema",
              name: "mazann_topic_roadmap_draft",
              description: "A reviewed, evidence-seeking research roadmap draft for Mazann",
              strict: true,
              schema: plannerDraftSchema,
            },
          },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new PlannerProviderError(`أعاد مزود التخطيط HTTP ${response.status}`, {
          code: "PLANNER_HTTP_ERROR",
          status: response.status,
        });
      }
      const payload = await response.json();
      const text = responseText(payload);
      if (!text) throw new PlannerProviderError("لم يعد مزود التخطيط مخرجات قابلة للاستخدام", { code: "PLANNER_EMPTY_OUTPUT" });
      try {
        return { draft: JSON.parse(text), provider: "openai", model: payload.model ?? this.model, response_id: payload.id ?? null };
      } catch (error) {
        throw new PlannerProviderError("تعذر تحليل خارطة التخطيط المنظمة", { code: "PLANNER_INVALID_JSON", cause: error });
      }
    } catch (error) {
      if (error instanceof PlannerProviderError) throw error;
      if (error?.name === "AbortError") throw new PlannerProviderError("انتهت مهلة مزود التخطيط", { code: "PLANNER_TIMEOUT", cause: error });
      throw new PlannerProviderError("تعذر الاتصال بمزود التخطيط", { code: "PLANNER_NETWORK_ERROR", cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
}
