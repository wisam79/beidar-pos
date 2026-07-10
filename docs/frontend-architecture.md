# 🖥️ معمارية الواجهة الأمامية (Frontend Architecture)

يوثق هذا المستند بنية وهيكل الواجهة الأمامية لـ **Beidar**، المبنية بـ **React 18 + TypeScript + Vite 8**.

---

## 1. نظرة عامة (Overview)

```
frontend/src/
├── core/                 # الأساسيات المشتركة
│   ├── api/              # استدعاءات Wails API
│   ├── schemas/          # Zod validation schemas
│   ├── utils.ts          # دوال مساعدة
│   ├── types.ts          # أنواع مشتركة
│   ├── constants.ts      # ثوابت
│   ├── logger.ts         # تسجيل الأحداث
│   └── queryClient.ts    # إعداد TanStack Query
├── components/           # مكونات مشتركة
│   ├── ds/               # Design System (Button, Input, Card, Badge, Tooltip)
│   ├── blocks/           # كتل تخطيط (PageShell, StatsGrid, FilterBar, TabNav)
│   ├── charts/           # رسوم بيانية (Recharts)
│   └── providers/        # مزودات السياق
├── features/             # 10 وحدات وظيفية
│   ├── pos/              # نقطة البيع
│   ├── products/         # المنتجات
│   ├── inventory/        # المخزون
│   ├── dashboard/        # لوحة المعلومات
│   ├── finance/          # الخزينة
│   ├── customers/        # العملاء
│   ├── invoices/         # الفواتير
│   ├── reports/          # التقارير
│   ├── shifts/           # الورديات
│   └── settings/         # الإعدادات
├── hooks/                # 23 Hook مشارك
├── store/                # Zustand stores
│   ├── appStore.ts       # حالة التطبيق العامة
│   └── authStore.ts      # حالة المصادقة
├── i18n/                 # الترجمة (عربي/إنجليزي)
├── routes/               # التوجيه (lazy-loaded)
├── theme/                # رموز التصميم
└── App.tsx               # نقطة البداية
```

---

## 2. إدارة الحالة (State Management)

### 2.1 الحالة العامة — Zustand

```typescript
// store/appStore.ts
interface AppState {
    theme: 'light' | 'dark'
    sidebarOpen: boolean
    // ...
}
```

| الـ Store | الموقع | المسؤولية |
|-----------|--------|-----------|
| `appStore` | `store/appStore.ts` | المظهر، القائمة الجانبية، الحالة العامة |
| `authStore` | `store/authStore.ts` | المستخدم الحالي، رمز الدخول، الصلاحيات |
| `posStore` | `features/pos/store/` | سلة المشتريات، حالة البيع |

### 2.2 حالة الخادم — TanStack React Query

```typescript
// core/api/products.ts
export function useProducts(filters: ProductFilters) {
    return useQuery({
        queryKey: ['products', filters],
        queryFn: () => api.products.getAll(filters),
        staleTime: 30_000, // 30 ثانية
    })
}
```

| الميزة | التفاصيل |
|--------|----------|
| **Caching** | تخزين مؤقت للبيانات مع `staleTime` مخصص لكل نوع |
| **Invalidation** | إبطال الكاش تلقائياً بعد أي عملية كتابة |
| **Optimistic Updates** | تحديث متفائل للواجهة قبل تأكيد الخادم |
| **Pagination** | دعم التصفح مع `keepPreviousData` |

---

## 3. طبقة API (API Layer)

كل استدعاءات Wails مغلفة في دوال React Query في `core/api/`:

| الملف | الوحدة | مثال |
|-------|--------|------|
| `products.ts` | منتجات | `useProducts()`, `useCreateProduct()`, `useUpdateProduct()` |
| `sales.ts` | مبيعات | `useSales()`, `useCreateSale()`, `useReturnSale()` |
| `customers.ts` | عملاء | `useCustomers()`, `useCreateCustomer()`, `useCustomerDebt()` |
| `finance.ts` | خزينة | `useExpenses()`, `usePayments()`, `useShifts()` |
| `stats.ts` | إحصائيات | `useDashboardStats()`, `useMonthlyComparison()` |
| `admin.ts` | إدارة | `useLogin()`, `useStaff()`, `useSettings()` |
| `network.ts` | شبكة | `useLanStatus()`, `useCloudBackup()` |
| `desktop.ts` | سطح مكتب | `usePrinters()`, `useAutoUpdate()` |
| `misc.ts` | متنوع | `backup`, CSV import/export, `ImportProductsCSVNative` |

