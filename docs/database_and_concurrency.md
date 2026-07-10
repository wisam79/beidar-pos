# 💾 إدارة قاعدة البيانات والتزامن (Database & Concurrency Management)

يوثق هذا المستند بنية التخزين المحلية لنظام **Beidar** المعتمدة على **SQLite**، وكيفية حماية البيانات ضد التعارض والتداخل أثناء العمل المتزامن في بيئات الشبكة المحلية (LAN).

---

## 1. موقع قاعدة البيانات (Database Location)

```go
configDir, _ := os.UserConfigDir()
appDir := filepath.Join(configDir, "BeidarPOS_V3")
dbPath := filepath.Join(appDir, "beidar_v3.db")
```

| النظام | المسار |
|--------|--------|
| Windows | `%AppData%/BeidarPOS_V3/beidar_v3.db` |
| Linux | `~/.config/BeidarPOS_V3/beidar_v3.db` |
| macOS | `~/Library/Application Support/BeidarPOS_V3/beidar_v3.db` |

---

## 2. تهيئة قاعدة البيانات (Database Initialization)

في `internal/repository/db.go`، يتم تهيئة قاعدة البيانات عند بدء التطبيق عبر `InitDB()`:

### إعدادات SQLite (PRAGMAs)
```go
PRAGMA journal_mode = WAL;        // وضع WAL للقراءة المتزامنة
PRAGMA busy_timeout = 5000;       // 5 ثوانٍ انتظار عند القفل
PRAGMA foreign_keys = ON;         // تفعيل قيود المفاتيح الخارجية
```

### إدارة الاتصالات
```go
sqlDB.SetMaxOpenConns(1)  // اتصال واحد لترتيب عمليات الكتابة
```

SQLite لا تدعم عمليات كتابة متوازية حقيقية. بوضع `SetMaxOpenConns(1)`، نضمن ترتيب جميع عمليات الكتابة في طابور (Queue) خلف بعضها دون تضارب.

### وضع WAL (Write-Ahead Logging)
- يسمح وضع WAL للقراء بالوصول إلى البيانات بشكل متزامن حتى أثناء قيام عملية كتابة
- يلغي بطء القراءة الناتج عن قفل SQLite التقليدي
- مثالي لبيئة LAN حيث الخادم يقرأ ويكتب بشكل متزامن

---

## 3. هجرة الشيما التلقائية (Auto-Migration)

عند بدء التطبيق، يقوم `db.AutoMigrate()` بمزامنة جداول قاعدة البيانات مع نماذج Go:

```go
db.AutoMigrate(
    &domain.Product{},          // المنتجات
    &domain.Sale{},             // المبيعات
    &domain.SaleItem{},         // عناصر الفاتورة
    &domain.Customer{},         // العملاء
    &domain.Supplier{},         // الموردين
    &domain.Expense{},          // المصروفات
    &domain.Payment{},          // المدفوعات
    &domain.Category{},         // التصنيفات
    &domain.StockMovement{},    // حركات المخزون
    &domain.AppPreferences{},   // إعدادات التطبيق
    &domain.ParkedSale{},       // الفواتير المعلقة
    &domain.LoginAttempt{},     // محاولات الدخول
    &domain.Staff{},            // الموظفين
    &domain.Shift{},            // الورديات
    &domain.CashMovement{},     // الحركات النقدية
    &domain.PurchaseOrder{},    // أوامر الشراء
    &domain.PurchaseOrderItem{},// عناصر أمر الشراء
    &domain.BlockedDevice{},    // الأجهزة المحظورة (LAN)
    &domain.Discount{},         // الخصومات والعروض
)
```

### قواعد التعديل الآمن للشيما (Safe Evolution)
| النوع | مسموح؟ |
|-------|--------|
| إضافة جدول جديد | ✅ نعم — تلقائي عبر AutoMigrate |
| إضافة حقل جديد | ✅ نعم — تلقائي عبر AutoMigrate |
| حذف جدول موجود | ❌ لا — يجب هجرة يدوية تحفظ البيانات |
| تغيير نوع حقل | ❌ لا — يجب إنشاء حقل جديد ونقل البيانات يدوياً |
| إضافة Index | ✅ نعم — عبر GORM annotations |

---

## 4. تلقيم البيانات الافتراضية (Data Seeding)

### التفضيلات الافتراضية (AppPreferences)
عند أول تشغيل للتطبيق (إذا كان جدول `app_preferences` فارغاً):
| الحقل | القيمة الافتراضية |
|-------|-------------------|
| `StoreName` | `"متجر بيدر"` |
| `Currency` | `"IQD"` |
| `Theme` | `"dark"` |
| `AccentColor` | `"#306D29"` |
| `Language` | `"ar"` |
| `LowStockTrigger` | `5` |

### المدير الافتراضي (Default Admin)
عندما يكون جدول `staff` فارغاً، يتم إنشاء مدير افتراضي تلقائياً:
- **username**: `admin`
- **PIN**: `0000`
- **Role**: `admin`
- **MustChangePin**: `true` (يُجبر على تغيير PIN عند أول تسجيل دخول)

---

## 5. معاملات قاعدة البيانات (DB Transactions)

### متى تستخدم Transaction؟
| العملية | شرح |
|---------|------|
| `ProcessSale` | خصم المخزون ← تحديث الوردية ← حفظ الفاتورة ← تحديث ديون العميل |
| `ReturnSale` | إعادة المخزون ← تحديث الوردية ← حفظ المرتجع |
| `PayInstallment` | تسجيل الدفعة ← تحديث رصيد العميل ← تحديث الوردية |
| `CashMovement` | تسجيل الحركة ← تحديث رصيد الوردية |

### آلية العمل
```go
err := s.db.Transaction(func(tx *gorm.DB) error {
    // 1. خصم المخزون (ProductRepo.UpdateStock)
    // 2. تحديث رصيد الوردية (ShiftRepo.AddCash)
    // 3. تحديث دين العميل (CustomerRepo.UpdateDebt)
    // 4. حفظ الفاتورة (SaleRepo.Save)
    return nil  // ← Commit
})
// في حال إرجاع أي خطأ ← Rollback تلقائي لكل العمليات
```

---

## 6. إدارة الجلسات والتعليق/الاستئناف (Session & Suspend/Resume)

يتعامل التطبيق مع حالة تعليق النظام (Sleep/Hibernate):

```go
Windows: &windows.Options{
    OnSuspend: func() {
        repository.CloseDB()  // إغلاق قاعدة البيانات بأمان
    },
    OnResume: func() {
        repository.InitDB()   // إعادة فتح قاعدة البيانات
        runtime.EventsEmit(ctx, "system-resumed")  // إعلام الواجهة
    },
}
```

---

## 7. قواعد البيانات في الاختبارات (Testing Database)

قاعدة البيانات في الاختبارات:
- تُنشأ في الذاكرة (In-Memory) عبر SQLite
- تطابق الشيما الحقيقية تماماً (AutoMigrate يتم تشغيله)
- لا تحتاج لـ Mock — قاعدة حقيقية تضمن تطابق الاستعلامات
- تُهدم تلقائياً بعد انتهاء الاختبار

```go
func setupTestDB(t *testing.T) *gorm.DB {
    db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
    db.AutoMigrate(&domain.Product{}, &domain.Sale{}, ...)
    repository.SetTestDB(db)
    return db
}
```
