# مَظَانّ

مساعد بحث مسؤول لخطيب الجمعة يحول الموضوع إلى خطة بحث مفسّرة وحقيبة أدلة قابلة للمراجعة. الإصدار الحالي يُبنى ضمن تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي، ولا يولد فتوى أو خطبة نهائية.

## بنية المستودع

هذا **modular monolith داخل monorepo**: الحدود واضحة داخل الكود، بينما يظل النشر بسيطًا في حاوية واحدة خلال التحدي.

```text
apps/
  api/                         HTTP API + static host + orchestration
  web/                         Arabic RTL product interface
packages/
  domain/                      canonical evidence normalization
  connectors/islamic-content/ official MCP connector
  contracts/                   schemas, methodology and instructions
data/
  cache/                       immutable judging seed cache
  runtime/                     writable runtime cache, ignored by Git
evaluation/                    test cases, reviewer protocol and evidence
scripts/                       cache and source-manifest operations
test/                          deterministic unit and safety tests
```

لا نقسمه إلى microservices الآن؛ فصل العمليات لا يضيف قيمة في مدة التحدي. يمكن لاحقًا فصل الموصل أو التخطيط أو الفهرسة لأن حدود الحزم موجودة من البداية.

## التشغيل المحلي

المتطلب: Node.js 22 أو أحدث.

```bash
npm install
npm start
```

ثم افتح `http://127.0.0.1:8090`.

لا يحتاج موصل المحتوى الإسلامي الرسمي إلى مفتاح. انسخ `.env.example` إلى `.env` فقط عند تغيير الإعدادات، ولا تضف `.env` إلى Git.

## التشغيل بالحاوية

```bash
docker compose up --build
```

تعمل الحاوية كمستخدم غير root، بنظام ملفات للقراءة فقط، بلا Linux capabilities، مع volume منفصل للـruntime cache وفحص صحة على `/api/health`.

للإيقاف:

```bash
docker compose down
```

## نقاط API المنفذة

- `GET /api/health`
- `POST /api/evidence/search`
- `POST /api/evidence/quran`
- `POST /api/evidence/hadith`
- `POST /api/evidence/fetch`

الاسترجاع الحي يستخدم `https://mcp.islamiccontent.org/mcp`. بعد استرجاع ناجح، يحفظ الخادم سجلًا معياريًا في runtime cache. عند فشل الشبكة يقرأ النسخة الموثقة إن وجدت ويعيد `retrieval_mode: "cache"`؛ وإلا يمتنع صراحة ولا يكمل من ذاكرة النموذج أو الويب المفتوح.

## التحقق

```bash
npm test
npm run seed:demo
npm run manifest:sources
```

- `seed:demo` يحتاج الشبكة ويحدث النسخة الثابتة لآية النساء 58 وحديث HadeethEnc رقم 3016.
- `manifest:sources` يولد `data/source-manifest.json` بصورة حتمية من السجلات وبصماتها.
- GitHub Actions يشغل الاختبارات، يتحقق من ثبات manifest، ويبني صورة Docker من دون نشرها.

## حدود الإصدار

- التخطيط المدعوم بالذكاء الاصطناعي والحفظ الكامل للمشاريع لم ينفذا بعد.
- أي سجل يفشل فحص الوحدة أو المرجع لا يعاد بوصفه دليلًا صالحًا.
- السجلان الحاليان صالحان للمراجعة، لكن النشر النهائي محجوب حتى تسجل نسخة upstream التي لا يعيدها موصل MCP في استجابة السجل.
- اختيار ترخيص المستودع العام ما زال قرارًا مطلوبًا من مالك المشروع.

انظر `KNOWLEDGE_BASE_POLICY.md` و`SOLUTION_ARCHITECTURE.md` و`evaluation/README.md` للسياسات وخطة التقييم.
