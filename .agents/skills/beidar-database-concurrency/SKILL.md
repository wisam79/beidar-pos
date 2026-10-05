---
name: beidar-database-concurrency
description: قاعدة البيانات والتزامن في بيدر — WAL وقفل الاتصال والقفل المتشائم والتحديثات الذرية والمهاجرات المرقمة
---

# 🗄️ قاعدة البيانات والتزامن (SQLite + GORM Playbook)

المراجع الحية: [`internal/repository/db.go`](../../internal/repository/db.go) · [`internal/repository/migration.go`](../../internal/repository/migration.go) · [`docs/database_and_concurrency.md`](../../docs/database_and_concurrency.md)

## 1. الإعداد المعتمد (لا يُكسر)
```go
sqlDB.SetMaxOpenConns(1)            // db.go — القفل الوحيد ضد database is locked
_, _ = sqlDB.Exec("PRAGMA journal_mode=WAL;")
```
- النظام يعمل في شبكة LAN وقد تصل عدة كاشيرات لحظياً. رفع `MaxOpenConns` يُعيد أخطاء القفل.
- أي إعداد اتصال جديد يجب أن يحافظ على WAL + الاتصال الواحد.

## 2. القفل المتشائم (Pessimistic Locking)
القاعدة: أي قراءة-ثم-كتابة تنافسية على مخزون أو رصيد تتم داخل `db.Transaction` مع قفل صف:

```go
// في طبقة الـ repository فقط
if err := r.db.Clauses(clause.Locking{Strength: "UPDATE"}).First(&customer, "id = ?", id).Error; err != nil {
    return err
}
```
نماذج قائمة: `customer_repo.go` · `product_repo.go` · `sale_repo.go` · `supplier_repo.go` · `purchase_order_repo.go`.
**يُمنع** استيراد GORM أو `clause` في `service`.

## 3. التحديثات الذرية (Atomic Updates)
```go
UpdateColumn("points", gorm.Expr("points + ?", delta))
UpdateColumn("debt", gorm.Expr("CASE WHEN debt - ? < 0 THEN 0 ELSE debt - ? END", a.Cents(), a.Cents()))
UpdateColumn("total_purchases", gorm.Expr("total_purchases + ?", amount.Cents()))
```
- يُمنع القراءة في الذاكرة ثم الحفظ (`Lost Update`).
- القيم السالبة تُقيَّد بـ `CASE WHEN ... THEN 0` (لا أرصدة سالبة).

## 4. دورة حياة المهاجرة (Numbered Migration SOP)
1. أضف عنصراً جديداً في نهاية مصفوفة `registeredMigrations` في [`migration.go`](../../internal/repository/migration.go):
   ```go
   {
       Version:     "20261005_0003_short_description",
       Description: "وصف موجز",
       Up: func(db *gorm.DB) error { ... },
   }
   ```
2. لا تعدّل مهاجرة مطبَّقة سابقاً — أضف مهاجرة جديدة.
3. المهاجرة تعمل داخل Transaction تُسجَّل في `schema_migrations`، ويليها فحص `PRAGMA foreign_key_check;`.
4. أضف/حدّث اختباراً في `internal/repository/` (نمط `internal/testutil/testdb.go` لقاعدة معزولة).
5. وثّق في `CHANGELOG.md` + `docs/database_and_concurrency.md` عند تغيير المخطط.

> ملاحظة مرجعية: الاسم الفعلي للمصفوفة `registeredMigrations` (وليس `allMigrations` — تصحيح مؤرخ 2026-10-05).

## 5. مهاجرات Supabase (سحابي)
- النمط: `YYYYMMDDHHMMSS_<name>.sql` في [`supabase/migrations/`](../../supabase/migrations).
- أي جدول جديد: تفعيل RLS + سياسة deny-all أو سياسات صريحة.
- دوال `SECURITY DEFINER` تضبط `search_path` وتتحقق من الملكية.
- المهاجرة المطبَّقة لا تُعدَّل.

## 6. قوائم الفحص
- [ ] `go test ./internal/repository/... ./internal/integration/...` ينجح.
- [ ] مع لمس التزامن: `go test -race ./internal/repository/...`.
- [ ] لا `clause`/GORM خارج `internal/repository/`.
