---
name: beidar-security-hardening
description: الأمان والتشفير والامتثال في بيدر — bcrypt وTarpitting وPBKDF2/AES-GCM وترخيص LAN وتعقيم CSV وتعمية PII
---

# 🛡️ تحصين الأمان (Security Hardening)

المرجع الحاكم: [`AGENTS.md`](../../AGENTS.md) القسم 3.2 · الخلفية: [`docs/security.md`](../../docs/security.md)

## 1. كلمات المرور والرموز (Passwords & PINs)
- **bcrypt** للهش والمقارنة — النموذج: `VerifyAdminPin` في [`internal/service/admin_pin.go`](../../internal/service/admin_pin.go).
- **Tarpitting إلزامي:** تأخير أسّي عند الفشل (1s→2s→...→سقف 15s) بدل الحظر الكلي. التدفق الثاني في `staff_service.go` منفصل عمداً حتى لا يتصادم مع مسار المدير.
- عند النجاح يُصفَّر العدّاد فوراً.
- **ممنوع:** `==` على أي سر/توكن. استخدم `subtle.ConstantTimeCompare` (النموذج: [`internal/network/lan_clients.go`](../../internal/network/lan_clients.go)).

## 2. التشفير (Crypto)
- اشتقاق المفاتيح: `PBKDF2` (100k دورة + SHA-256) في [`pkg/crypto/aes.go`](../../pkg/crypto/aes.go).
- تشفير: AES-256-GCM.
- الأسرار السحابية (Gemini/Groq/Supabase) عبر [`pkg/secureconfig`](../../pkg/secureconfig) — مربوط بـ `MachineGuid`؛ نسخ الملف لجهاز آخر يفشل في فك التشفير.
- **ممنوع** أي مفتاح صريح في الكود أو الثنائي.

## 3. الترخيص الخلفي (Backend Authorization)
- كل دالة Wails أو مسار LAN يعدّل بيانات: `auth.RequirePermission(perm)` أو `auth.RequireAdmin()` **قبل** التنفيذ — [`pkg/auth/session.go`](../../pkg/auth/session.go).
- الثوابت في [`internal/core/domain/permissions.go`](../../internal/core/domain/permissions.go) — لا تكرار للصلاحيات.
- سياسة LAN مركزية fail-closed: `lanRoleAllows` في [`internal/network/lan_server.go`](../../internal/network/lan_server.go).

## 4. الجلسات (Sessions)
- مهلة خمول `DefaultIdleSessionTimeout = 12 * time.Hour` مع فحص `LastActivity`.
- الأجهزة المعلّقة لا تُستأنف تلقائياً.
- لا ترطيب غير آمن للجلسات من `localStorage`.
- مبدأ Fail-Closed عند فشل/مهلة التهيئة.

## 5. المخرجات والسجلات
- **CSV Formula Injection:** كل حقل حر يمر عبر تعقيم. النمط المعتمد (`sanitizeCSVField` في [`internal/service/backup_service.go`](../../internal/service/backup_service.go)):
  ```go
  if firstChar == '=' || firstChar == '+' || firstChar == '-' || firstChar == '@' {
      return "'" + val
  }
  ```
- لا تُسجَّل أجسام استجابات المصادقة الخام ولا التوكنات.
- **PII:** أرقام الهواتف/الهويات تُعمد في السجلات وواجهات العرض غير الإدارية.
- تقييد قراءة استجابات HTTP عبر `io.LimitReader` (10MB) في [`internal/network/lan_client.go`](../../internal/network/lan_client.go).

## 6. قائمة تدقيق سريعة
- [ ] ابحث عن `float64` في المال، و`==` على الأسرار، ومفاتيح حرفية.
- [ ] تحقق أن كل مسار كتابة محمي بصلاحية.
- [ ] تحقق من تعقيم أي تصدير/سجل جديد.
- [ ] شغّل: `go test ./pkg/auth/... ./pkg/crypto/... ./internal/network/... ./internal/service/...` مع `-race` للمسارات الحساسة.