### نمط الاستخدام
```typescript
// ✅ صحيح: استخدام React Query
const { data, isLoading, error } = useProducts({ category: 'Snacks' })

// ✅ صحيح: Mutations مع invalidation
const mutation = useMutation({
    mutationFn: (sale: SaleData) => api.sales.process(sale),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['products'] })
        queryClient.invalidateQueries({ queryKey: ['sales'] })
    }
})
```

---

## 4. المكونات المشتركة (Shared Components)

### 4.1 Design System (`components/ds/`)
| المكون | الوصف |
|--------|-------|
| `Button` | زر مع دعم `variant` (primary, secondary, ghost, danger) |
| `Input` | حقل إدخال مع validation, label, error |
| `Card` | بطاقة مع header, body, footer |
| `Badge` | شارة حالة (success, warning, error, info) |
| `Tooltip` | تلميح منبثق |

### 4.2 كتل التخطيط (`components/blocks/`)
| المكون | الوصف |
|--------|-------|
| `PageShell` | هيكل الصفحة (title, actions, children) |
| `TabNav` | تنقل بالتبويب |
| `StatsGrid` | شبكة إحصائيات (2-4 أعمدة) |
| `FilterBar` | شريط فلترة مع بحث |
| `Pagination` | ترقيم الصفحات |
| `LoadingState` | حالة التحميل (skeleton/spinner) |
| `ActionButton` | زر إجراء مع أيقونة |
| `SectionCard` | بطاقة مع قسم مستقل |

---

## 5. الوحدات الوظيفية (Feature Modules)

كل وحدة وظيفية تتبع هيكلاً موحداً:

```
features/pos/
├── pos.tsx                    # الصفحة الرئيسية
├── views/                     # مشاهدات
│   └── SalesPage.tsx          # صفحة المبيعات
├── components/                # مكونات خاصة بالوحدة
│   ├── sales/
│   │   ├── CartPanel.tsx      # لوحة السلة
│   │   ├── SalesHeader.tsx    # رأس شاشة البيع
│   │   └── SalesModals.tsx    # النوافذ المنبثقة
│   ├── VirtualProductGrid.tsx # شبكة المنتجات الافتراضية
│   ├── Numpad.tsx             # لوحة الأرقام
│   ├── SplitPaymentModal.tsx  # تقسيم الدفع
│   └── CartItemRow.tsx        # صف في السلة
├── hooks/
│   └── useCart.ts            # hooks خاصة
└── store/
    └── index.ts              # Zustand store خاصة
```

### الوحدات الحالية (10)
| الوحدة | الملف الرئيسي | الوظيفة |
|--------|---------------|---------|
| **pos** | `pos.tsx` | نقطة البيع والسلة |
| **products** | `products.tsx` | إدارة المنتجات |
| **inventory** | `inventory.tsx` | المخزون وحركاته |
| **dashboard** | `dashboard.tsx` | لوحة المعلومات |
| **finance** | `finance.tsx` | الخزينة والمصروفات |
| **customers** | `customers.tsx` | العملاء والموردون |
| **invoices** | `invoices.tsx` | الفواتير |
| **reports** | `reports.tsx` | التقارير |
| **shifts** | `shifts.tsx` | الورديات |
| **settings** | `settings.tsx` | الإعدادات (13 مكوّن فرعي) |

---

## 6. التوجيه (Routing)

المسارات محمّلة بشكل كسول (Lazy-loaded) في `routes/index.tsx`:

| المسار | الوحدة | الصلاحية المطلوبة |
|--------|--------|-------------------|
| `/` | Dashboard | أي |
| `/sales` | POS | PermSales |
| `/products` | Products | PermProducts |
| `/inventory` | Inventory | PermInventory |
| `/invoices` | Invoices | PermInvoices |
| `/customers` | Customers | PermCustomers |
| `/finance` | Finance | PermFinance |
| `/reports` | Reports | PermReports |
| `/shifts` | Shifts | PermSales |
| `/settings` | Settings | PermSettings |

---

## 7. الترجمة والدعم العربي (i18n & RTL)

```typescript
// استخدام i18next
import { useTranslation } from 'react-i18next'

function MyComponent() {
    const { t } = useTranslation()
    return <h1>{t('pos.title')}</h1>
}
```

| الميزة | الوصف |
|--------|-------|
| **i18next** | إطار الترجمة بالكامل |
| **react-i18next** | hooks لـ React |
| **RTL** | دعم كامل للكتابة من اليمين لليسار |
| **الخطوط** | Cairo، Readex Pro، Lemonada للعربية |
| **الترجمة** | ملفات JSON منفصلة لكل لغة |

---

## 8. المواضيع والمظهر (Theming)

