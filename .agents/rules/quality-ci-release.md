---
trigger: glob
globs:
  - ".github/**"
  - "scripts/**"
  - "frontend/e2e/**"
  - "frontend/package.json"
  - "wails.json"
  - "CHANGELOG.md"
description: "الجودة والاختبارات والبناء والإصدارات: أوامر التحقق، البناء الحصري بالسكربت، بوابات CLI، ومزامنة الإصدار"
---

# قواعد الجودة وCI والإصدار (Quality / CI / Release)

> المصدر الحاكم: `AGENTS.md` القسم 6 · خريطة الجودة: [`docs/DOCUMENTATION_MAP.md`](../../docs/DOCUMENTATION_MAP.md)

## 1. البناء (Build)
- **يُمنع** تشغيل `wails build` أو `npm run build` مباشرة. البناء الرسمي حصراً:
  ```powershell
  pwsh ./scripts/build.ps1
  ```
  السكربت يحقن متغيرات البيئة والأسرار السحابية عبر `ldflags`. لا تبنِ إلا بطلب صريح من المالك.

## 2. أوامر التحقق المحلية
```bash
# الخلفية
go test ./internal/... ./pkg/...
go vet ./internal/... ./pkg/...
go test -race ./internal/core/domain ./pkg/auth ./pkg/crypto ./pkg/errors ./pkg/validator ./pkg/logger

# الواجهة
cd frontend
npm run typecheck
npm run lint
npx vitest run --fileParallelism=false

# E2E (عند تغيير واجهة/مسار/Handler شبكي)
npm run test:e2e
```
- يُمنع تعطيل اختبار أو إضعاف تأكيد لتمرير بوابة. أصلح السبب.
- عند إضافة أو تغيير دالة Wails: زامن Mock الاختبارات في [`frontend/e2e/mock-wails.ts`](../../frontend/e2e/mock-wails.ts).

## 3. CI السحابي (GitHub Actions)
الوظائف الحالية في [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml):
1. `go-backend` — Vet + اختبارات سريعة + Race للمسارات الحساسة.
2. `frontend` — `tsc` + Lint + Vitest + بناء إنتاجي.
3. `e2e` — Playwright Chromium.
4. `docs-gate` — بوابة التوثيق الإلزامية (`node scripts/docs-gate.mjs --push --ci`).

**قاعدة الأرقام:** أي عدد اختبارات مكتوب في README أو التوثيق مصدره بلوك `docs-metrics` في خريطة التوثيق وأوامره — لا أرقام من الذاكرة.

## 4. مزامنة الإصدار (Version Sync)
مصادر الإصدار الواجب تحديثها معاً عند الإصدار:
- `wails.json` → `info.productVersion` و`info.fileVersion`
- `frontend/package.json` → `version`
- `CHANGELOG.md` → ترقية `[Unreleased]` إلى قسم إصدار مؤرخ
- شارة الإصدار في `README.md`

الرقم المصدر هو `wails.json` (يقرأه `scripts/build.ps1`). أي إصدار لا يزامن هذه المواضع يُعد «إصداراً نصف مرفوع».

## 5. بوابة التوثيق (Docs Gate)
```bash
node scripts/docs-gate.mjs --strict-refs   # قبل الكومت (يفرضه frontend/.husky/pre-commit)
node scripts/docs-gate.mjs --push          # قبل الدفع (يفرضه frontend/.husky/pre-push)
```
- تفشل عند: انحراف الأرقام المرجعية، مستند غير مسجل في الجرد، كود بلا توثيق مرافق، مسار ميت في تعليمات `.agents/`، أو انحراف تأكيد كودي مُثبَّت.
- مفتاح الطوارئ: `BEIDAR_DOCS_GATE=off` — بتبرير في رسالة الكومت فقط.

## 6. Git
- لا `commit` ولا `push` بلا طلب صريح.
- رسائل الكومت بنمط Conventional Commits (`fix(scope): ...` / `feat(scope): ...` / `docs(agents): ...`).
