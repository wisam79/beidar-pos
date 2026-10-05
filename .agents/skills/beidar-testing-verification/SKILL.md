---
name: beidar-testing-verification
description: منظومة الاختبارات والتحقق في بيدر — الأوامر، توزيع الاختبارات، مزامنة mock الـ E2E، وضوابط البيئة
---

# 🧪 الاختبارات والتحقق (Testing & Verification)

الخلفية: [`docs/testing.md`](../../docs/testing.md) · القاعدة النطاقية: [`.agents/rules/quality-ci-release.md`](../rules/quality-ci-release.md)

## 1. الأوامر المعتمدة
```bash
# الخلفية — سريعة وشاملة
go test ./internal/... ./pkg/...
go vet ./internal/... ./pkg/...

# كاشف التزامن للمسارات الحساسة (أموال/مصادقة/شبكة)
go test -race ./internal/core/domain ./pkg/auth ./pkg/crypto ./pkg/errors ./pkg/validator ./pkg/logger

# الواجهة
cd frontend
npm run typecheck        # أخطاء الأنواع
npm run lint             # ESLint
npm run test:ci          # Vitest مع --fileParallelism=false (استقرار Windows)
npm run test:e2e         # Playwright
```

## 2. أين تعيش الاختبارات؟
| النوع | الموقع | العدد المرجعي (من بلوك docs-metrics) |
|---|---|---|
| Go | `*_test.go` في `internal/` و`pkg/` | 117 ملفاً |
| Vitest | `frontend/src/**/*.test.ts(x)` | 36 ملفاً |
| E2E | `frontend/e2e/*.spec.ts` | 18 ملفاً |

> الأعداد أعلاه تُدار آلياً عبر `docs-metrics` في خريطة التوثيق — لا حدّثها يدوياً من الذاكرة.

## 3. بنية الاختبار
- **الخلفية:** اختبارات الوحدة بجوار الكود في نفس الحزمة؛ قاعدة بيانات اختبار معزولة عبر [`internal/testutil/testdb.go`](../../internal/testutil/testdb.go).
- **الواجهة:** Vitest + Testing Library؛ اختبارات المكونات في `frontend/src/**/__tests__/`.
- **E2E:** Playwright مع محاكي Wails في [`frontend/e2e/mock-wails.ts`](../../frontend/e2e/mock-wails.ts) — **أي دالة Wails جديدة يجب أن تُضاف إلى المحاكي** وإلا انكسرت الاختبارات.

## 4. ضوابط إلزامية
1. **لا تعطّل اختباراً لتمرير فحص.** أصلح السبب أو وثّق الاستثناء بقرار مالك.
2. **لا تضعف تأكيداً** ليمر. أضف اختبار انحدار للعيب الذي أصلحته.
3. **تأكيدات أنواع Vitest:** تجنب إسناد `vi.fn()` مباشرة للخصائص ذات التوقيع الصارم — استخدم دوال تغليف محددة الأنواع (تفادي `TS2348`/`TS2322`).
4. **القياس على Windows:** غلّف أنماط `go test -bench` بعلامات تنصيص (`-run="^$" -bench="."`) لتفادي تفسير PowerShell للرموز.
5. **حضور ملف في `frontend/dist`:** `main.go` يستخدم `//go:embed all:frontend/dist` — تأكد من وجود ملف واحد على الأقل (مثل `index.html`) قبل `go test`/`go build` على مستوى الموديول.

## 5. قبل الإنهاء
- [ ] الاختبارات ذات الصلة تعمل ونتيجتها مذكورة.
- [ ] `npm run typecheck` نظيف عند لمس الواجهة.
- [ ] Mock الـ E2E مُزامن عند إضافة/تغيير Handlers.
- [ ] أي رقم اختبارات جديد في التوثيق جاء من أمر مُشغَّل.
