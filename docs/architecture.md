# 🏛️ معمارية التطبيق ودورة البيانات (Architecture & Data Flow)

يوثق هذا المستند الهيكل الهندسي العام لنظام **بيدر (Beidar)**، وكيفية تقسيم المسؤوليات بين الطبقات البرمجية لضمان الامتثال التام لقواعد **العمارة النظيفة (Clean Architecture)**.

---

## 1. نظرة عامة على الطبقات (Layer Overview)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React/TypeScript)                     │
│  ┌─────────┐ ┌──────────────┐ ┌──────────┐ ┌───────────────────┐   │
│  │ Routes  │ │ Features/    │ │ Core/API │ │ Wails Bindings    │   │
│  │ (React  │ │ (pos, finance│ │ (React   │ │ (auto-generated   │   │
│  │ Router) │ │  inventory)  │ │  Query)  │ │  from Go)         │   │
│  └─────────┘ └──────────────┘ └──────────┘ └───────────────────┘   │
│                                                  │                  │
│                          [ Wails IPC Bridge ]                       │
│                                                  ▼                  │
├─────────────────────────────────────────────────────────────────────┤
│                       BACKEND (Go)                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ Handlers   │→ │ Services   │→ │ Repositori │→ │ GORM + SQLite│  │
│  │ (14 files) │  │ (12 files) │  │ (17 files) │  │ (WAL Mode)   │  │
│  └────────────┘  └────────────┘  └────────────┘  └──────────────┘  │
│       │                │                │                           │
│       ▼                ▼                ▼                           │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │              Supporting Packages (pkg/)                   │       │
│  │  auth │ secureconfig │ crypto │ print │ updater │ logger  │       │
│  │  imagestore │ notification │ crashreporter │ autostart   │       │
│  └──────────────────────────────────────────────────────────┘       │
│       │                │                │                           │
│       ▼                ▼                ▼                           │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │         External Integrations (internal/integration/)     │       │
│  │  Supabase (Auth, Backup) │ Google Drive │ Zoho │ License  │       │
│  └──────────────────────────────────────────────────────────┘       │
│       │                                                            │
│       ▼                                                            │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │              LAN Network (internal/network/)               │       │
│  │  LAN Server │ LAN Client │ UDP Discovery │ Multi-Client   │       │
│  └──────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. هيكلية المجلدات وتقسيم الطبقات (Directory Structure & Layering)

