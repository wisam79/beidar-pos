<div align="center">
  <h1>🌾 بيدر (Beidar)</h1>
  <p><strong>نظام متكامل لإدارة نقاط البيع، المخزون، الشؤون المالية، والموارد البشرية (ERP/POS)</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Go-1.21+-00ADD8?style=flat-square&logo=go" alt="Go">
    <img src="https://img.shields.io/badge/React-18.2-61DAFB?style=flat-square&logo=react" alt="React">
    <img src="https://img.shields.io/badge/Wails-v2-red?style=flat-square&logo=wails" alt="Wails">
    <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind">
    <img src="https://img.shields.io/badge/Architecture-Clean-brightgreen?style=flat-square" alt="Clean Architecture">
  </p>
</div>

---

## 📌 عن المشروع (Overview)
**بيدر (Beidar)** هو تطبيق سطح مكتب (Desktop Application) مبني باستخدام إطار عمل **Wails**. يوفر النظام بيئة عمل متكاملة وشاملة لخدمة نقاط البيع وإدارة المخزون والمالية وشؤون الموظفين.
تم تصميم التطبيق للعمل بأعلى مستويات الأداء والاستقرار بالاعتماد على **Go** في الواجهة الخلفية و **React/Vite** في الواجهة الأمامية، مع الالتزام التام بمعايير **العمارة النظيفة (Clean Architecture)**.

---

## ✨ الميزات الحالية في النظام (Current Features)

يعكس النظام حالياً مجموعة واسعة من الميزات الاحترافية المطبقة فعلياً في الكود:

### 🛒 1. نقطة البيع والمبيعات (POS & Sales)
- **شاشة بيع سريعة (Quick Sell)**: واجهة مستخدم حديثة تدعم الاختصارات وقارئ الباركود.
- **تعليق الفواتير (Parked Sales)**: إمكانية حفظ الفاتورة مؤقتاً لخدمة عميل آخر والرجوع إليها لاحقاً.
- **خيارات دفع متقدمة**: تقسيم الفاتورة على أكثر من طريقة دفع (Split Payments).
- **التقسيط (Installment Plans)**: نظام متكامل لإنشاء خطط تقسيط، تتبع الدفعات المستحقة، وحساب الدفعة الأولى.
- **الخصومات والعروض**: نظام خصومات مرن يشمل (نسبة مئوية، مبلغ ثابت، اشترِ X واحصل على Y).

### 📦 2. إدارة المخزون والمشتريات (Inventory & POs)
- **أوامر الشراء (Purchase Orders)**: دورة حياة كاملة لأمر الشراء (قيد الانتظار، مستلم جزئياً، مستلم كلياً).
- **حركات المخزون (Stock Movements)**: سجل دقيق لكل حركات الإضافة والصرف من المخزن.
- **إدارة متقدمة للمنتجات**: دعم التصنيفات الديناميكية (Custom Fields)، الحد الأدنى للمخزون (Low Stock Alerts)، وأسعار الجملة.

### 👥 3. إدارة العملاء والموردين (CRM & Suppliers)
- **حسابات العملاء**: متابعة الديون العامة وديون الأقساط بشكل منفصل، ونظام نقاط الولاء (Loyalty Points).
- **حسابات الموردين**: إدارة أرصدة الموردين وتتبع المبالغ المدفوعة والمتبقية.

### 💰 4. إدارة الورديات والنقدية (Shifts & Cash Management)
- **نظام الورديات**: إجبار فتح وردية للبيع (Require Shift)، تحديد الرصيد الافتتاحي والنهائي، وحساب العجز أو الزيادة آلياً.
- **الحركات النقدية (Cash In/Out)**: تسجيل المصروفات، السحبيات، أو الإيداعات النقدية خلال الوردية مع تتبع الموظف المسؤول.
- **إدارة المصروفات (Expenses)**: تبويب وتصنيف المصروفات التشغيلية.

### 🔐 5. المستخدمين والصلاحيات (Staff & Roles)
- **نظام أدوار متكامل**: صلاحيات مخصصة (مدير النظام Admin، مدير Manager، كاشير Cashier، مشاهد Viewer).
- **تسجيل دخول سريع**: إمكانية الدخول السريع عبر رمز PIN (Fast PIN).

