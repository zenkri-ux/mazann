const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu;

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(DIACRITICS, "")
    .replace(/\u0640/gu, "")
    .replace(/[إأآٱ]/gu, "ا")
    .replace(/ى/gu, "ي")
    .replace(/\s+/gu, " ")
    .trim();
}

const DIRECT_REFERRAL = [
  /(?:افتوني|اريد فتوي|فتوي في حالتي|احكموا لي)/u,
  /(?:هل يجوز لي|هل يحل لي|ما حكم ما فعلت|ماذا افعل الان)/u,
  /(?:طلقت زوجتي|زوجي طلقني|حلفت بالطلاق|افطرت متعمدا|نذرت ثم)/u,
];
const PERSONAL_MARKER = /(?:^|\s)(?:انا|لي|زوجي|زوجتي|ابني|ابنتي|حالتي|مشكلتي)(?:\s|$)/u;
const PERSONAL_RULING = /(?:يجوز|حكم|طلاق|ميراث|ارث|كفاره|زكاه|ربا|صيام|افطار|نذر|يمين)/u;
const SENSITIVE = /(?:تكفير|تبديع|بدعه فلان|مساله خلافيه|خلاف فقهي|ترجيح فقهي|الطلاق|الميراث|المواريث|الفرق والطوايف|الولاء والبراء|الجهاد|نزاع مذهبي)/u;
const EXPLANATORY = /(?:شرح|معني|حكمه|لماذا|كيف|مقاصد|اثر|تفسير|تعليل|تعريف)/u;

export class ContentSafetyReferralError extends Error {
  constructor(classification) {
    super("هذا الطلب يتعلق بحالة شخصية أو فتوى؛ لا يقرر مَظَانّ الحكم. يمكنه عرض معلومات عامة موثقة، ويجب إحالة تفاصيل الحالة إلى جهة إفتاء أو عالم مؤهل.");
    this.name = "ContentSafetyReferralError";
    this.code = "PERSONAL_FATWA_REFERRAL_REQUIRED";
    this.status = 422;
    this.details = {
      content_level: "d",
      decision: "referral_required",
      reason_codes: classification.reason_codes,
      safe_alternative: "أعد صياغة الطلب كموضوع عام غير مرتبط بحالة شخص بعينه، أو راجع جهة إفتاء مؤهلة مع تفاصيل حالتك.",
    };
  }
}

export function classifyContentLevel({ topic, intended_outcome: intendedOutcome = "" } = {}) {
  const text = normalize(`${topic ?? ""} ${intendedOutcome}`);
  const directReferral = DIRECT_REFERRAL.some((pattern) => pattern.test(text));
  const personalRuling = PERSONAL_MARKER.test(text) && PERSONAL_RULING.test(text);
  if (directReferral || personalRuling) {
    return {
      level: "d",
      decision: "referral_required",
      reason_codes: [directReferral ? "explicit_personal_fatwa" : "personal_case_with_ruling"],
      review_required: true,
      note_ar: "طلب حالة شخصية: يمتنع النظام عن الحكم ويحيل إلى جهة مؤهلة.",
    };
  }
  if (SENSITIVE.test(text)) {
    return {
      level: "c",
      decision: "proceed_with_scholarly_review",
      reason_codes: ["disputed_or_sensitive_topic"],
      review_required: true,
      note_ar: "موضوع خلافي أو حساس: تجمع المواقف من مصادرها وتبقى المراجعة العلمية المتخصصة إلزامية.",
    };
  }
  if (EXPLANATORY.test(text)) {
    return {
      level: "b",
      decision: "proceed_with_qualified_explanation",
      reason_codes: ["explanation_or_reasoning"],
      review_required: false,
      note_ar: "طلب شرح أو تعليل: يلزم إسناد التفسير للمصادر المعتمدة وتجنب الجزم عند وجود خلاف.",
    };
  }
  return {
    level: "a",
    decision: "proceed_with_source_retrieval",
    reason_codes: ["stable_source_information"],
    review_required: false,
    note_ar: "معلومة تأسيسية مستقرة: يبدأ النظام باسترجاع مباشر من المصادر المعتمدة.",
  };
}
