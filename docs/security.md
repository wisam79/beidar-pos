# 🔒 دليل الأمان وحماية البيانات (Security Guide)

يوثق هذا المستند ممارسات الأمان المطبقة في نظام **Beidar** لحماية البيانات المالية الحساسة، مفاتيح API، وبيانات المستخدمين.

---

## 1. المبادئ الأساسية (Core Principles)

| المبدأ | التطبيق |
|--------|---------|
| **الحد الأدنى من الصلاحيات** | كل موظف يأخذ أقل صلاحية ممكنة لأداء مهامه |
| **الدفاع في العمق** | طبقات متعددة من الحماية (تشفير، مصادقة، RBAC) |
| **عدم افتراض الثقة** | التحقق من الصلاحية في كل طلب، حتى من الشبكة المحلية |
| **حماية المفاتيح** | لا تُحرق المفاتيح في الكود المصدري — تخزين مشفر |

---

## 2. التعامل مع المبالغ المالية (Financial Security)

### نوع `domain.Amount`
كل الحسابات المالية تتم باستخدام `domain.Amount` (int64 يمثل أصغر وحدة نقدية):

```go
type Amount struct {
    value int64 // القيمة بـ cents/fils
}
```

| الميزة | الشرح |
|--------|-------|
| **لا أخطاء تقريب** | int64 لا يعاني من مشاكل floating-point |
| **دقة كاملة** | التعامل مع أصغر وحدة نقدية (فلس، سنت) |
| **تحويل آمن** | دوال `NewAmount()`, `Float()`, `String()` مع التحقق من الحدود |
| **JSON Marshaling** | يتم تحويل القيمة تلقائياً من/إلى `float64` للواجهة الأمامية |

### الحظر القاطع ❌
```go
// ممنوع: استخدام float64 في الحسابات المالية
price := 10.00
tax := price * 0.15  // قد يعطي 1.4999999999

// صحيح: استخدام Amount
price := domain.NewAmount(1000) // 10.00 IQD
tax := price.Mul(15).Div(100)  // 1.50 IQD بالضبط
```

---

## 3. تخزين المفاتيح والبيانات الحساسة (Secret Management)

### `pkg/secureconfig` — تخزين مشفر
- جميع مفاتيح API تُخزّن بشكل مشفر في SQLite
- تستخدم AES-GCM (تشفير مع مصادقة) للتخزين
- مفتاح التشفير مشتق من Device ID + Salt

```go
// حفظ مفتاح مشفر
secureconfig.Set("gemini_api_key", "AI-xxx")

// قراءة المفتاح
key, err := secureconfig.Get("gemini_api_key")
```

### ما يُخزّن مشفراً:
| المفتاح | الوصف |
|---------|-------|
| `gemini_api_key` | مفتاح Google Gemini API |
| `google_oauth_client_id` | معرف عميل Google OAuth |
| `google_oauth_client_secret` | سر عميل Google OAuth |
| `supabase_service_key` | مفتاح Supabase service role |

### ما يُمنع ❌
- كتابة المفاتيح كـ `const` في الكود (تم إصلاحها من `google_auth.go`)
- تمرير المفاتيح في URL query string (تم إصلاحها في Gemini API)
- تخزين المفاتيح كنص صريح في قاعدة البيانات

---

## 4. مصادقة الموظفين (Staff Authentication)

### نظام PIN المزدوج
| الطريقة | الوصف |
|---------|-------|
| **Username + Password** | تسجيل دخول كامل مع التحقق من كلمة المرور |
| **PIN السريع** | رمز PIN رباعي للدخول السريع للكاشير |

### إجراءات الحماية
| الإجراء | التفاصيل |
|---------|----------|
| **Hashing** | كلمات المرور مهشّدة بـ bcrypt (golang.org/x/crypto) |
| **إجبار تغيير PIN** | `MustChangePin=true` للموظفين الجدد |
| **تسجيل المحاولات** | `LoginAttempt` يوثق كل محاولة دخول (ناجحة/فاشلة) مع IP والوقت |
| **الحد من المحاولات** | في الطريق — تحديد عدد المحاولات الفاشلة |

### مثال التحقق
```go
func (s *StaffService) AuthenticateByPIN(pin string) (*domain.Staff, error) {
    // 1. البحث عن الموظف بالـ PIN
    // 2. التحقق من حالة الحساب (نشط/معطل)
    // 3. تسجيل محاولة الدخول
    // 4. التحقق من MustChangePin
    // 5. إرجاع الموظف
}
```