```typescript
// theme/index.ts
export const theme = {
    colors: {
        primary: '#306D29',
        background: { light: '#ffffff', dark: '#1a1a2e' },
        // ...
    }
}
```

| الميزة | الوصف |
|--------|-------|
| **Dark/Light** | وضع داكن ووضع فاتح |
| **Accent Colors** | ألوان مخصصة (أخضر افتراضي) |
| **Mica Backdrop** | تأثير Mica في Windows 11 |
| **Frameless** | نافذة بدون إطار مع TitleBar مخصص |
| **خطوط** | Geist، Cairo، Readex Pro، JetBrains Mono |
| **Glassmorphism** | تأثير الزجاج في بعض المكونات |

---

## 9. الـ Hooks المشتركة (23 Hook)

| الـ Hook | الوظيفة |
|----------|---------|
| `useAppInitialization` | تهيئة التطبيق (تحميل الإعدادات، التحقق من الجلسة) |
| `useAutoBackup` | نسخ احتياطي تلقائي للبيانات |
| `useAutoSelectInput` | تحديد تلقائي لمحتوى حقل الإدخال عند التركيز |
| `useConfirmModal` | نافذة تأكيد العمليات الحساسة |
| `useCustomers` | جلب العملاء وإدارة البحث والفلترة |
| `useDashboardStats` | إحصائيات لوحة التحكم |
| `useDiscounts` | إدارة الخصومات والعروض |
| `useFinance` | جلب بيانات الخزينة والمصروفات |
| `useGlobalKeyboardShortcuts` | اختصارات لوحة المفاتيح العامة |
| `useInventory` | جلب حركات المخزون |
| `useInvoices` | جلب الفواتير |
| `useKeyboardNavigation` | التنقل بلوحة المفاتيح في الجداول والقوائم |
| `useMonthlyComparison` | مقارنة شهرية للمبيعات والأرباح |
| `useOnlineStatus` | حالة الاتصال (متصل/غير متصل) |
| `usePageVisibility` | مراقبة رؤية الصفحة (visible/hidden) |
| `useParkedSales` | إدارة الفواتير المعلقة |
| `useProducts` | جلب المنتجات والبحث والفلترة |
| `useSales` | جلب المبيعات والبحث والتصفية |
| `useShifts` | إدارة الورديات (فتح/إغلاق/تاريخ) |
| `useStockMovements` | حركات المخزون التفصيلية |
| `useTheme` | إدارة المظهر (داكن/فاتح، ألوان) |
| `useUsbScannerDetection` | كشف وتفعيل ماسح الباركود USB/HID |
| `useWindowSize` | مراقبة حجم النافذة للتجاوب |

---

## 10. المكونات العامة (Global Components)

| المكون | الوظيفة |
|--------|---------|
| `LoginScreen` | شاشة تسجيل الدخول (اسم مستخدم/PIN) |
| `CloudLoginScreen` | تسجيل الدخول السحابي |
| `SplashScreen` | شاشة البداية |
| `LoadingScreen` | شاشة التحميل |
| `Sidebar` | القائمة الجانبية (مع أيقونات Phosphor) |
| `PinModal` | نافذة إدخال PIN |
| `ConfirmModal` | نافذة تأكيد |
| `ErrorMessage` | عرض الخطأ |
| `ErrorBoundary` | حماية ضد الأعطال |
| `CommandPalette` | لوحة الأوامر (Ctrl+K) |
| `SessionTimeoutWarning` | تحذير انتهاء الجلسة |
| `AppCloseDialog` | حوار إغلاق التطبيق |
| `NativeTitleBar` | شريط العنوان المخصص |
| `StaffManager` | إدارة الموظفين |
| `ShiftManager` | إدارة الورديات |
| `PaymentConfirmModal` | تأكيد الدفع |
| `PrintPortal` | بوابة الطباعة |
| `ReceiptTemplate` | قالب الإيصال |
| `BarcodeScannerOverlay` | overlay الماسح الضوئي |
| `LanSyncPanel` | لوحة تزامن LAN |
| `ImportExportModal` | استيراد/تصدير |
| `ChangePasswordModal` | تغيير كلمة المرور |
| `ChangePINModal` | تغيير PIN |
| `AIInsightsPanel` | لوحة تحليلات AI |
| `AIChatWindow` | نافذة محادثة AI |
| `InstallmentAlerts` | تنبيهات الأقساط |
| `UtilitiesDock` | شريط الأدوات |
| `QRCode` | رمز QR |
| `ShortcutsModal` | اختصارات لوحة المفاتيح |
| `LicenseScreen` | شاشة الترخيص |
| `ProductCard` | بطاقة المنتج |
