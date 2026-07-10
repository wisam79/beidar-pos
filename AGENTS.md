# Beidar - دليل المطورين والـ AI Agents

> **آخر تحديث**: 2026-07-10
> **إصدار المنتج**: 2.0.8 | **إصمارة العمارة**: Clean Architecture v3
> **الحالة**: 🟢 قيد التطوير المستمر (تحسين وتثبيت الميزات الحالية)

---

## 1. نظرة عامة على المشروع (Project Overview)

### 1.1 ما هو Beidar؟

**Beidar (بيدر)** هو نظام حاسوبي متكامل لسطح المكتب (Desktop Application) يعمل كنظام ERP/POS لخدمة نقاط البيع، إدارة المخزون، الشؤون المالية، وشؤون الموظفين. يعتمد التطبيق على **Go 1.25 + Wails v2.12** في الواجهة الخلفية و **React 18 + Vite 8** في الواجهة الأمامية، مع أكثر من **25** وحدة برمجية تشمل POS، إدارة المنتجات، المالية، التقارير، التكامل السحابي، وشبكة LAN المحلية.

### 1.2 أولويات التطوير (Development Priorities) ⚠️

> **القاعدة الحاكمة**: "الأولوية القصوى والدائمة للمشروع هي **تحسين وتطوير الميزات الحالية** ورفع كفاءتها ومتانتها الأمنية والتشغيلية، بدلاً من التسرع في إضافة ميزات جديدة. التركيز يكمن في تحسين جودة الأداء، وسد الثغرات، وزيادة متانة النظام الحالي."

> **توجيه حالي هام**: لا يُطلب إضافة أي ميزات أو إضافات جديدة في الوقت الحالي، بل ينصب كامل التركيز والجهد على تطوير وتحسين وتثبيت الميزات الحالية المتاحة في النظام لضمان أعلى مستويات الأداء والاستقرار.

### 1.3 التقنيات الأساسية (Tech Stack)