```text
beidar/
├── internal/                   # النواة المعزولة للواجهة الخلفية (Go Backend)
│   ├── core/domain/            # النماذج النقية + الواجهات — 13 ملف (12 نموذج + 1 اختبار)
│   │   ├── models.go           # 20+ نموذج (Product, Sale, Shift...)
│   │   ├── interfaces.go       # 20+ واجهة (Repository, Service)
│   │   ├── money.go            # نوع Amount (int64) للحسابات المالية
│   │   ├── permissions.go      # ثوابت الصلاحيات الـ 12
│   │   └── errors.go           # أخطاء معيارية (ErrRecordNotFound, etc.)
│   ├── repository/             # طبقة البيانات — 17 ملف
│   │   ├── db.go               # InitDB, AutoMigrate, Seeding
│   │   ├── product_repo.go     # CRUD المنتجات والبحث
│   │   ├── sale_repo.go        # CRUD المبيعات والفواتير المعلقة
│   │   ├── customer_repo.go    # العملاء والديون ونقاط الولاء
│   │   ├── payment_repo.go     # المدفوعات وخطط التقسيط
│   │   ├── shift_repo.go       # الورديات والحركات النقدية
│   │   └── ...                 # expense, supplier, PO, staff, stats, backup, network, discount
│   ├── service/                # منطق الأعمال — 12 ملف + 1 compat + 11 اختبار
│   │   ├── sale_service.go     # معالجة البيع (DB Transaction)
│   │   ├── payment_service.go  # خطط التقسيط والمدفوعات
│   │   ├── finance_service.go  # المصروفات، الورديات، أوامر الشراء
│   │   ├── product_service.go  # إدارة المنتجات مع cache
│   │   ├── staff_service.go    # الموظفين، الصلاحيات، المصادقة
│   │   ├── ai_service.go       # تكامل Gemini API
│   │   └── ...                 # crm, stats, print, backup, settings, discount
│   ├── handlers/               # دوال Wails المصدرة — 14 ملف
│   │   ├── product_handler.go  # تصدير وإدارة المنتجات
│   │   ├── sale_handler.go     # معالجة عمليات البيع
│   │   ├── payment_handler.go  # المدفوعات والأقساط
│   │   ├── finance_handler.go  # الخزينة والمصروفات
│   │   ├── crm_handler.go      # العملاء والموردون
│   │   ├── staff_handler.go    # الموظفين والمصادقة
│   │   ├── stats_handler.go    # الإحصائيات والتقارير
│   │   ├── print_handler.go    # الطباعة
│   │   ├── backup_handler.go   # النسخ الاحتياطي
│   │   ├── settings_handler.go # الإعدادات
│   │   ├── lan_handler.go      # شبكة LAN
│   │   ├── cloud_handler.go    # التكامل السحابي
│   │   ├── discount_handler.go # الخصومات والعروض
│   │   └── ai_handler.go       # الذكاء الاصطناعي
│   ├── network/                # شبكة LAN — 5 ملفات
│   │   ├── lan_service.go      # تنسيق الخادم والعميل والاكتشاف
│   │   ├── lan_server.go       # خادم HTTP محلي مع API endpoints
│   │   ├── lan_client.go       # عميل يتصل بالخادم
│   │   ├── lan_clients.go      # مدير اتصالات متعددة
│   │   └── lan_discovery.go    # اكتشاف الخوادم عبر UDP broadcast
│   └── integration/            # التكامل الخارجي — 6 ملفات
│       ├── cloud_service.go    # واجهة CloudService
│       ├── supabase_auth.go    # مصادقة Supabase + نسخ احتياطي
│       ├── google_auth.go      # Google OAuth لـ Drive
│       ├── zoho.go             # تكامل Zoho Books
│       └── license.go          # الترخيص والتفعيل
├── frontend/                   # الواجهة الأمامية (React/TypeScript)
│   └── src/
│       ├── core/api/           # 10+ ملف API مجمع عبر `api.*`
│       ├── features/           # 10 وحدات: pos, products, inventory, finance, customers,
│       │                       #    invoices, reports, shifts, settings, dashboard
│       ├── components/         # مشتركة: ds/ (Button, Input...), blocks/ (PageShell...)
│   ├── hooks/              # 23 hook مشارك
│       ├── store/              # Zustand (appStore, authStore)
│       └── routes/             # Lazy-loaded routes
├── pkg/                        # 12 حزمة مساعدة
│   ├── auth/                   # التحقق من الصلاحيات
│   ├── secureconfig/           # تخزين مشفر للمفاتيح
│   ├── crypto/                 # تشفير وفك تشفير
│   ├── print/                  # طباعة حرارية
│   ├── updater/                # تحديث تلقائي
│   ├── imagestore/             # خادم صور المنتجات
│   └── ...                     # logger, i18n, errors, notification, crashreporter, autostart
├── app.go                      # DI + Startup (Handlers, Services, Repos)
├── main.go                     # Wails config + Bind + Window management
├── single_instance_windows.go  # منع تشغيل نسختين (Named Mutex)
└── single_instance_other.go    # منع تشغيل نسختين (Unix)
```

---

## 3. قواعد الفصل المطلق بين الطبقات (Strict Separation Rules)

| الطبقة | مسموح به | ممنوع ❌ |
|--------|----------|----------|
| **Domain** | تعريف Structs، Interfaces، Errors، أنواع مخصصة (Amount) | الاتصال بقاعدة البيانات، استدعاء Wails، استخدام أي مكتبة خارجية |
| **Repository** | GORM queries، تنفيذ CRUD، إرجاع domain models | منطق أعمال، حسابات مالية، التحقق من صلاحيات |
| **Service** | منطق الأعمال، حسابات (ضرائب، أقساط)، DB Transactions | GORM queries مباشرة (`db.Where`)، استدعاء Wails |
| **Handler** | استقبال الطلبات من Wails، تمريرها للـ Service، إرجاع النتائج | أي منطق حسابي، استعلامات قاعدة بيانات |
| **Frontend** | UI rendering، استدعاء API عبر Wails bindings، إدارة الحالة | حساب الضرائب/الأقساط، التعامل المباشر مع DB |

