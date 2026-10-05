# بيدر — دستور الوكلاء الأذكياء (Master Project Constitution)

> **آخر تحديث**: 2026-10-05 · **إصدار المنتج**: 2.1.0 · **العمارة**: Clean Architecture v3
> **الحالة**: 🟢 قيد التطوير المستمر (تحسين وتثبيت الميزات الحالية)
>
> هذا الملف هو **المدخل الحاكم** لكل جلسة عمل. التفاصيل التخصصية موزعة على:
> - **قواعد النطاقات** في `.agents/rules/` (تُفعّل حسب نطاق الملفات المستهدفة عبر `trigger`).
> - **المهارات المرجعية** في `.agents/skills/` (أمثلة وأدلة تفصيلية).
> - **الوكلاء الفرعيين** في `.agents/agents/` (مصفوفة المراجعة العشرية).
> - **مسارات العمل** في `.agents/workflows/` (SOPs تشغيلية).
> - **نظام التوثيق** في [`docs/DOCUMENTATION_MAP.md`](docs/DOCUMENTATION_MAP.md) (الجرد + المزامنة + البوابات + الأرقام المرجعية).

---

## 0. 🛑 بروتوكول منع الهلوسة (Zero-Hallucination Protocol)

1. **لا تخمن أبداً:** لا تفترض وجود دالة أو متغير أو ملف. ابحث (`grep`/البحث في المستودع) قبل أي تعديل.
2. **استخدم الموجود:** ابحث في الكود القائم قبل بناء أي بديل — انظر [`.agents/skills/beidar-architecture-navigator/SKILL.md`](.agents/skills/beidar-architecture-navigator/SKILL.md).
3. **التعديلات الجراحية فقط:** عدّل الجزء المطلوب حصراً. يُمنع حذف تعليقات أو دوال أو إعادة كتابة ملف كامل ما لم يُطلب صراحة.
4. **تحقق من الواردات:** Go يفشل في البناء عند `import` غير مستخدم — نظّف الواردات بعد كل تعديل.
5. **اقرأ قاعدة النطاق أولاً:** قبل تعديل أي ملف، اقرأ ملف القاعدة المطابق له في `.agents/rules/` (الجدول في القسم 3).
6. **شغّل الاختبارات وفحوص الصحة:**
   - **الخلفية (Go):** `go test ./internal/... ./pkg/...` (ومع `-race` للمسارات الحساسة).
   - **الواجهة:** `npm run typecheck` ثم `npx vitest run --fileParallelism=false` من مجلد `frontend`.
7. **طريقة البناء المعتمدة:** يُمنع منعاً باتاً تشغيل `wails build` أو `npm run build` مباشرة. البناء حصراً عبر `pwsh ./scripts/build.ps1`، ولا تبنِ إلا بطلب صريح من المستخدم.

---

## 1. نظرة عامة على المشروع (Project Overview)

**بيدر (Beidar)** نظام ERP/POS متكامل لسطح المكتب:
- **الواجهة الخلفية:** Go 1.25 + Wails v2.12 + GORM (SQLite via glebarez — Pure Go)
- **الواجهة الأمامية:** React 18 + Vite 8 + Tailwind CSS 3.4 + Radix UI + Zustand + React Query
- **الشبكة:** خادم HTTP مدمج + اكتشاف UDP على المنفذ 9765 (Server & Client في LAN)
- **الطباعة:** حرارية صامتة بالصور (winspool · GS v 0) + A4/PDF + ملصقات في الواجهة

> **القاعدة الحاكمة:** الأولوية القصوى هي **تحسين وتطوير الميزات الحالية** ورفع كفاءتها ومتانتها الأمنية. يُمنع حذف ميزة قائمة أو إعادة بناء من الصفر بلا طلب صريح، ويُمنع التوسع بهندسة زائدة (Over-engineering).

---

## 2. الثوابت المطلقة (Absolute Invariants) — لا تُكسر