---

## 5. نظام الصلاحيات (RBAC)

### الأدوار
| الدور | الوصف |
|-------|-------|
| **Admin** | جميع الصلاحيات (12) |
| **Manager** | 10 صلاحيات (ما عدا إدارة الموظفين وحذف المبيعات) |
| **Cashier** | 5 صلاحيات أساسية (بيع، منتجات، عملاء) |
| **Viewer** | 3 صلاحيات (عرض فقط) |

### الصلاحيات (12 Permission)
```go
PermSales        // بيع وإدارة المبيعات
PermProducts     // إدارة المنتجات
PermInventory    // إدارة المخزون
PermCustomers    // إدارة العملاء
PermInvoices     // إدارة الفواتير
PermReports      // عرض التقارير
PermFinance      // إدارة الخزينة
PermSettings     // تعديل الإعدادات
PermStaffManage  // إدارة الموظفين
PermDeleteSales  // حذف المبيعات
PermEditPrices   // تعديل الأسعار
PermExportData   // تصدير البيانات
```

### التحقق من الصلاحية في كل Handler
```go
func (h *SaleHandler) DeleteSale(id string) error {
    if err := auth.RequirePermission(auth.PermDeleteSales); err != nil {
        return err
    }
    return h.saleService.DeleteSale(id)
}
```

---

## 6. أمان الشبكة المحلية (LAN Security)

| الإجراء | الوصف |
|---------|-------|
| **Bearer Tokens** | جميع طلبات LAN تتطلب توثيقاً |
| **CORS** | يسمح فقط بعناوين IP مسجلة مسبقاً |
| **حظر الأجهزة** | `BlockedDevice` يمنع أجهزة معينة من الاتصال |
| **تسجيل الحركات** | كل طلب يُسجّل مع IP المصدر والوقت |
| **فصل الصلاحيات** | Cashier لا يمكنه الوصول للتقارير المالية |

---

## 7. أمان التكامل السحابي (Cloud Security)

| الخدمة | الإجراءات الأمنية |
|--------|------------------|
| **Supabase** | Certificate Pinning, HTTPS, Row Level Security (RLS) |
| **Google Drive** | OAuth 2.0 مع PKCE, مفاتيح مشفرة في secureconfig |
| **Zoho Books** | OAuth 2.0, مفاتيح API في secureconfig |
| **Gemini API** | HTTP header (وليس URL query), مفتاح مشفر |

### Supabase RLS (Row Level Security)
```sql
-- الجداول محمية بـ RLS:
- global_settings: فقط المسؤولون يمكنهم القراءة/الكتابة
- licenses: قراءة عامة، كتابة للمسؤولين فقط
- app_admins: صارمة جداً
- user_backups: المستخدم يرى نسخه الاحتياطية فقط
```

---

## 8. أمان قاعدة البيانات المحلية (Local DB Security)

| الإجراء | الوصف |
|---------|-------|
| **ملف قاعدة بيانات واحد** | `beidar_v3.db` في `%AppData%` — بعيد عن متناول المستخدم العادي |
| **تشفير المفاتيح** | مفاتيح API مشفرة داخل SQLite |
| **تعطيل SQL injections** | GORM يعقم الاستعلامات تلقائياً |
| **Foreign Keys** | PRAGMA foreign_keys=ON لسلامة البيانات |
| **Backup مشفر** | JSON backup لكن المفاتيح تبقى مشفرة |

---

## 9. الممنوعات الأمنية ❌

| الممنوع | السبب |
|---------|-------|
| استخدام `float64` للمبالغ المالية | أخطاء تقريبية تؤدي لاختلافات مالية |
| تخزين مفاتيح API كنص صريح | أي مخترق يمكنه سرقة المفاتيح |
| كتابة المفاتيح كـ `const` في الكود | تظهر في git history وتتسرب |
| استخدام `any` في TypeScript | فقدان Type Safety لكل الطبقات |
| استدعاء DB مباشرة من Handler | تجاوز طبقة Service والتحقق من الصلاحيات |
| تجاهل الأخطاء (`_, err`) | يصعب تتبع المشاكل وفقدان سياق الخطأ |
