# Security Policy

## Reporting

لا تنشر مفاتيح، بيانات مستخدمين، أو تفاصيل ثغرة قابلة للاستغلال في issue عام. استخدم تبويب `Security` في مستودع GitHub لإرسال بلاغ خاص عبر Private Vulnerability Reporting. إذا لم يظهر الخيار، تواصل مع مالك المستودع عبر قناة خاصة قبل نشر أي تفاصيل.

## Secrets

- تحفظ الأسرار في متغيرات البيئة أو secret manager الخاص بمنصة النشر.
- لا تضاف ملفات `.env` إلى Git.
- يدور أي مفتاح ظهر في طرفية أو محادثة أو لقطة شاشة، حتى إذا لم يدخل تاريخ Git.
- خادم المحتوى الإسلامي الحالي لا يحتاج مفتاحًا.
- تفحص السجلات قبل مشاركتها، ولا تسجل نصوص مدخلات المستخدم افتراضيًا.

## Content integrity

أي خلل في نص آية أو حديث، أو مرجع وهمي، أو ختم تحقق غير صحيح يعامل حادث سلامة ويمنع النشر حتى الإصلاح وإعادة الاختبار.

## Alpha reviewer isolation

The protected Alpha assigns a random workspace identifier to each browser and scopes saved-project list, read and update operations to that workspace. This prevents accidental cross-reviewer discovery, but it is not authentication or a multi-user authorization system. Only trusted reviewers receive the shared gateway credentials, and sensitive or personal material must not be entered during Alpha testing.