| # | الثابت | التفصيل الإلزامي في |
|---|---|---|
| 1 | **العمارة النظيفة:** `handlers → service → repository → domain`؛ `gorm.DB` و`clause` في `repository` فقط | [`.agents/rules/backend-go-wails.md`](.agents/rules/backend-go-wails.md) |
| 2 | **المال:** `domain.Amount` (int64 cents) حصراً؛ يُمنع `float64` في أي حساب مالي | [`.agents/rules/financial-engineering.md`](.agents/rules/financial-engineering.md) |
| 3 | **SQLite:** `WAL` + `SetMaxOpenConns(1)` لا يُكسران؛ العمليات التنافسية داخل معاملات مع `FOR UPDATE` وتحديثات `gorm.Expr` الذرية | [`.agents/rules/database-concurrency.md`](.agents/rules/database-concurrency.md) |
| 4 | **المهاجرات:** مرقمة في `registeredMigrations` داخل [`internal/repository/migration.go`](internal/repository/migration.go) وتُنفذ داخل Transaction مع فحص `PRAGMA foreign_key_check;` | [`.agents/rules/database-concurrency.md`](.agents/rules/database-concurrency.md) |
| 5 | **الأمان:** bcrypt + Tarpitting (لا Lockout كلي) · `subtle.ConstantTimeCompare` للأسرار · PBKDF2 ثم AES-256-GCM · أسرار عبر `secureconfig` · صلاحيات خلفية إلزامية | [`.agents/rules/security-compliance.md`](.agents/rules/security-compliance.md) |
| 6 | **الشبكة:** UDP 9765 فقط · سياسة `lanRoleAllows` المغلقة · جلسات 12 ساعة خمول · تصدير قاعدة البيانات على `127.0.0.1` حصراً | [`.agents/rules/lan-networking.md`](.agents/rules/lan-networking.md) |
| 7 | **واجهة POS:** ثنائية الأقسام · لمسية بلوحة أرقام · التقاط باركود صامت · أيقونات متجهة فقط (لا إيموجي/صور نقطية) · تطابق مسميات 1:1 | [`.agents/rules/pos-ui-ux.md`](.agents/rules/pos-ui-ux.md) |
| 8 | **الطباعة:** مسار الصور الصامت (HTML → `html-to-image` → `PrintBitmapReceipt` → winspool `GS v 0`)؛ لا ESC/POS نصي عربي؛ الملصقات في الواجهة | [`.agents/rules/printing-hardware.md`](.agents/rules/printing-hardware.md) |
| 9 | **البناء:** حصراً `pwsh ./scripts/build.ps1` (حقن الأسرار عبر السكربت) | [`.agents/rules/quality-ci-release.md`](.agents/rules/quality-ci-release.md) |
| 10 | **بوابة التوثيق:** قبل أي كومت/دفع — `node scripts/docs-gate.mjs --strict-refs` + تحديث `CHANGELOG.md` تحت `[Unreleased]` | القسم 7 أدناه + [`docs/DOCUMENTATION_MAP.md`](docs/DOCUMENTATION_MAP.md) |
| 11 | **CSV/المخرجات:** تعقيم أي حقل حر ضد Formula Injection (`'` قبل `=`, `+`, `-`, `@`) وتعمية PII في السجلات | [`.agents/rules/security-compliance.md`](.agents/rules/security-compliance.md) |
| 12 | **عقود الخدمات:** إنشاء عميل بـ `c.ID == ""` · استلام أوامر الشراء من `ReceivedQty` · `DownPayment ≤ Total` · الخصم ≤ إجمالي الأصناف | [`.agents/rules/financial-engineering.md`](.agents/rules/financial-engineering.md) |

---

## 3. خريطة القواعد المعيارية (Rules Taxonomy & Triggers)

تُقرأ القاعدة قبل تعديل ملفات نطاقها:

| ملف القاعدة | نطاق التفعيل (Trigger) | الموضوع |
|---|---|---|
| [`.agents/rules/architecture-governance.md`](.agents/rules/architecture-governance.md) | `always_on` (دائم) | منع الهلوسة، الجراحية، المصدر الواحد، حظر الازدواجية، بوابة التوثيق |
| [`.agents/rules/backend-go-wails.md`](.agents/rules/backend-go-wails.md) | `internal/**`, `pkg/**`, `app.go`, `main.go` | الطبقات، معالجة الأخطاء، IPC، المرونة، الأداء |
| [`.agents/rules/database-concurrency.md`](.agents/rules/database-concurrency.md) | `internal/repository/**`, `internal/core/domain/**`, `supabase/**` | WAL، الأقفال، Atomic، المهاجرات |
| [`.agents/rules/financial-engineering.md`](.agents/rules/financial-engineering.md) | `internal/service/**`, `internal/core/domain/**`, `frontend/src/features/{pos,finance,invoices}/**` | Amount، الأقساط، الخصومات، CRM |
| [`.agents/rules/security-compliance.md`](.agents/rules/security-compliance.md) | مسارات المصادقة والتشفير والشبكة والتصدير | bcrypt، PBKDF2، الصلاحيات، CSV، PII |
| [`.agents/rules/lan-networking.md`](.agents/rules/lan-networking.md) | `internal/network/**`, `pkg/auth/**` | الاكتشاف، الأدوار، الجلسات، التحصين |
| [`.agents/rules/pos-ui-ux.md`](.agents/rules/pos-ui-ux.md) | `frontend/src/**` | اللمسية، الأيقونات، التسميات، الأداء |
| [`.agents/rules/printing-hardware.md`](.agents/rules/printing-hardware.md) | `pkg/print/**`, مسارات الطباعة | الطباعة الصامتة، الملصقات، البدائل |
| [`.agents/rules/quality-ci-release.md`](.agents/rules/quality-ci-release.md) | `.github/**`, `scripts/**`, الاختبارات | البوابات، CI، الإصدارات |

