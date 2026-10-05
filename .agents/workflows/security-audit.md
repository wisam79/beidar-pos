# مسار الجولة الأمنية الدورية (Security Audit SOP)

> **الهدف:** تدقيق دوري للمصادقة والتشفير والشبكة والمخرجات، بمخرجات قابلة للتتبع.

---

## 1. التحضير
- اقرأ [`docs/security.md`](../../docs/security.md) و[`.agents/skills/beidar-security-hardening/SKILL.md`](../skills/beidar-security-hardening/SKILL.md).
- حدّد نطاق الجولة: (مصادقة · تشفير · شبكة · تصدير · أسرار).

## 2. فحوص المصادقة والرموز
```bash
grep -rn "bcrypt\." internal/service/ | grep -v "_test"
grep -rn "ConstantTimeCompare" internal/ pkg/ | grep -v "_test"
grep -rn "adminPinFailures\|tarpit" internal/service/
```
- تأكد أن Tarpitting مطبق في مساري المدير والموظفين وبلا Lockout على مستوى النظام.
- تأكد أن العدّاد يُصفَّر عند النجاح.

## 3. فحوص التشفير والأسرار
```bash
grep -rn "sha256.New" pkg/crypto/
grep -rn "secureconfig" internal/ pkg/ | grep -v "_test"
grep -rn "API_KEY\|apiKey\|api_key" internal/ pkg/ --include=*.go | grep -v "_test"
```
- PBKDF2 قبل AES-GCM، والربط بـ `MachineGuid`.
- لا أسرار حرفية في الكود أو الـ ldflags.

## 4. فحوص الصلاحيات
```bash
grep -rn "RequirePermission\|RequireAdmin" internal/handlers/ internal/network/
```
- أي مسار تعديل بلا فحص ⇒ عيب حرج.
- راجع `lanRoleAllows` واختبر الأدوار في `internal/network/lan_authorization_test.go`.

## 5. فحوص المخرجات والجلسات
- تعقيم CSV في [`backup_service.go`](../../internal/service/backup_service.go).
- فحص الخمول 12 ساعة و`LastActivity`.
- لا أجسام استجابات خام في السجلات.

## 6. المخرجات والتوثيق
- تقرير مرقّم: لكل ملاحظة (الخطورة، الدليل `ملف:سطر`، سيناريو الاستغلال، الإصلاح).
- أصلح ما يمكن إصلاحه فوراً مع اختبار انحدار، ووثّق الباقي.
- حدّث `CHANGELOG.md` + `docs/security.md` + سجل جلسة في `docs/features-tracker.md`، ثم شغّل `node scripts/docs-gate.mjs --strict-refs`.
