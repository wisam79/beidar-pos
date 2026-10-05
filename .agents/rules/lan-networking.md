---
trigger: glob
globs:
  - "internal/network/**"
  - "pkg/auth/**"
  - "internal/handlers/lan_handler.go"
  - "frontend/src/features/settings/**"
description: "قواعد الشبكة المحلية LAN: الاكتشاف UDP، صلاحيات الأدوار المغلقة، جلسات العملاء، وتحصين المسارات"
---

# قواعد الشبكة المحلية (LAN Multi-Terminal)

> الخلفية: [`docs/lan_network.md`](../../docs/lan_network.md) · المصدر الحاكم: `AGENTS.md` القسم 3.9

## 1. ثوابت الشبكة (مُتحقق منها في الكود)
- **الاكتشاف:** بث UDP حصراً على المنفذ `9765` مع بصمة البروتوكول `DiscoveryMagic = "BEIDAR_POS_V1"` — [`internal/network/lan_discovery.go`](../../internal/network/lan_discovery.go).
- **مكافحة إعادة البث (Replay):** كل رسالة اكتشاف تحمل `Timestamp`، وتُرفض الرسائل الأقدم من 30 ثانية.
- **حدود الحماية:** سقف الأجهزة المتصلة 30 جهازاً في اللحظة الواحدة، وسقف قائمة الخوادم المكتشفة 50 مع إزالة التكرار.
- **الخادم المدمج:** يُستخدم `internal/network/lan_server.go` (خادم `net/http` مدمج). يُمنع بناء خادم جديد أو استبدال النظام ببروتوكول آخر.

## 2. الترخيص المغلقة (Fail-Closed Authorization)
- كل مسار في خادم LAN يمر عبر سياسة `lanRoleAllows(role, method, path)` في [`internal/network/lan_server.go`](../../internal/network/lan_server.go) — سياسة واحدة fail-closed: ما لم يُسمح صراحة يُرفض.
- المسارات الحساسة (إدارة الأجهزة، قطع الاتصال، التصدير) تتطلب صلاحيات إدارية خلفية (`auth.RequireAdmin` / `auth.RequirePermission`) ولا تعتمد على إخفاء الواجهة.
- الترخيص والفحوص الخدمية تُحسم بهوية الطالب: جلسة سطح المكتب (`auth.CurrentActor` في [`pkg/auth/actor.go`](../../pkg/auth/actor.go)) أو جلسة الجهاز المُتحقق منها (`lanActor(lanClientFrom(r))` في [`internal/network/lan_server.go`](../../internal/network/lan_server.go)) — يُمنع قراءة الجلسة العالمية داخل أي مسار LAN ([`internal/service/sale_service.go`](../../internal/service/sale_service.go)).
- إسناد الفواتير من الشبكة يُتحقق خادمياً (وجود `StaffID` في سجل الموظفين) قبل أي كتابة؛ لا ثقة بهوية مرسلة من الجهاز.
- يُمنع توسيع صلاحيات دور كاشير دون مراجعة الوكيل الأمني (`.agents/agents/security_crypto_officer/agent.md`).

## 3. الجلسات والعملاء
- الجلسات الشبكية ليست أبدية: تُفحص `LastActivity` للخمول وتُعلَّق بعد `DefaultIdleSessionTimeout = 12 * time.Hour` ([`pkg/auth/session.go`](../../pkg/auth/session.go)).
- الأجهزة المعلّقة لا تستأنف الاتصال تلقائياً؛ القرار لمدير النظام.
- مقارنة رموز الجلسات بـ `subtle.ConstantTimeCompare` ([`internal/network/lan_clients.go`](../../internal/network/lan_clients.go)).

## 4. تحصين الإدخال/الإخراج
- قراءة أجسام استجابات HTTP عبر `io.LimitReader` بسقف 10MB لمنع استنزاف الذاكرة ([`internal/network/lan_client.go`](../../internal/network/lan_client.go)).
- التواريخ والأسماء تُطبع/تُقارن بعناية مع فروق الوقت؛ لا ثقة بأي حمولة قادمة من الشبكة دون تحقق.
- مسار تصدير قاعدة البيانات `/api/database/export` مقيد بالجهاز المضيف (`127.0.0.1`) حصراً.

## 5. الشهادات والتشفير
- شهادات TLS ذاتية التوقيع بصلاحية سنة واحدة مع `KeyUsage` مطابق — يُمنع إعادة الصلاحية الطويلة.
- تحديث حقول IP SAN تلقائياً عند تغيير عنوان DHCP.
- إعدادات الشبكة (`lan_config.json`) مشفرة بمفتاح مشتق من عتاد الجهاز — لا تُخزَّن رموز الجلسات كنص صريح.
