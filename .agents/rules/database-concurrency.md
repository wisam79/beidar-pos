---
trigger: glob
globs:
  - "internal/repository/**"
  - "internal/core/domain/**"
  - "internal/testutil/**"
  - "internal/integration/**"
  - "supabase/**"
description: "قواعد قاعدة البيانات والتزامن والمهاجرات: WAL، قفل الاتصال الواحد، القفل المتشائم، التحديثات الذرية، والمهاجرات المرقمة"
---

# قواعد قاعدة البيانات والتزامن (SQLite + GORM)

> المصدر الحاكم: `AGENTS.md` القسم 3.3 · الخلفية التقنية: [`docs/database_and_concurrency.md`](../../docs/database_and_concurrency.md) · المهارة: [`/skills/beidar-database-concurrency/SKILL.md`](../skills/beidar-database-concurrency/SKILL.md)

## 1. ثوابت SQLite (يُمنع كسرها)
- **وضع WAL مُفعّل:** `PRAGMA journal_mode=WAL;` في تهيئة الاتصال [`internal/repository/db.go`](../../internal/repository/db.go).
- **قفل الاتصال الواحد:** `sqlDB.SetMaxOpenConns(1)` — الضمان الوحيد لمنع `database is locked` عند تزامن عدة كاشيرات عبر LAN. **يُمنع منعاً باتاً رفع هذا القيد.**
- بيئة LAN تعني عدة أجهزة POS في نفس اللحظة: كل عملية قراءة-ثم-كتابة (Read-Modify-Write) على مخزون أو رصيد يجب أن تكون داخل معاملة مؤمنة.

## 2. المعاملات والأقفال (Transactions & Locking)
- عمليات البيع والإرجاع والأقساط وتحديثات الأرصدة تُغلف بـ `db.Transaction(func(tx *gorm.DB) error { ... })` لضمان التراجع عند الفشل.
- القفل المتشائم `FOR UPDATE` يعيش **حصراً** في طبقة الـ repository عبر دالة مخصصة مثل `GetForUpdate()` تستدعي:
  ```go
  r.db.Clauses(clause.Locking{Strength: "UPDATE"}).First(&entity, "id = ?", id)
  ```
  نماذج قائمة: `internal/repository/customer_repo.go` · `product_repo.go` · `sale_repo.go` · `supplier_repo.go` · `purchase_order_repo.go`.
- يُمنع في `service` أي استيراد لـ GORM أو `clause`.

## 3. التحديثات الذرية (Atomic Field Updates)
- يُمنع سحب القيمة ثم جمعها في الذاكرة ثم حفظها. استخدم تعابير GORM الذرية:
  ```go
  UpdateColumn("points", gorm.Expr("points + ?", delta))
  UpdateColumn("debt", gorm.Expr("CASE WHEN debt - ? < 0 THEN 0 ELSE debt - ? END", a.Cents(), a.Cents()))
  ```
- المرجع الحي: [`internal/repository/customer_repo.go`](../../internal/repository/customer_repo.go) — أرصدة العملاء ونقاطهم ومشترياتهم التراكمية.
- حماية الكائنات المالية من Mass-Assignment: عند تعديل عميل/مورد، اجلب الكائن الحالي من DB ودمج الحقول غير المالية المسموحة فقط (اسم، هاتف، ملاحظات). يُمنع `db.Save()` على كائن قادم من الواجهة.

## 4. المهاجرات المرقمة (Numbered Migrations)
- **يُمنع** تعديل المخطط عبر `AutoMigrate` عشوائي خارج المهاجرات.
- كل تغيير جديد يُضاف كمهاجرة مرقمة زمنياً في مصفوفة `registeredMigrations` داخل [`internal/repository/migration.go`](../../internal/repository/migration.go):
  ```go
  { Version: "YYYYMMDD_NNNN_وصف", Description: "...", Up: func(db *gorm.DB) error { ... } }
  ```
- المهاجرة تُنفَّذ داخل `db.Transaction` وتُسجَّل في جدول `schema_migrations`، ويليها فحص سلامة `PRAGMA foreign_key_check;`.
- **المهاجرة المطبَّقة لا تُعدَّل** — الإصلاح بهجرة جديدة.
- مهاجرات Supabase السحابية تتبع النمط `YYYYMMDDHHMMSS_<name>.sql` في [`supabase/migrations/`](../../supabase/migrations)، مع تأمين RLS لأي جدول جديد، ويُمنع تعديل ملف هجرة مطبَّق.

## 5. قوائم التحقق قبل إنهاء أي عمل على DB
- [ ] أي مسار تنافسي محمي بمعاملة + قفل؟
- [ ] أي تحديث تراكمي عبر `gorm.Expr` لا عبر الذاكرة؟
- [ ] أي تغيير مخطط ضمن مهاجرة مرقمة؟
- [ ] `go test ./internal/repository/...` ينجح، مع `-race` عند لمس التزامن.