---

## 4. فهرس المهارات المرجعية (Skills Index)

| المهارة | المجال |
|---|---|
| [`.agents/skills/beidar-architecture-navigator/SKILL.md`](.agents/skills/beidar-architecture-navigator/SKILL.md) | خريطة الكود ومسار البيانات |
| [`.agents/skills/beidar-docs-sync-guard/SKILL.md`](.agents/skills/beidar-docs-sync-guard/SKILL.md) | بوابة التوثيق الإلزامية |
| [`.agents/skills/beidar-financial-integrity/SKILL.md`](.agents/skills/beidar-financial-integrity/SKILL.md) | الهندسة المالية والأقساط |
| [`.agents/skills/beidar-security-hardening/SKILL.md`](.agents/skills/beidar-security-hardening/SKILL.md) | الأمان والتشفير والامتثال |
| [`.agents/skills/beidar-database-concurrency/SKILL.md`](.agents/skills/beidar-database-concurrency/SKILL.md) | القاعدة والتزامن والمهاجرات |
| [`.agents/skills/beidar-pos-design-system/SKILL.md`](.agents/skills/beidar-pos-design-system/SKILL.md) | واجهة نقاط البيع والمكونات |
| [`.agents/skills/beidar-printing-pipeline/SKILL.md`](.agents/skills/beidar-printing-pipeline/SKILL.md) | خط أنابيب الطباعة |
| [`.agents/skills/beidar-testing-verification/SKILL.md`](.agents/skills/beidar-testing-verification/SKILL.md) | الاختبارات والتحقق |

## 5. الوكلاء الفرعيون (Sub-Agents Index)

عشرة وكلاء تخصصيين في `.agents/agents/` تُشغَّل في جولات التدقيق الشامل:

`core_domain_architect` · `database_concurrency_engineer` · `financial_logic_guardian` · `lan_network_warden` · `security_crypto_officer` · `hardware_printing_engineer` · `wails_ipc_bridge_keeper` · `frontend_state_performance_engineer` · `pos_ux_designer` · `qa_release_gatekeeper`

## 6. مسارات العمل (Workflows Index)

| المسار | متى يُستخدم |
|---|---|
| [`.agents/workflows/feature-blueprint.md`](.agents/workflows/feature-blueprint.md) | إضافة قدرة/ميزة جديدة بالتسلسل المعماري |
| [`.agents/workflows/database-migration.md`](.agents/workflows/database-migration.md) | أي تغيير مخطط في SQLite أو Supabase |
| [`.agents/workflows/security-audit.md`](.agents/workflows/security-audit.md) | جولة تدقيق أمني دورية |
| [`.agents/workflows/release-build.md`](.agents/workflows/release-build.md) | إصدار وبناء رسمي موثق |
| [`.agents/workflows/comprehensive-audit.md`](.agents/workflows/comprehensive-audit.md) | المراجعة الشاملة بالوكلاء العشرة (A-to-Z) |

---

## 7. بوابة التوثيق الإلزامية (Documentation Gate Protocol)

1. **قبل بدء أي عمل:** اقرأ [`docs/DOCUMENTATION_MAP.md`](docs/DOCUMENTATION_MAP.md) و[`docs/features-tracker.md`](docs/features-tracker.md)، وأعلن المستندات التي سيتغيرها العمل في أول رد.
2. **قبل الكومت:**
   ```bash
   node scripts/docs-gate.mjs --strict-refs
   ```
   ويجب تحديث `CHANGELOG.md` تحت `[Unreleased]`.
3. **قبل الدفع:** `node scripts/docs-gate.mjs --push` (مفروض آلياً عبر `frontend/.husky/pre-push` ووظيفة `docs-gate` في CI).
4. **لا رقم من الذاكرة:** كل رقم في أي مستند يأتي من أمر قابل للتشغيل مذكور بجانبه؛ الأرقام المرجعية في بلوك `docs-metrics` داخل الخريطة.
5. **التاريخ إلحاقي:** `CHANGELOG.md` وتقارير المراجعة وسجل الجلسات — تصحيحات مؤرخة فقط، بلا حذف أو إعادة كتابة.
6. **مفتاح الطوارئ:** `BEIDAR_DOCS_GATE=off` لحالة طارئة مبررة فقط (يُذكر السبب في رسالة الكومت).

