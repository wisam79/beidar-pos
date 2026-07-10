<div align="center">
  <h1>🌾 بيدر (Beidar)</h1>
  <p><strong>نظام متكامل لإدارة نقاط البيع، المخزون، الشؤون المالية، والموارد البشرية (ERP/POS)</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Go-1.25-00ADD8?style=flat-square&logo=go" alt="Go">
    <img src="https://img.shields.io/badge/React-18.2-61DAFB?style=flat-square&logo=react" alt="React">
    <img src="https://img.shields.io/badge/Wails-v2.12-red?style=flat-square&logo=wails" alt="Wails">
    <img src="https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite" alt="SQLite">
    <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind">
    <img src="https://img.shields.io/badge/Architecture-Clean-brightgreen?style=flat-square" alt="Clean Architecture">
    <img src="https://img.shields.io/badge/Version-2.0.8-blue?style=flat-square" alt="Version">
  </p>
</div>

---

## 📌 عن المشروع (Overview)

**بيدر (Beidar)** هو تطبيق سطح مكتب (Desktop Application) مبني باستخدام إطار عمل **Wails v2**، يعمل كنظام ERP/POS متكامل لخدمة نقاط البيع، إدارة المخزون، الشؤون المالية، وشؤون الموظفين. صمم التطبيق للعمل بأعلى مستويات الأداء والاستقرار بالاعتماد على **Go 1.25** في الواجهة الخلفية و **React 18 + Vite** في الواجهة الأمامية، مع الالتزام التام بمعايير **العمارة النظيفة (Clean Architecture)** وقواعد الفصل المطلق بين الطبقات.

### المبادئ الأساسية
| المبدأ | التفاصيل |
|--------|----------|
| 🔒 **الأمان والدقة المالية** | العمليات المالية تتم في Go باستخدام نوع `Amount` (int64 cents/fils) لتجنب أخطاء floating-point |
| 🧱 **العمارة النظيفة** | `Handlers → Service → Repository → Gorm/SQLite` — فصل مطلق للمسؤوليات |
| 🔄 **التزامن (Transactions)** | جميع العمليات الحساسة (بيع، إرجاع، أقساط) ضمن Database Transactions |
| 🎯 **Type Safety** | واجهات TypeScript تُولَد تلقائياً من Go عبر Wails Bindings — لا `any` |
| 📡 **شبكة LAN** | خادم HTTP محلي يدعم تزامن الأجهزة المتعددة مع وضع Offline-First |

---

## ✨ الميزات الحالية (Current Features)

### 🛒 1. نقطة البيع والمبيعات (POS & Sales)
- **شاشة بيع سريعة**: واجهة حديثة تدعم اختصارات لوحة المفاتيح، قارئ الباركود (USB/HID)، وشبكة منتجات افتراضية
- **تعليق الفواتير (Parked Sales)**: حفظ الفاتورة مؤقتاً والعودة إليها لاحقاً
- **تقسيم الدفع (Split Payments)**: تقسيم الفاتورة على أكثر من طريقة دفع (نقدي، بطاقة، آجل، تقسيط)
- **التقسيط (Installment Plans)**: نظام متكامل لإنشاء خطط تقسيط، تتبع الدفعات المستحقة، وحساب الفوائد
- **الخصومات والعروض**: خصومات (نسبة مئوية، مبلغ ثابت، شراء X واحصل على Y) مع validation عبر كوبونات
- **الطباعة الحرارية**: دعم طابعات الإيصالات الحرارية، PDF للفواتير، باركود و QR

### 📦 2. إدارة المنتجات والمخزون (Products & Inventory)
- **إدارة متقدمة للمنتجات**: دعم الباركود، التصنيفات، أسعار الجملة، التكلفة، والحد الأدنى للمخزون
- **حركات المخزون (Stock Movements)**: سجل دقيق لكل حركات الإضافة والصرف مع تتبع المشرف
- **أوامر الشراء (Purchase Orders)**: دورة حياة كاملة (قيد الانتظار → مستلم جزئياً → مستلم كلياً → مدفوع)
- **تنبيهات المخزون المنخفض (Low Stock Alerts)**: إشعارات تلقائية عند وصول المنتج للحد الأدنى
- **البحث والفلترة**: بحث متقدم بالاسم، الباركود، التصنيف، والحالة

### 👥 3. إدارة العملاء والموردين (CRM & Suppliers)
- **حسابات العملاء**: رصيد عام، ديون أقساط، نقاط ولاء، وتنبيهات الأقساط المتأخرة
- **سجل المعاملات**: عرض كامل لجميع فواتير ومدفوعات العميل
- **إدارة الموردين**: أرصدة الموردين، تتبع المبالغ المدفوعة والمتبقية

