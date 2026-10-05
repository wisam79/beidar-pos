# مسار إضافة ميزة جديدة (Feature Blueprint SOP)

> **الهدف:** إضافة قدرة جديدة بالتسلسل المعماري الصارم من دون كسر الطبقات، مع توثيقها.

---

## الخطوة 0: التحضير
- حدد إن كانت الميزة موجودة جزئياً (ابحث قبل أن تبني).
- اقرأ قواعد النطاق في `.agents/rules/` ومهارات المجال.
- أعلن المستندات المتأثرة وفق مصفوفة `docs/DOCUMENTATION_MAP.md`.

## الخطوة 1: النماذج (domain)
`internal/core/domain/` — أضف الـ Struct والثوابت وتعريفات الدوال في الواجهة المناسبة. **لا استيراد مكتبات خارجية هنا.**

## الخطوة 2: التخزين (repository)
`internal/repository/` — نفّذ الواجهة بـ GORM. أي قفل/تجميع ذري هنا حصراً. لا منطق أعمال.
- تغيير مخطط ⇒ مهاجرة مرقمة وفق [`.agents/workflows/database-migration.md`](database-migration.md).

## الخطوة 3: منطق الأعمال (service)
`internal/service/` — القيود المحاسبية والتحقق والتسلسلات داخل `db.Transaction` حيث يلزم. أخطاء مُغلَّفة.

## الخطوة 4: الجسر (handlers + app.go)
`internal/handlers/` — دالة تصدير تستدعي الخدمة، ثم أضف الـ Handler في `initHandlers` داخل [`app.go`](../../app.go).

## الخطوة 5: الواجهة (API + Mock)
`frontend/src/core/api/` — مستهلك React Query. وزامن [`frontend/e2e/mock-wails.ts`](../../frontend/e2e/mock-wails.ts).

## الخطوة 6: واجهة المستخدم
`frontend/src/features/<feature>/` — التزام بقواعد [`pos-ui-ux`](../rules/pos-ui-ux.md) و[`beidar-pos-design-system`](../skills/beidar-pos-design-system/SKILL.md): أيقونات متجهة، تطابق تسميات، لمسية، Virtualization عند اللزوم.

## الخطوة 7: الاختبارات
- اختبار Go للخدمة/المستودع بأمثلة حقيقية (بما فيها حالات الحدود).
- اختبار Vitest للمكوّن عند تغيير سلوك واجهي.
- تحديث E2E عند تغيير مسار/تسمية ظاهرة.

## الخطوة 8: التوثيق والإغلاق
- `CHANGELOG.md` تحت `[Unreleased]`.
- `docs/features-tracker.md`: سجل جلسة + تحديث حالة الميزة.
- المستند المتخصص (architecture/testing/security/lan) عند اللزوم.
- البوابات:
  ```bash
  go test ./internal/... ./pkg/...
  cd frontend && npm run typecheck && npx vitest run --fileParallelism=false
  node scripts/docs-gate.mjs --strict-refs
  ```
