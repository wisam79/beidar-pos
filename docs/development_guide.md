# 🛠️ دليل التطوير والاختبار والنشر (Development, Testing & Deployment)

يوثق هذا المستند العمليات الأساسية اللازمة لإعداد بيئة التطوير، تشغيل الاختبارات الآلية، وبناء النسخ النهائية الجاهزة للإنتاج لنظام **Beidar**.

---

## 1. تهيئة بيئة العمل (Prerequisites & Dev Setup)

### المتطلبات الأساسية (Minimum Requirements)
| الأداة | الإصدار المطلوب | الإصدار المستحسن |
|--------|----------------|-----------------|
| **Go** | 1.21+ | 1.25 (الإصدار المستخدم في المشروع) |
| **Node.js** | 18+ | 22+ |
| **Wails CLI** | v2 | v2.12.0 |
| **npm** | 9+ | 11+ |

### تثبيت Wails CLI
```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

### تشغيل بيئة التطوير (Dev Mode)
```bash
# من المجلد الرئيسي للمشروع
wails dev
```
يقوم هذا الأمر بـ:
- تجميع كود Go الخلفي (Backend)
- تشغيل خادم Vite للواجهة الأمامية مع HMR (Hot Module Replacement)
- فتح نافذة التطبيق مع دعم التحديث الفوري والتلقائي للكود

> **ملاحظة**: في وضع `wails dev`، Wails يقوم أيضاً بتوليد ملفات TypeScript Bindings تلقائياً في `frontend/wailsjs/` بناءً على الدوال المصدرة في `internal/handlers/`.

---

## 2. أوامر الواجهة الأمامية (Frontend Commands)

جميع الأوامر التالية تُنفّذ من داخل مجلد `frontend/`:

| الأمر | الوصف |
|-------|-------|
| `npm run dev` | تشغيل خادم Vite للتطوير (قد لا يعمل منفرداً خارج `wails dev`) |
| `npm run build` | بناء الواجهة الأمامية للإنتاج |
| `npm run test` | تشغيل اختبارات Vitest |
| `npm run test:coverage` | تشغيل الاختبارات مع تقرير التغطية |
| `npm run test:ci` | تشغيل الاختبارات في بيئة CI |
| `npm run test:e2e` | تشغيل اختبارات Playwright E2E |
| `npm run test:e2e:ui` | تشغيل اختبارات E2E مع واجهة Playwright المرئية |
| `npm run lint` | فحص الكود بـ ESLint |
| `npm run lint:fix` | فحص وإصلاح الكود تلقائياً |
| `npm run typecheck` | فحص الأنواع (TypeScript) |
| `npm run format` | تنسيق الكود بـ Prettier |

---

## 3. اختبارات الوحدة في الخلفية (Go Unit Testing)

### تشغيل الاختبارات
```bash
# جميع الاختبارات
go test ./...

# مع تفعيل Race Detector (إلزامي للتأكد من سلامة التزامن)
go test -race ./...

# اختبارات خدمة محددة
go test ./internal/service/... -v

# اختبارات مع تغطية
go test ./internal/service/... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

### بنية الاختبارات
- تقع ملفات الاختبارات بجانب الملفات التي تختبرها (`*_test.go`)
- تستخدم قاعدة SQLite مؤقتة (In-Memory) عبر `repository.SetTestDB()`
- لا تستخدم Mock معقد — قاعدة بيانات حقيقية لتطابق الاستعلامات مع الشيما
- التغطية المستهدفة: 70%+ لطبقة `internal/service/`

### توزيع الاختبارات الحالية
```
internal/service/      — 11 ملف اختبار
internal/repository/   — 3 ملفات اختبار
internal/core/domain/  — 1 ملف اختبار (money_test.go)
frontend/__tests__/    — 9 ملفات اختبار (Vitest)
frontend/e2e/          — 3 ملفات (Playwright)
```

---

## 4. بناء النسخة النهائية (Production Build)

### بناء الملف التنفيذي
```bash
wails build -clean -platform windows/amd64
```
- المخرج: `build/bin/beidar-desktop.exe`
- يقوم Wails بضغط ملفات الواجهة الأمامية وتضمينها في الملف التنفيذي

### البناء مع تثبيت Windows
```bash
wails build -clean -platform windows/amd64 -nsis
```
- المخرج: `build/bin/beidar-desktop-amd64-installer.exe`
- يستخدم NSIS لإنشاء مثبت Windows

---

## 5. النظام (System Integration)

### مسارات بيانات التطبيق (Windows)
| المسار | المحتوى |
|--------|---------|
| `%AppData%/BeidarPOS_V3/beidar_v3.db` | قاعدة البيانات الرئيسية (SQLite) |
| `%AppData%/BeidarPOS_V3/window.json` | حالة النافذة (position, size, maximized) |
| `%AppData%/BeidarPOS_V3/webview_cache/` | كاش WebView2 |
| `%AppData%/BeidarPOS_V3/images/` | صور المنتجات المستضافة محلياً |

### خادم الصور
- يُشغّل تلقائياً عند بدء التطبيق (منفذ عشوائي)
- متاح في الواجهة الأمامية عبر `/local-image/{filename}`
- يخدم صور المنتجات المهاجرة من قاعدة البيانات (Base64) إلى نظام الملفات

### التحديث التلقائي (Silent Updates)
- يتم التحقق من وجود إصدار جديد عند بدء التطبيق تلقائياً (`pkg/updater/`)
- في حال وجود تحديث، يتم تحميله وتطبيقه عند الإغلاق التالي

---

## 6. متغيرات البيئة (Environment Variables)

| المتغير | الوصف | إجباري |
|---------|-------|--------|
| `SUPABASE_URL` | رابط مشروع Supabase | نعم، للتكامل السحابي |
| `SUPABASE_ANON_KEY` | مفتاح Supabase العام (anon key) | نعم، للتكامل السحابي |
| `GEMINI_API_KEY` | مفتاح Gemini API للذكاء الاصطناعي | لا (اختياري) |

> **ملاحظة أمنية**: المفاتيح الحساسة (Gemini, Google OAuth) تُخزّن أيضاً بشكل مشفر في قاعدة البيانات المحلية عبر `pkg/secureconfig` لضمان استمرارية العمل حتى بدون متغيرات البيئة.

---

## 7. استكشاف الأخطاء وإصلاحها (Troubleshooting)

| المشكلة | الحل |
|---------|------|
| `database is locked` | تأكد من أن التطبيق هو النسخة الوحيدة قيد التشغيل. افحص الباركة `BeidarPOS_SingleInstance_Mutex` |
| فشل تشغيل `wails dev` | تأكد من تثبيت Wails CLI: `go install github.com/wailsapp/wails/v2/cmd/wails@latest` |
| مشكلة الترجمة (CGO) | المشروع يستخدم `glebarez/sqlite` — لا حاجة لـ GCC/CGO |
| أخطاء في توليد Wails bindings | شغّل `wails dev` مرة أخرى لتوليد bindings جديدة |
| تعليق عند فتح النافذة | امسح كاش WebView2 من `%AppData%/BeidarPOS_V3/webview_cache/` |