### ⚙️ 6. الإعدادات والتخصيص (Settings)
- **التخصيص**: دعم المظهر الداكن/الفاتح، ألوان النظام (Accent Colors)، وأحجام الخطوط.
- **الطباعة**: دعم طابعات الإيصالات الحرارية (Receipts) وطابعات الملصقات (Labels) مع خيار الطباعة التلقائية (Auto Print).
- **التكامل**: جاهزية التزامن السحابي (Cloud Sync) عبر Supabase، ودعم ربط واجهات الذكاء الاصطناعي (Gemini API).

---

## 🛠 التقنيات المستخدمة (Tech Stack)

### 🖥️ الواجهة الأمامية (Frontend)
- **React + Vite**
- **Zustand** (State Management)
- **React Query** (Server State & Data Fetching)
- **Tailwind CSS** (Styling)

### ⚙️ الواجهة الخلفية (Backend)
- **Go + Wails v2**
- **SQLite + Gorm** (Local Database & ORM)
- **Clean Architecture** (Domain, Repository, Service, Handlers)

---

## 📂 هيكلية المشروع (Project Architecture)

يعتمد المشروع على نظام Monorepo مفصول بدقة لضمان استقرار وسهولة صيانة الأكواد:

```text
beidar/
├── build/                 # إعدادات Wails وأيقونات التطبيق
├── frontend/              # الواجهة الأمامية (React/Vite)
│   ├── src/features/      # وحدات الواجهة (pos, inventory, finance, shifts, etc.)
│   └── src/store/         # إدارة الحالة المشتركة
├── internal/              # الواجهة الخلفية (Go) - نواة التطبيق
│   ├── core/domain/       # النماذج مثل (Sale, Shift, PurchaseOrder, Installment)
│   ├── repository/        # التخاطب مع قاعدة البيانات (Gorm/SQLite)
│   ├── service/           # منطق الأعمال (Business Logic)
│   └── handlers/          # التخاطب مع Wails والواجهة الأمامية
├── pkg/                   # حزم مساعدة
└── main.go                # نقطة الانطلاق
```

---

## 🏗️ قواعد التطوير الأساسية (Development Guidelines)
1. **العمارة النظيفة**: يُمنع استدعاء قاعدة البيانات مباشرة من الـ `handlers` أو الـ `service`. التخاطب يتم عبر واجهات (Interfaces) من الأعلى للأسفل (`Handler -> Service -> Repository`).
2. **الأمان والدقة المالية**: تعتمد العمليات المالية على مخرجات محسوبة بدقة في الـ Backend باستخدام أنواع مخصصة (مثل `Amount`) لتجنب أخطاء الفاصلة العائمة (Floating Point Issues).
3. **تجنب Any في TypeScript**: الاعتماد على النماذج المُصدرة تلقائياً من Wails لضمان Type Safety كامل.
4. **التزامن (Transactions)**: جميع عمليات البيع المعقدة التي تشمل خصم مخزون وتسجيل مدفوعات يجب أن تتم داخل Database Transactions لمنع تعارض البيانات.

---

## 🚀 كيفية التثبيت والتشغيل (Getting Started)

### المتطلبات الأساسية (Prerequisites)
- [Go](https://go.dev/doc/install) (إصدار 1.21 أو أحدث)
- [Node.js](https://nodejs.org/) (إصدار 18 أو أحدث)
- [Wails CLI](https://wails.io/docs/gettingstarted/installation) 

### خطوات التشغيل
1. **استنساخ المستودع:**
   ```bash
   git clone <repository-url>
   cd beidar
   ```
2. **تثبيت الاعتماديات الخاصة بالواجهة الأمامية:**
   ```bash
   cd frontend
   npm install
   cd ..
   ```
3. **تشغيل بيئة التطوير (Dev Mode):**
   ```bash
   wails dev
   ```

4. **بناء النسخة النهائية (Build for Production):**
   ```bash
   wails build
   ```
   *سيتم توليد ملف قابل للتنفيذ (Executable) في مجلد `build/bin/`.*
