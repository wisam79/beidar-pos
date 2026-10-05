---
trigger: glob
globs:
  - "internal/service/admin_pin.go"
  - "internal/service/staff_service.go"
  - "internal/service/finance_service.go"
  - "internal/service/settings_service.go"
  - "internal/service/ai_service.go"
  - "internal/service/backup_service.go"
  - "pkg/auth/**"
  - "pkg/crypto/**"
  - "pkg/secureconfig/**"
  - "internal/integration/**"
  - "internal/network/**"
  - "internal/handlers/**"
description: "الأمان والتشفير والامتثال: bcrypt، PBKDF2/AES-GCM، المقارنة الزمنية الثابتة، الترخيص الخلفي، تعقيم CSV، Tarpitting، وتعمية PII"
---

# قواعد الأمان والامتثال (Security & Crypto)

> المصدر الحاكم: `AGENTS.md` القسم 3.2 · المهارة: [`/skills/beidar-security-hardening/SKILL.md`](../skills/beidar-security-hardening/SKILL.md)

## 1. كلمات المرور والرموز السرية
- **bcrypt دائماً** لتخزين ومقارنة كلمات المرور والرموز (مثال: `VerifyAdminPin` في [`internal/service/admin_pin.go`](../../internal/service/admin_pin.go)).
- **Tarpitting لا Lockout:** عند تكرار فشل التحقق، طبّق تأخيراً أسياً (1s→2s→4s→... بسقف 15s) مع إبقاء الخدمة متاحة للمحاولات الصحيحة في خيوط أخرى. يُمنع الحظر الكلي على مستوى النظام (خطر DoS).
- **مقارنة زمنية ثابتة:** رموز الجلسات وأسرار الخادم تُقارن بـ `subtle.ConstantTimeCompare` (انظر [`internal/network/lan_clients.go`](../../internal/network/lan_clients.go)) ويُمنع `==` على الأسرار.

## 2. التشفير (Crypto)
- **اشتقاق المفاتيح:** `PBKDF2` (100k دورة + SHA-256) في [`pkg/crypto/aes.go`](../../pkg/crypto/aes.go) — لا تجزئة مباشرة كـ SHA-256.
- **التخزين:** AES-256-GCM للملفات الحساسة (`lan_config.json`، `AppPreferences`، مفاتيح AI).
- **الربط بالعتاد:** المفاتيح تُشتق عبر `pkg/secureconfig` المرتبط بـ `MachineGuid` من سجل ويندوز، بحيث يفشل فك التشفير عند نسخ الملف لجهاز آخر.
- **يُمنع** تخزين أو حقن أي مفتاح API كنص صريح في الكود أو الثنائي. الأسرار السحابية تُقرأ من البيئة عند البناء وتشفَّر عند التشغيل.

## 3. الترخيص الخلفي (Backend Authorization)
- يُمنع الاعتماد على الواجهة لإخفاء الأزرار. كل مسار شبكي (LAN API) أو دالة Wails تعدّل بيانات يجب أن تحتوي فحص صلاحية صارم عبر `auth.RequirePermission` أو `auth.RequireAdmin` من [`pkg/auth/session.go`](../../pkg/auth/session.go) **قبل** التنفيذ.
- الجلسات الشبكية ليست أبدية: فحص الخمول عبر `LastActivity` مع مهلة `DefaultIdleSessionTimeout = 12 * time.Hour`، وتفعيل الطرد/التعليق عند تجاوزها.

## 4. تعقيم المخرجات (Output Sanitization)
- **CSV Formula Injection:** أي حقل نصي حر في تصدير Excel/CSV يمر عبر تعقيم يمنع تنفيذ الصيغ. النمط المعتمد في `sanitizeCSVField` داخل [`internal/service/backup_service.go`](../../internal/service/backup_service.go):
  إذا بدأ النص بـ `=`, `+`, `-`, أو `@` يُحقن قبله `'`.
- **JSON/الحقن:** لا تُمرر مدخلات المستخدم إلى استعلامات نصية؛ استخدم استعلامات GORM المعلمة.
- **تعمية PII:** أرقام هواتف/هويات العملاء تُعمد (Mask) في السجلات وواجهات العرض غير الإدارية.

## 5. الشبكة والسجلات
- السجلات تُسقط نصوص الاستجابات الخام للعمليات الحساسة (مصادقة، تدوير رموز) وتكتفي بنوع الخطأ والرمز — يُمنع طباعة توكنات أو أجسام استجابات كاملة.
- مسار تصدير قاعدة البيانات مقيد بالجهاز المضيف (`127.0.0.1`) فقط.
- كل شهادات TLS ذاتية التوقيع بصلاحية قصيرة (سنة) مع `KeyUsage` مطابق.

## 6. قوائم التحقق قبل إنهاء أي عمل أمني
- [ ] لا أسرار بنص صريح (ابحث عن القيم الحرفية والتوكنات).
- [ ] كل مسار تعديل بيانات محمي بفحص صلاحية خلفي.
- [ ] التحقق من كلمات المرور/الرموز عبر bcrypt + مقارنة زمنية ثابتة حيث يلزم.
- [ ] تصديرات CSV معقمة.
- [ ] `go test ./pkg/... ./internal/service/...` ينجح.
