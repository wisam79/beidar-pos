---
trigger: glob
globs:
  - "internal/**/*.go"
  - "pkg/**/*.go"
  - "app.go"
  - "main.go"
description: "قواعد العمارة النظيفة للواجهة الخلفية Go + Wails: الطبقات، معالجة الأخطاء، المرونة، والأداء"
---

# قواعد الواجهة الخلفية (Go 1.25 + Wails v2.12)

> المصدر الحاكم: `AGENTS.md` القسم 2 · التفاصيل الموسعة: [`/skills/beidar-architecture-navigator/SKILL.md`](../skills/beidar-architecture-navigator/SKILL.md)

## 1. الفصل المطلق للطبقات (Strict Layering)
**القاعدة الذهبية:** يُمنع استدعاء `gorm.DB` مباشرة في `handlers` أو `service`. كل طبقة تتحدث فقط مع الطبقة الأسفل منها عبر واجهات `domain`.

| ❌ ممنوع | ✅ البديل الصحيح | السبب |
|---|---|---|
| `tx.DB().Clauses(clause.Locking{})` داخل `service` | تعريف `GetForUpdate()` في `repository` | تلوث منطق الأعمال بكود قواعد البيانات |
| استدعاء Wails Context داخل `repository` أو `service` | إرجاع خطأ إلى `handlers` وهو يتعامل مع Wails | فصل الاهتمامات — الـ Repo لا يعرف Wails |
| منطق مالي/ضريبي في React | كتابته في `service` واستدعاؤه عبر React Query | توحيد الحسابات وحمايتها |
| تكرار تعريف Structs في كل ملف | استيرادها من `internal/core/domain` | منع الاعتماديات الدائرية |
| `float64` للمبالغ المالية | `domain.Amount` (int64 cents) | منع أخطاء التقريب |
| مفاتيح API كنص صريح | `pkg/secureconfig` للتخزين المشفر | منع التسريب |

- `internal/core/domain` طبقة نقية: لا تعتمد على أي حزمة خارجية ولا GORM.
- أي تعامل مع DB أو `clause` يكون دالة في واجهة الـ repository.

## 2. معالجة الأخطاء (Error Handling)
- كل دالة Handler مُصدرة لـ Wails تُرجع إما النتيجة أو `error` (الواجهة تستقبلها كـ `Promise.reject`).
- استخدم `fmt.Errorf("context message: %w", err)` للحفاظ على السياق، ويُمنع ابتلاع الأخطاء أو تجاهلها في المسارات الحساسة بدون تسجيل على الأقل.
- أخطاء الأعمال تُبنى عبر `pkg/errors` (`NewAppError`) مع رموز واضحة، لا نصوص حرة متفرقة.

## 3. دورة إضافة Handler جديد (IPC Bridge)
1. عرّف الدالة في طبقة الـ `service` ثم أضفها لواجهة الـ domain المناسبة.
2. أنشئ دالة تصدير في `internal/handlers/` تستدعي الـ service وترجع القيم إلى Wails.
3. أضف الـ Handler في دالة `initHandlers` داخل [`app.go`](../../app.go) (النمط: `handlers.NewXxxHandler(services.xxx)`).
4. أضف المستهلك في `frontend/src/core/api/` عبر React Query، ثم زامن الـ Mock في [`frontend/e2e/mock-wails.ts`](../../frontend/e2e/mock-wails.ts).

## 4. المرونة والتعافي الذاتي (Resilience)
- **الأجهزة الطرفية:** عند فشل طابعة أو قارئ، وفر بديلاً برمجياً (مثل PDF بدل الطباعة الورقية) ولا تفشل بصمت.
- **الخدمات السحابية:** كل استدعاء خارجي يُغلف بإعادة محاولات متباعدة أسياً (Exponential Backoff) بدل الفشل من المحاولة الأولى.
- **الواجهة:** كل الأخطاء غير المعالجة تُمرر إلى المسجل المركزي [`frontend/src/core/logger.ts`](../../frontend/src/core/logger.ts).

## 5. الأداء وإدارة الذاكرة
- **يُمنع جلب حقول ضخمة (صور Base64/Blob) في استعلامات القوائم.** صور المنتجات تعيش في نظام ملفات مع خادم صور محلي — لا تُعاد إلى قاعدة البيانات.
- استعلامات القوائم الطويلة تُصفَّح، وعرضها في الواجهة يمر عبر TanStack Virtual.
- حقول البحث المحلي الكبيرة تُغلف بـ `useDeferredValue`.
- يُمنع تمرير نصوص ضخمة (+10MB) إلى `JSON.parse` في خيط الواجهة الرئيسي.

## 6. التحقق قبل الإنهاء
```bash
go test ./internal/... ./pkg/...
go vet ./internal/... ./pkg/...
```
مع `-race` عند لمس مسارات التزامن أو المصادقة أو الأموال (انظر قاعدة `quality-ci-release`).