### 💰 4. الخزينة والورديات (Treasury & Shifts)
- **نظام الورديات**: فتح/إغلاق وردية، رصيد افتتاحي وختامي، حساب العجز والزيادة آلياً
- **الحركات النقدية (Cash In/Out)**: مصروفات، سحبيات، إيداعات أثناء الوردية
- **المصروفات (Expenses)**: تبويب وتصنيف المصروفات التشغيلية
- **المركز المالي**: عرض الإيرادات، المصروفات، وصافي الربح

### 🔐 5. المستخدمين والصلاحيات (Staff & Roles)
- **نظام أدوار متكامل**: Admin، Manager، Cashier، Viewer — مع 12 صلاحية دقيقة
- **تسجيل دخول مزدوج**: اسم مستخدم + كلمة مرور، أو PIN سريع
- **إجبار تغيير PIN**: خاصية `MustChangePin` لأول تسجيل دخول
- **سجل الدخول (Login Attempts)**: تتبع جميع محاولات الدخول الناجحة والفاشلة

### ☁️ 6. التكامل السحابي والتزامن (Cloud & Sync)
- **Supabase**: مصادقة، نسخ احتياطي سحابي (مقسم إلى أجزاء للتخزين), Keep-Alive
- **Google Drive**: نسخ احتياطي عبر OAuth 2.0
- **Zoho Books**: مزامنة الفواتير والمخزون مع Zoho
- **LAN Server**: خادم HTTP محلي مع UDP discovery، Heartbeat، و Offline Queue
- **الذكاء الاصطناعي (Gemini API)**: تكامل مع Gemini لتوليد التقارير والتحليلات

### ⚙️ 7. الإعدادات والتخصيص (Settings)
- **المظهر**: وضع داكن/فاتح، ألوان مخصصة (Accent Colors)، أحجام خطوط، Mica backdrop (Win 11)
- **الطباعة**: طابعات حرارية، طابعات ملصقات، طباعة تلقائية بعد البيع
- **الترقيم التلقائي**: تنسيق مخصص لأرقام الفواتير
- **النسخ الاحتياطي**: تلقائي يدوي، CSV import/export، JSON backup/restore
- **التحديث التلقائي**: Silent updater يتحقق من الإصدار عند بدء التشغيل

### 📊 8. التقارير ولوحة المعلومات (Reports & Dashboard)
- **لوحة التحكم**: إحصائيات يومية/شهرية/سنوية، مقارنات، أفضل المنتجات والعملاء
- **تقارير المبيعات**: تفصيلية بالمشتريات، طرق الدفع، الضرائب
- **تقارير المخزون**: قيمة المخزون، المنتجات الأكثر مبيعاً، المنتجات الراكدة
- **تقارير العملاء**: الديون، الأقساط المتأخرة، نقاط الولاء

---

## 🛠 التقنيات المستخدمة (Tech Stack)

### 🖥️ الواجهة الأمامية (Frontend)
| التقنية | الاستخدام |
|---------|-----------|
| **React 18 + Vite 8** | إطار العمل الأساسي |
| **Zustand 5.0** | إدارة الحالة العامة (Global State) |
| **@tanstack/react-query 5.101** | إدارة حالة الخادم والتخزين المؤقت |
| **@tanstack/react-table 8.21** | جداول البيانات التفاعلية |
| **TanStack Virtual 3.14** | التمرير الافتراضي للأداء العالي |
| **Tailwind CSS 3.4** | التصميم والتنسيق |
| **Radix UI 1.5** | مكونات واجهة متاحة (Accessible) |
| **Recharts 3.8** | الرسوم البيانية |
| **React Router 7.17** | التوجيه والتنقل |
| **i18next 26.3** | التدويل والدعم العربي |
| **Zod 3.23** | التحقق من صحة البيانات (Validation) |
| **jsbarcode + qrcode** | إنشاء الباركود ورموز QR |

### ⚙️ الواجهة الخلفية (Backend)
| التقنية | الاستخدام |
|---------|-----------|
| **Go 1.25 + Wails v2.12** | إطار عمل سطح المكتب |
| **GORM 1.31** | ORM لقاعدة البيانات |
| **SQLite (glebarez)** | قاعدة البيانات المحلية (نقي Go، لا CGO) |
| **gofpdf** | إنشاء فواتير PDF |
| **go-qrcode** | إنشاء رموز QR |
| **x/crypto** | تشفير كلمات المرور |
| **x/oauth2** | توثيق Google OAuth |
| **net/http** | خادم LAN المحلي |

