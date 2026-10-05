# مسار عمل المهاجرات (Database Migration SOP)

> **الهدف:** تغيير مخطط آمن وقابل للتراجع في SQLite المحلية وSupabase السحابية.

---

## الخطوة 0: قبل الكتابة
- تأكد أن التغيير لا يمكن تحقيقه دون تعديل مخطط (قاعدة: أقل تغيير ممكن).
- أعلن المستندات المتأثرة وفق [`docs/DOCUMENTATION_MAP.md`](../../docs/DOCUMENTATION_MAP.md): `CHANGELOG.md` + `docs/database_and_concurrency.md`.

## الخطوة 1: مهاجرة محلية (SQLite)
أضف عنصراً في نهاية `registeredMigrations` داخل [`internal/repository/migration.go`](../../internal/repository/migration.go):

```go
{
    Version:     "20261005_0003_add_xyz_column",
    Description: "وصف موجز للتغيير",
    Up: func(db *gorm.DB) error {
        // DDL/نقل بيانات داخل نفس المعاملة
        return nil
    },
},
```
قواعد:
- رقم زمني تصاعدي فريد `YYYYMMDD_NNNN_وصف`.
- لا تعدّل مهاجرة مطبَّقة؛ الإصلاح بهجرة جديدة.
- لا `AutoMigrate` عشوائي خارج المهاجرات.
- أي نقل بيانات ضخم يُجزَّأ على دفعات.

## الخطوة 2: اختبار المهاجرة
```bash
go test ./internal/repository/... ./internal/integration/...
```
استخدم `internal/testutil/testdb.go` لبناء قاعدة معزولة وتشغيل `RunMigrations`. أضف اختباراً إن كان التغيير غير بديهي.

## الخطوة 3: مهاجرة سحابية (Supabase) عند الحاجة
- ملف جديد `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`.
- أي جدول جديد: تفعيل RLS + سياسات صريحة.
- دوال `SECURITY DEFINER`: `search_path` مضبوط + تحقق ملكية.
- لا تعدّل ملف هجرة مطبَّق.

## الخطوة 4: التحقق النهائي
```bash
go test ./internal/... ./pkg/...
go vet ./internal/... ./pkg/...
```
- فحص سلامة المفاتيح الأجنبية `PRAGMA foreign_key_check;` يعمل تلقائياً بعد كل مهاجرة محلية.
- اختبر ترقية قاعدة بيانات قديمة فعلية (نسخة احتياطية من إنتاج) إن أمكن.

## الخطوة 5: التوثيق والإغلاق
- حدّث `CHANGELOG.md` تحت `[Unreleased]` (تصنيف Added/Changed).
- حدّث `docs/database_and_concurrency.md` عند تغيير سلوك.
- شغّل `node scripts/docs-gate.mjs --strict-refs`.
