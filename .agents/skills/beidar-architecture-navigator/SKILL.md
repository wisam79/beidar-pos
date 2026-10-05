---
name: beidar-architecture-navigator
description: خريطة الكود ومسار البيانات في بيدر — أين يعيش كل شيء وكيف تتدفق الطلبات بين الطبقات
---

# 🧭 ملّاح معمارية بيدر (Architecture Navigator)

استخدم هذه المهارة قبل أي تعديل لتحديد الموقع الصحيح للكود. **لا تفترض — تحقق.**

## 1. الخطوط العريضة

```
[ React 18 / Vite / Tailwind ]  frontend/src
        │  Wails IPC (frontend/wailsjs) أو REST للشبكة المحلية
        ▼
[ Handlers ]  internal/handlers      ← تستقبل من Wails/الشبكة وتمرر للخدمات
        ▼  (واجهات domain)
[ Service ]   internal/service       ← منطق الأعمال والحسابات المالية
        ▼  (واجهات repository)
[ Repository ] internal/repository   ← الوحيد الذي يعرف GORM/SQLite
        ▼
[ SQLite WAL ] MaxOpenConns(1)
```

## 2. أماكن الكود (مُتحقق منها)
| المجال | المسار | ملاحظات |
|---|---|---|
| النماذج والواجهات النقية | `internal/core/domain/` | `money.go` · `models.go` · `interfaces.go` · `permissions.go` |
| حقن التبعيات والربط | [`app.go`](../../app.go) | `initHandlers` تُنشئ كل الـ Handlers |
| نقطة التشغيل والنافذة | [`main.go`](../../main.go) | Wails bootstrap + SingleInstance |
| طبقة GORM | `internal/repository/` | `db.go` (WAL + قفل الاتصال) · `migration.go` (المهاجرات) |
| منطق الأعمال | `internal/service/` | الملفات المالية: `payment_service.go` · `finance_service.go` |
| الشبكة المحلية | `internal/network/` | `lan_server.go` · `lan_discovery.go` · `lan_clients.go` |
| الطباعة | `pkg/print/` + `internal/service/print_service.go` | `direct.go` يتحدث مع winspool |
| التشفير والأمان | `pkg/crypto/` · `pkg/auth/` · `pkg/secureconfig/` | AES-GCM · الجلسات · ربط العتاد |
| أدوات الاختبار | `internal/testutil/` | قاعدة بيانات اختبار معزولة |

## 3. الواجهة الأمامية
| المجال | المسار |
|---|---|
| وحدات الوظائف | `frontend/src/features/` (pos · products · inventory · invoices · customers · finance · shifts · reports · settings · dashboard) |
| الوصول للخلفية | `frontend/src/core/api/` |
| المخططات والتحقق | `frontend/src/core/schemas/` |
| الحالة العالمية | [`frontend/src/store/appStore.ts`](../../frontend/src/store/appStore.ts) |
| Hooks (منها التقاط الباركود) | `frontend/src/hooks/` |
| الترجمة | `frontend/src/i18n/locales/` (`ar.json` · `en.json`) |
| مسجل الأخطاء | [`frontend/src/core/logger.ts`](../../frontend/src/core/logger.ts) |

## 4. مسار إضافة قدرة جديدة (7 خطوات)
1. النماذج والواجهات في `internal/core/domain/`.
2. تنفيذ الـ repository عبر GORM.
3. منطق الأعمال في `internal/service/` مع المعاملات والقيود.
4. دالة تصدير في `internal/handlers/` وإضافتها إلى `initHandlers` في `app.go`.
5. مستهلك React Query في `frontend/src/core/api/`.
6. مزامنة الـ Mock في [`frontend/e2e/mock-wails.ts`](../../frontend/e2e/mock-wails.ts).
7. واجهة المستخدم في `frontend/src/features/<feature>/` + التوثيق وفق الخريطة.

> المراجع الحاكمة: [`AGENTS.md`](../../AGENTS.md) · [`.agents/rules/backend-go-wails.md`](../rules/backend-go-wails.md)