### 🏗️ العمارة (Architecture)
```
Frontend (React/TS)  ←→  [Wails IPC Bridge]  ←→  Handlers → Service → Repository → SQLite
```

---

## 📂 هيكلية المشروع (Project Structure)

```
beidar/
├── build/                   # إعدادات Wails، أيقونات، مثبت Windows
├── frontend/                # الواجهة الأمامية (React/Vite)
│   └── src/
│       ├── core/api/        # استدعاءات Wails API مصنفة
│       ├── features/        # 10 وحدات وظيفية (pos, products, finance, etc.)
│       ├── components/      # مكونات مشتركة (ds/, blocks/, charts, providers)
│       ├── store/           # Zustand stores عامة
│   ├── hooks/              # 23 hook مشارك
│       └── routes/          # التوجيه (lazy-loaded)
├── internal/                # نواة Go (معزولة تماماً)
│   ├── core/domain/         # نماذج نقية + واجهات (13 ملف)
│   ├── repository/          # طبقة البيانات (GORM/SQLite — 17 ملف)
│   ├── service/             # منطق الأعمال (12 خدمة + 11 اختبار)
│   ├── handlers/            # دوال Wails المصدرة (14 ملف)
│   ├── network/             # خادم LAN وعملاء (5 ملفات)
│   └── integration/         # Supabase، Google Drive، Zoho، License (6 ملفات)
├── pkg/                     # حزم مساعدة (12 حزمة)
├── supabase/                # إعدادات Supabase و SQL
├── app.go                   # تهيئة التطبيق وحقن التبعيات (DI)
├── main.go                  # نقطة الانطلاق (تضمين، إطار Wails)
└── wails.json               # إعدادات مشروع Wails
```

---

## 🚀 كيفية التشغيل (Getting Started)

### المتطلبات (Prerequisites)
- [Go](https://go.dev/doc/install) 1.21+ (مستحسن 1.25)
- [Node.js](https://nodejs.org/) 18+ (مستحسن 22+)
- [Wails CLI](https://wails.io/docs/gettingstarted/installation)
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```

### التشغيل للتطوير (Dev Mode)
```bash
git clone <repository-url>
cd beidar
cd frontend && npm install && cd ..
wails dev
```

### بناء نسخة إنتاج (Production Build)
```bash
wails build -clean -platform windows/amd64
# المخرج: build/bin/beidar-desktop.exe
# مثبت Windows: build/bin/beidar-desktop-amd64-installer.exe
```

### تشغيل الاختبارات (Testing)
```bash
# Go backend tests
go test ./...

# مع كاشف التزامن (Race Detector)
go test -race ./...

# Frontend tests
cd frontend
npm run test          # Vitest unit tests
npm run test:e2e      # Playwright E2E tests
```

---

## 📚 التوثيق الكامل (Full Documentation)

| المستند | الرابط |
|---------|--------|
| دليل المطورين والـ AI Agents | [AGENTS.md](AGENTS.md) |
| معمارية التطبيق ودورة البيانات | [docs/architecture.md](docs/architecture.md) |
| دليل التطوير والاختبار والنشر | [docs/development_guide.md](docs/development_guide.md) |
| إدارة قاعدة البيانات والتزامن | [docs/database_and_concurrency.md](docs/database_and_concurrency.md) |
| شبكة LAN والتزامن المحلي | [docs/lan_network.md](docs/lan_network.md) |
| دليل الاختبارات الشامل | [docs/testing.md](docs/testing.md) |
| الأمان وحماية البيانات | [docs/security.md](docs/security.md) |
| معمارية الواجهة الأمامية | [docs/frontend-architecture.md](docs/frontend-architecture.md) |
| مرجع API للواجهة الخلفية | [docs/api-reference.md](docs/api-reference.md) |
| نظام الإضافات (مقترح) | [docs/plugins.md](docs/plugins.md) |
| سجل التغييرات | [CHANGELOG.md](CHANGELOG.md) |

---

## 🗺️ الخطط المستقبلية (Roadmap)

- **🔌 نظام الإضافات (Plugins System)**: تحويل Beidar إلى منصة قابلة للتوسع عبر JS plugins (محرك goja) أو عمليات gRPC منفصلة مع نقاط حقن في الواجهة (راجع [plugins.md](docs/plugins.md))
- **📱 تطبيق جوال**: ربط مع تطبيق كاشير جوال (PWA) للتخزين والجرد
- **🔗 API عام**: REST API خارجي للتكامل مع متاجر إلكترونية ومنصات توصيل
- **📊 تقارير متقدمة**: تقارير قابلة للتخصيص مع تصدير متقدم
- **🌐 دعم متعدد اللغات**: توسيع الترجمة لدعم لغات إضافية