---

## 8. لا تبتكر العجلة (No Reinventing the Wheel)

### الواجهة الخلفية
- **PDF:** `jung-kurt/gofpdf` · **QR:** `skip2/go-qrcode` · **خادم LAN:** [`internal/network/lan_server.go`](internal/network/lan_server.go) الموجود (لا خادم جديد) · **التشفير:** `golang.org/x/crypto` · **قاعدة البيانات:** `github.com/glebarez/sqlite`.

### الواجهة الأمامية
- **الحالة:** Zustand الموجود في [`frontend/src/store/appStore.ts`](frontend/src/store/appStore.ts) — لا Context معقدة.
- **الجلب:** `@tanstack/react-query` عبر [`frontend/src/core/api/`](frontend/src/core/api) — لا fetch خام.
- **الجداول:** `@tanstack/react-table` · **القوائم الضخمة:** `@tanstack/react-virtual`.
- **التحقق:** Zod schemas في [`frontend/src/core/schemas/`](frontend/src/core/schemas) — يُمنع `any`.
- **التصميم:** Tailwind + مكونات Radix القائمة في `frontend/src/components/` — لا مكتبات UI جديدة.

---

## 9. دليل إضافة ميزة جديدة

اتبع مسار [`.agents/workflows/feature-blueprint.md`](.agents/workflows/feature-blueprint.md) بالترتيب:
`domain` ← `repository` ← `service` ← `handlers` + `initHandlers` في [`app.go`](app.go) ← `frontend/src/core/api/` ← مزامنة `frontend/e2e/mock-wails.ts` ← `frontend/src/features/` ← الاختبارات ← التوثيق.

---

## 10. قواعد الاختبار (Testing)

- **Go:** `go test ./internal/... ./pkg/...` و`go vet ./internal/... ./pkg/...`، ومع `-race` للمسارات المالية/الأمنية/الشبكية.
- **الواجهة:** `npm run typecheck` ثم `npx vitest run --fileParallelism=false` (استقرار خيوط Windows).
- **E2E:** `npm run test:e2e` عند تغيير واجهة/مسار/Handler + مزامنة المحاكي.
- **التفاصيل والأوامر الكاملة:** [`.agents/skills/beidar-testing-verification/SKILL.md`](.agents/skills/beidar-testing-verification/SKILL.md).

### ضوابط بيئة الاختبار
- **تضمين الواجهة:** `main.go` يستخدم `//go:embed all:frontend/dist` — تأكد من وجود ملف واحد على الأقل في `frontend/dist` لنجاح `go test`/`go build` على مستوى الموديول.
- **PowerShell:** غلّف أنماط `go test -bench` بعلامات تنصيص (`-run="^$" -bench="."`).
- **Vitest Mocks:** تجنب إسناد `vi.fn()` مباشرة للخصائص ذات التوقيع الصارم — استخدم دوال تغليف محددة الأنواع (تفادي `TS2348`/`TS2322`).

---

## 11. بروتوكول المراجعة الشاملة (10-Agent A-to-Z Review Protocol)

عند طلب مراجعة/تدقيق شامل للتطبيق:

1. نفّذ المراحل الخمس في [`.agents/workflows/comprehensive-audit.md`](.agents/workflows/comprehensive-audit.md).
2. شغّل الوكلاء العشرة المعرّفين في `.agents/agents/` — جمع أدلة أولاً، ثم فرز، ثم إصلاح بدفعات.
3. كل ملاحظة تُسند إلى `ملف:سطر` أو نتيجة أمر مُشغَّل، وكل بند يُغلق يُثبَّت بتأكيد كودي في [`scripts/docs-gate.mjs`](scripts/docs-gate.mjs) حيثما أمكن.
4. أغلق الجولة بتحديث `CHANGELOG.md` + [`docs/features-tracker.md`](docs/features-tracker.md) + نجاح البوابات كاملة.

---

> **ملاحظة أخيرة ونهائية للوكيل (Final Directive):**
> تلمس كوداً إنتاجياً يعمل لدى عملاء فعليين. لا تقم بهندسة زائدة، لا تمسح ميزات حالية بلا طلب صريح، واقرأ الكود المحيط قبل أي تعديل. عند تعارض أي تعليمات مع هذا الدستور — الدستور هو الحاكم.