```text
┌──────────────────────────────────────────────────────────────────┐
│                       Beidar - Architecture                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  🖥️ Frontend (React 18 + Vite 8)                                  │
│     ├─ Zustand 5.0 (State Management)                              │
│     ├─ @tanstack/react-query 5.101 (Server State & Caching)       │
│     ├─ @tanstack/react-table 8.21 (Data Tables)                   │
│     ├─ @tanstack/react-virtual 3.14 (Virtual Scrolling)           │
│     ├─ Tailwind CSS 3.4 (Styling) + Radix UI 1.5 (Primitives)     │
│     ├─ Wails JS Bindings (Auto-generated TypeScript API)          │
│     ├─ React Router 7.17 (Navigation)                             │
│     ├─ Recharts 3.8 (Charts) + Zod 3.23 (Validation)              │
│     ├─ i18next 26.3 (Internationalization / العربية)              │
│     └─ jsbarcode + qrcode (Barcode & QR Generation)               │
│                │                                                  │
│          [ Wails IPC Bridge ]                                     │
│                ▼                                                  │
│  ⚙️ Backend (Go 1.25 + Wails v2.12)                                │
│     ├─ GORM 1.31 + SQLite (Local Database, glebarez pure Go)      │
│     ├─ Clean Architecture (Domain → Repo → Service → Handlers)    │
│     ├─ Supabase (Cloud Sync / Auth / License)                     │
│     ├─ Zoho Books Integration                                     │
│     ├─ Google Drive Backup (OAuth 2.0)                            │
│     ├─ Gemini AI Streaming API                                    │
│     ├─ LAN Server (net/http + UDP Discovery + gRPC)               │
│     ├─ gofpdf (PDF Generation) + go-qrcode                        │
│     └─ Secure Config (Encrypted API Keys)                         │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 1.4 الهيكل التنظيمي للمشروع (Monorepo)

```text
beidar/
├── build/                 # إعدادات Wails وأيقونات التطبيق
├── frontend/              # الواجهة الأمامية بالكامل (Vite)
│   ├── src/
│   │   ├── core/api/      # استدعاءات Wails مصنفة (10+ ملف)
│   │   ├── core/schemas/  # Zod validation schemas
│   │   ├── components/    # UI Components مشتركة (ds/, blocks/, charts)
│   │   ├── features/      # 10 وحدات (pos, finance, inventory...)
│   │   ├── hooks/         # 23 hook مشارك
│   │   ├── store/         # Zustand stores
│   │   ├── i18n/          # ترجمة عربية/إنجليزية
│   │   ├── routes/        # توجيه الصفحات (lazy-loaded)
│   │   └── App.tsx        # نقطة البداية
│   └── package.json
├── internal/              # الواجهة الخلفية (Go) — نواة التطبيق ⚠️
│   ├── core/domain/       # النماذج والواجهات النقية (13 ملف)
│   ├── repository/        # التخاطب مع Gorm/SQLite (17 ملف)
│   ├── service/           # منطق الأعمال + اختبارات (24 ملف: 12 خدمة + 11 اختبار)
│   ├── handlers/          # دوال Wails المصدرة (14 ملف)
│   ├── network/           # خادم LAN + عملاء + اكتشاف (5 ملفات)
│   └── integration/       # Supabase, Zoho, Google, License (6 ملفات)
├── pkg/                   # حزم مساعدة (12 حزمة)
│   ├── auth/              # التحقق من الصلاحيات
│   ├── secureconfig/      # تخزين مشفر للمفاتيح
│   ├── crypto/            # تشفير وفك تشفير
│   ├── print/             # طباعة حرارية
│   ├── updater/           # تحديث تلقائي
│   ├── imagestore/        # خادم صور المنتجات
│   ├── logger/            # تسجيل الأحداث
│   └── ...
├── app.go                 # إعداد Wails وتهيئة وحقن التبعيات (DI)
├── main.go                # نقطة الانطلاق (تضمين، إعدادات Wails)
├── single_instance_windows.go  # منع تشغيل نسختين
└── wails.json              # إعدادات مشروع Wails v2
```

---

## 2. المبدأ الأول: العمارة النظيفة والفصل المطلق (Strict Layering) ⚠️⚠️⚠️

> **القاعدة الذهبية**: "يُمنع منعاً باتاً استدعاء قاعدة البيانات من الـ `handlers` أو الـ `service` مباشرة. كل طبقة تتحدث فقط مع الطبقة التي أسفلها عبر واجهات (Interfaces)."

### 2.1 الطبقات المسموحة بالترتيب:
1. `handlers` (أو الواجهة الأمامية عبر Wails) تستدعي `service`.
2. `service` تقوم بالعمليات الحسابية ومنطق العمل وتستدعي `repository`.
3. `repository` تتعامل مع Gorm و SQLite وتقوم بإرجاع بيانات من نوع `domain` (Models).

### 2.2 جدول الممنوعات القاطعة في Go ❌

| ❌ لا تكتب | ✅ البديل الصحيح | السبب |
|-----------|-----------------|------|
| `db.Where(...)` داخل `handlers` أو `service` | `repo.FindCustomer(...)` | تلوث طبقة منطق العمل بكود قواعد البيانات |
| استدعاء Wails Context داخل `repository` | إرجاع خطأ إلى `handlers` وهو يتعامل مع Wails | فصل الاهتمامات (Separation of Concerns) |
| وضع منطق حساب الضرائب في React | كتابته في `service` (Go) واستدعاؤه عبر Wails | الأمان وتوحيد الحسابات وسهولة الاختبار (Unit Tests) |
| تكرار Gorm Structs في كل مكان | وضع النماذج الأساسية في `internal/core/domain` | تجنب الاعتماديات الدائرية (Circular Dependencies) |
| تجاهل الأخطاء `_ , err` | معالجة الخطأ وإعادته كـ `fmt.Errorf("...: %w", err)` | سهولة تتبع المشاكل (Traceability) |
| استخدام `float64` للمبالغ المالية | استخدام `domain.Amount` (int64 cents) | أخطاء التقريب في الفاصلة العائمة |
| تخزين مفاتيح API كنص صريح | استخدام `secureconfig` للتخزين المشفر | تسرب بيانات حساسة |

---

## 3. المبدأ الثاني: لا تبتكر العجلة (No Reinventing the Wheel)

### 3.1 مكتبات Go المعتمدة (Backend)
- ❌ لا تبتكر منشئ PDF ➔ ✅ استخدم `jung-kurt/gofpdf`.
- ❌ لا تبتكر نظام إنشاء Barcode/QR ➔ ✅ استخدم `skip2/go-qrcode` و `jsbarcode` في الواجهة.
- ❌ لا تبتكر خادم LAN من الصفر ➔ ✅ استخدم `net/http` المدمجة مع `io` و `sync`.
- ❌ لا تكتب استعلامات SQL معقدة يدوياً ➔ ✅ استخدم قدرات GORM المتقدمة.
- ❌ لا تبتكر نظام تشفير ➔ ✅ استخدم `golang.org/x/crypto`.
- ❌ لا تستخدم sqlite3 مع CGO ➔ ✅ استخدم `github.com/glebarez/sqlite` (نقي Go).

### 3.2 مكتبات React المعتمدة (Frontend)
- ❌ لا تستخدم `useState` مفرط للحالة العامة ➔ ✅ استخدم Zustand.
- ❌ لا تكتب دوال fetch يدوية ➔ ✅ استخدم `@tanstack/react-query`.
- ❌ لا تبتكر جداول من الصفر ➔ ✅ استخدم `@tanstack/react-table`.
- ❌ لا تبتكر CSS Classes مخصصة ➔ ✅ استخدم Tailwind CSS.
- ❌ لا تستخدم مكتبات واجهة ضخمة (MUI, AntD) ➔ ✅ استخدم Tailwind + Radix UI.
- ❌ لا تكتب دوال تحقق من الصحة يدوياً ➔ ✅ استخدم Zod schemas.

---

## 4. معايير الكود والأمان (Code & Security Standards)

### 4.1 إدارة الأخطاء (Error Handling)
- كل دالة Handler مُصدرة لـ Wails يجب أن تُرجع إما النتيجة أو `error`. الواجهة الأمامية ستستقبل الخطأ كـ `Promise.reject`.
- في React، استخدم `try/catch` دائماً مع إظهار Toast للمستخدم بحالة الفشل.
- استخدم `fmt.Errorf("context: %w", err)` لإضافة سياق للخطأ مع الحفاظ على الخطأ الأصلي.
- لا تترك `_ , err` بدون معالجة — قم بتسجيل الخطأ على الأقل.

```go
// ✅ صحيح
func (h *SalesHandler) ProcessSale(req CreateSaleReq) (*domain.Sale, error) {
    if req.Amount <= 0 {
        return nil, errors.New("يجب أن يكون المبلغ أكبر من صفر")
    }
    return h.saleService.ProcessSale(req)
}
```

### 4.2 Type Safety في TypeScript
- يُمنع تماماً استخدام `any` في Frontend.
- استفد من الـ Models التي يُولدها Wails تلقائياً داخل `frontend/wailsjs/go/models.ts`.
- استخدم Zod للتحقق من صحة المدخلات (forms, API responses).

### 4.3 الأمان (Security)
- كل الحسابات المالية تتم في Go عبر `domain.Amount` (int64 يمثل أصغر وحدة نقدية — فلس/سنت).
- مفاتيح API تُخزّن مشفرة في SQLite عبر `pkg/secureconfig` — لا تُحرق أبداً في الكود المصدري.
- الاتصال مع Supabase والخدمات الخارجية يكون عبر HTTPS مع Certificate Pinning.
- صلاحيات الوصول تُفحص في كل Handler عبر `auth.RequirePermission()`.

---

## 5. دليل إضافة ميزات جديدة (Feature Structure)

### في الخلفية (Go):
1. `internal/core/domain/<feature>.go` — تعريف Structs و Interfaces
2. `internal/repository/<feature>_repo.go` — أوامر GORM
3. `internal/service/<feature>_service.go` — منطق الأعمال
4. `internal/handlers/<feature>_handler.go` — ربط مع Wails

### في الواجهة الأمامية (React):
1. `src/features/<feature>/` — مجلد الميزة
2. `src/features/<feature>/components/` — مكونات الواجهة
3. `src/core/api/<feature>.ts` — استدعاءات Wails عبر React Query
4. دمج التوجيه في `src/routes/index.tsx`

### التسجيل في التطبيق:
- إضافة الـ Handler في `app.go` ضمن `initHandlers()`
- إضافة Binding في `main.go` ضمن `wails.Run()`

---

## 6. قواعد الاختبار (Testing)

### 6.1 اختبارات الوحدة الخلفية (Go Unit Tests)
- **مجلد `service`**: اختبارات شاملة إلزامية لكل الخدمات.
- **التغطية المستهدفة**: لا تقل عن **70%** لطبقة `internal/service/`.
- **SQLite للاختبار**: قاعدة SQLite مؤقتة في الذاكرة — تطابق الشيما الحقيقية، لا mock معقد.
- **Race Detector**: إجباري لتأكيد سلامة التزامن:
  ```bash
  go test -race ./...
  ```
- **اختبارات `internal/core/domain/`**: اختبارات `Amount`، `money.go`، التحقق من JSON marshaling.

### 6.2 اختبارات الواجهة الأمامية (Vitest & Component Testing)
- **لا تكرار**: استيراد الدوال الفعلية من `core/` — لا نسخ تعريفات داخل ملفات التست.
- **اختبار المكونات**: اختبار rendering للمكونات الحساسة في حالات Loading/Error/Success.
- **اختبار الـ Zustand stores**: التحقق من حالات الـ store بعد الإجراءات.

### 6.3 اختبارات E2E (Playwright)
- **سيناريوهات نشطة**: محاكاة دورة بيع كاملة (بحث ← إضافة إلى السلة ← دفع ← التحقق من المخزون والمالية).
- **التغطية**: تغطية مسارات المستخدم الحرجة (Login, POS, Finance, Inventory).

---

## 7. هجرات قواعد البيانات والتلقيم (Migrations & Seeding)

### 7.1 هجرة الشيما (Migrations)
- هجرة آلية عبر `db.AutoMigrate()` عند بدء التطبيق.
- للتغييرات الكبرى (حذف/تعديل حقول): هجرة برمجية يدوية تحافظ على بيانات المستخدمين.

### 7.2 تلقيم البيانات الأساسية (Seeding)
- **التفضيلات الافتراضية**: StoreName="متجر بيدر", Currency="IQD", Theme="dark", Language="ar"
- **المدير الافتراضي**: username=`admin`, PIN=`0000`, `MustChangePin=true` (يتم إنشاؤه فقط إذا كان جدول الموظفين فارغاً)

---

## 8. إدارة التزامن والمعاملات (Concurrency & Transactions)

### 8.1 بيئة LAN
- جميع العمليات الحساسة في بيئة LAN يجب أن تكون ضمن معاملات (Transactions).
- `SetMaxOpenConns(1)` يضمن ترتيب عمليات الكتابة.

### 8.2 DB Transactions
- عمليات البيع (`ProcessSale`)، الإرجاع (`ReturnSale`)، الأقساط، والحركات النقدية — كلها ضمن `db.Transaction(func(tx *gorm.DB) error { ... })`.
- Fail → Rollback تلقائي لضمان اتساق البيانات.

---

## 9. إدارة التكوين والبيانات المحلية (Configuration & AppData)

### 9.1 تخزين الإعدادات
- التفضيلات المخزنة في SQLite (`AppPreferences`) — وصول آمن عبر `SettingsService`.
- `%AppData%/BeidarPOS_V3/`: قاعدة البيانات (`beidar_v3.db`)، صور المنتجات، window state، webview cache.

### 9.2 تشفير البيانات الحساسة
- مفاتيح API (Gemini, Google OAuth) مخزنة مشفرة عبر `pkg/secureconfig`.
- كلمات المرور مهشّدة بـ bcrypt (golang.org/x/crypto/bcrypt).

---

## 10. نظام النقاش المتعدد (Multi-Agent System)

| الوكيل | الاختصار | المسؤولية |
|--------|----------|-----------|
| 📋 Product Manager | `@product-manager` | تخطيط الميزات، تحليل متطلبات واجهة المستخدم |
| 👨‍💻 Developer | `@developer` | هندسة الكود، البناء، التنفيذ |
| 🧪 QA Reviewer | `@qa-reviewer` | مراجعة الكود، اكتشاف الثغرات، اقتراح Unit Tests |

---

> **الخلاصة للـ Agent**: اقرأ هذا الملف جيداً. لا تقم بالقفز على المعمارية مهما كان السبب. احرص على فصل الاهتمامات دائماً، استخدم `domain.Amount` للمبالغ المالية، تأكد من اتساق البيانات عبر Transactions، ولا تنس الـ Race Detector قبل الـ commit. راجع [docs/](docs/) للحصول على تفاصيل أكثر.