### قاعدة التبعية (Dependency Rule)
- التبعيات تتجه للداخل فقط: `Handlers → Service → Repository → Domain`
- الـ Domain لا يعرف شيئاً عن الـ Repository أو Service أو Handlers
- الـ Service يعرف الـ Repository من خلال واجهة (Interface) فقط

---

## 4. جسر التواصل (Wails IPC Bridge & Binding Logic)

يعمل إطار عمل **Wails v2** كجسر تواصل خفيف بين Go Backend و JavaScript Frontend:

```text
┌───────────────────────────────────────────────────────────────┐
│                      React Frontend (TS)                       │
│                                                                │
│  import { ProcessSale } from './wailsjs/go/handlers/SaleHandler' │
│  const result = await ProcessSale(saleData);                   │
│                      │                                         │
│          [ Wails IPC — JSON serialization ]                    │
│                      ▼                                         │
│                 Go Backend                                     │
│  sale_handler.go → sale_service.go → sale_repo.go → SQLite     │
└───────────────────────────────────────────────────────────────┘
```

- **Auto-binding**: Wails يحلل الدوال المصدرة (Exported Methods) في `internal/handlers/` ويولد TypeScript bindings في `frontend/wailsjs/go/handlers/`
- **Type Safety**: نماذج Go تُترجم تلقائياً إلى TypeScript interfaces في `frontend/wailsjs/go/models.ts`
- **All 14 handlers** مُسجلة في `wails.Run()` ضمن `Bind: []interface{}{...}`

---

## 5. دورة حياة تدفق البيانات (Data Flow Lifecycle)

### مثال: عملية بيع (Process Sale)

```
User Click → React POS → api.sales.process(data) → Wails IPC
  → SaleHandler.ProcessSale() → SaleService.ProcessSale()
    → [DB Transaction]
       → ProductRepo.UpdateStock()  (خصم المخزون)
       → ShiftRepo.AddCash()        (تحديث الوردية)
       → CustomerRepo.UpdateDebt()  (تحديث دين العميل إن وجد)
       → SaleRepo.Save()            (حفظ الفاتورة)
    ← [Commit / Rollback]
  ← Sale (result) → React UI Update
```

### مثال: نسخ احتياطي سحابي (Cloud Backup)

```
Settings → CloudHandler.BackupToSupabase()
  → CloudService.BackupToSupabase()
    → BackupService.ExportDatabase()     (تصدير JSON)
    → SupabaseAuth.ChunkedUpload()       (رفع مقسم)
    → SupabaseAuth.VerifyBackup()        (التحقق)
  ← BackupResult → UI Notification
```

---

## 6. حقن التبعيات وتهيئة التطبيق (Dependency Injection)

تتم التهيئة بالكامل في `app.go` عبر `NewApp()`:

```go
func NewApp() *App {
    db, _ := initDatabase()           // 1. SQLite + AutoMigrate + Seed
    repos := initRepositories(db)     // 2. 14 Repository instances
    services := initServices(repos)   // 3. 14 Service instances + SeedDefaultAdmin
    return initHandlers(services, repos) // 4. 14 Handler instances
}
```

### تسلسل بدء التشغيل (Startup Sequence):
1. `main.go`: Single instance lock ← Load window state ← `wails.Run()` ← `OnStartup`
2. `app.startup()`: Wails contexts ← Auto-update check ← Image server ← Image migration ← Supabase keepalive
3. `OnDomReady`: Show window
4. `OnBeforeClose`: Custom close dialog (emit event, prevent default)
5. `OnShutdown`: Save window position/size/maximized state
