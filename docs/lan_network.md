# 🌐 شبكة الـ LAN المحلية والتزامن (LAN Networking & Sync)

يوثق هذا المستند بنية الشبكة المحلية (LAN) لنظام **Beidar**، وكيفية ربط أجهزة كاشير فرعية متعددة بجهاز رئيسي واحد يعمل كخادم محلي دون الحاجة لاتصال إنترنت.

---

## 1. معمارية الشبكة (Network Architecture)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Client Device  │     │  Client Device  │     │   Client Device │
│  (Cashier 1)    │     │  (Cashier 2)    │     │   (Cashier 3)   │
│  LAN Client     │     │  LAN Client     │     │   LAN Client    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │       ┌───────────────┴───────────────┐       │
         └──────►│       Server Device            │◄──────┘
                 │  (Router/Manager)              │
                 │  LAN Server + SQLite DB        │
                 │  Port 8989 (default)           │
                 └───────────────────────────────┘
```

### كيف تعمل؟
1. **جهاز الخادم (Server Mode)**: يُشغّل خادم HTTP محلي، يُدير قاعدة البيانات الرئيسية
2. **الأجهزة الفرعية (Client Mode)**: تتصل بالخادم عبر HTTP، وتُجري عمليات البيع
3. **اكتشاف تلقائي (UDP Discovery)**: ترسل الأجهزة طلب بث لاكتشاف الخادم تلقائياً على الشبكة

---

## 2. مكونات الشبكة (Network Components)

### `internal/network/lan_server.go` — خادم HTTP محلي
- يُشغّل على منفذ مخصص (8989 افتراضياً)
- يوفّر API endpoints: `/api/products`, `/api/sales`, `/api/shifts`
- يُدير قائمة العملاء المتصلين
- يتحقق من صحة الرموز (Bearer tokens)

### `internal/network/lan_client.go` — عميل متصل بالخادم
- Heartbeat كل 5 ثوانٍ للتحقق من الاتصال
- جلب تحديثات المنتجات والمخزون
- إرسال الفواتير المنجزة

### `internal/network/lan_clients.go` — مدير اتصالات متعددة
- يدير اتصالات متزامنة مع عملاء متعددين
- يراقب صحة الاتصالات ويفصل المنتهية

### `internal/network/lan_discovery.go` — اكتشاف الخادم
- UDP broadcast على الشبكة المحلية
- يستجيب الخادم بمعلوماته (IP, Port, Device Name)
- يعمل بدون تكوين يدوي

### `internal/network/lan_service.go` — المنسق الرئيسي
- يوفّر واجهة `LanService` لتنسيق الخادم والعميل والاكتشاف
- يُستخدم من `handlers/lan_handler.go` للتحكم من الواجهة

---

## 3. API Endpoints

| المسار | الطريقة | الوصف | المصادقة |
|--------|---------|-------|----------|
| `/api/products` | GET | جلب جميع المنتجات | Bearer Token |
| `/api/products/sync` | POST | مزامنة تحديثات المنتجات | Bearer Token |
| `/api/sales` | GET | جلب المبيعات (آخر 24 ساعة) | Bearer Token |
| `/api/sales/create` | POST | تسجيل عملية بيع جديدة | Bearer Token + RBAC |
| `/api/shifts` | GET | جلب معلومات الورديات | Bearer Token |
| `/api/shifts/open` | POST | فتح وردية | Bearer Token |
| `/api/shifts/close` | POST | إغلاق وردية | Bearer Token |
| `/api/heartbeat` | GET | التحقق من صحة الاتصال | لا |
| `/api/stats` | GET | إحصائيات أساسية | Bearer Token + Admin |

---

## 4. بروتوكول التزامن (Sync Protocol)

### دورة حياة المزامنة
```
Client                              Server
  │                                    │
  ├── Heartbeat (GET /api/heartbeat) ──► كل 5 ثوانٍ
  │◄── OK + timestamp                  │
  │                                    │
  ├── Sync Products ──────────────────► عند التغيير
  │◄── Updated product list            │
  │                                    │
  ├── Submit Sale ────────────────────► عند إتمام البيع
  │◄── Sale ID + updated stock         │
  │                                    │
  ├── Pull Updates ──────────────────► بعد كل عملية
  │◄── Latest data                     │
```

### أوضاع التشغيل
| الوضع | الوصف |
|-------|-------|
| **Online** | متصل بالخادم، يتم بث العمليات فوراً |
| **Offline** | انقطع الاتصال، يتم تخزين العمليات محلياً |
| **Reconnecting** | محاولة إعادة الاتصال (تلقائي) |
| **Reconciling** | تمت إعادة الاتصال، جاري مزامنة العمليات المعلقة |

---

## 5. العمل دون اتصال (Offline-First Strategy)

### 1. الكشف عن الانقطاع
- يتعذر Heartbeat لخمس محاولات متتالية (25 ثانية)
- يتحول العميل تلقائياً إلى وضع Offline

### 2. التخزين المحلي المؤقت
- تُحفظ الفواتير في SQLite المحلية للجهاز الفرعي
- تُوسم بعلامة `needsSync = true`
- يستمر البيع مع نسخة مخبأة من المنتجات

### 3. إعادة المزامنة والدمج (Reconciliation)
عند عودة الاتصال:
1. يرفع الجهاز الفرعي الفواتير المخزنة محلياً بالترتيب الزمني
2. يقوم الخادم بمعالجة كل فاتورة: خصم المخزون ← تسجيل المالية
3. في حال وجود تعارض (مخزون غير كافٍ)، يتم تسجيل العملية مع تنبيه إداري
4. يتم تحديث نسخة المنتجات المحلية للجهاز الفرعي

---

## 6. الأمان (Security)

### توثيق الطلبات (Authentication)
- جميع الطلبات (ما عدا heartbeat) تتطلب `Authorization: Bearer <token>`
- يتم التحقق من صلاحية الرمز في كل طلب

### التحكم بالصلاحيات (RBAC)
| الصلاحية | المسموحات |
|----------|-----------|
| Cashier | بيع، بحث منتجات، فتح/إغلاق ورديته |
| Manager | كل صلاحيات الكاشير + تقارير، إدارة مخزون |
| Admin | كل الصلاحيات + إدارة موظفين، إعدادات |

### قيود الشبكة (CORS)
- يسمح فقط للـ IPs المسجلة في `BlockedDevice`
- جميع الأجهزة الجديدة تحتاج موافقة المدير
- منع الطلبات من خارج الشبكة المحلية

---

## 7. إدارة الأجهزة المتصلة (Connected Clients)

### من `handlers/lan_handler.go`:
| الدالة | الوصف |
|--------|-------|
| `StartLanServer(port int)` | تشغيل الخادم المحلي |
| `StopLanServer()` | إيقاف الخادم |
| `GetLanServerStatus()` | حالة الخادم (عدد العملاء، المنفذ) |
| `GetLanClientStatus()` | حالة العميل (متصل/غير متصل، الخادم المتصل به) |
| `BlockLanDevice(deviceID string)` | حظر جهاز من الاتصال |
| `UnblockLanDevice(deviceID string)` | إلغاء حظر جهاز |
| `GetBlockedDevices()` | قائمة الأجهزة المحظورة |
