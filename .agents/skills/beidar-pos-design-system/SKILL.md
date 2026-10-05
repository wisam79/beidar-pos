---
name: beidar-pos-design-system
description: دليل واجهة نقاط البيع في بيدر — البنية اللمسية، المكونات القائمة، الأيقونات، تطابق التسميات، والأداء
---

# 🎨 دليل واجهة نقاط البيع (POS Design System)

المرجع الحاكم: [`AGENTS.md`](../../AGENTS.md) القسم 3.6 · القاعدة النطاقية: [`.agents/rules/pos-ui-ux.md`](../rules/pos-ui-ux.md)

## 1. مبادئ الشاشة
- **ثنائية الأقسام (Dual-Pane):** الفاتورة وشبكة المنتجات في تخطيط ثابت — لا تدمجهما.
- **لمسي أولاً (Touch-First):** أزرار كبيرة، مسافات مريحة، ولوحة أرقام داخلية (`Numpad.tsx`) لكل إدخال رقمي. لوحة المفاتيحPhysical اختيارية.
- **صفر احتكاك:** تعليق الفواتير، الدفع المقسم، تغيير الكمية — كلها بلمسة أو لمستين.
- **Zen Mode:** إتاحة إخفاء القوائم لتوسيع مساحة العمل وقت الذروة.

## 2. الالتقاط الصامت للباركود
- Hook مركزي: [`useUsbScannerDetection.ts`](../../frontend/src/hooks/useUsbScannerDetection.ts) — يستمع عالمياً ولا يعلّق عمل الكاشير.
- المستخدم في: `features/pos/views/SalesPage.tsx` و`features/products/products.tsx`.
- **ممنوع** فرض حقل إدخال نشط أو نافذة منبثقة للالتقاط.
- دعم القارئ اللاسلكي عبر الهاتف موجود (Mobile Scanner).

## 3. المكونات القائمة (لا تعِد اختراعها)
| الحاجة | المكوّن |
|---|---|
| تعديل كميات/أرقام | `frontend/src/features/pos/components/Numpad.tsx` |
| شبكة منتجات ضخمة | `VirtualProductGrid.tsx` + `ProductGridView/List` (TanStack Virtual) |
| تصميم ملصقات الباركود | `frontend/src/features/products/components/BarcodeDesigner.tsx` |
| شريط التنقل والتسميات | [`NativeTitleBar.tsx`](../../frontend/src/components/NativeTitleBar.tsx) (`NAV_ITEMS` مع فحص الصلاحية) |
| بطاقات الانطلاق | [`dashboard.tsx`](../../frontend/src/features/dashboard/dashboard.tsx) (بطاقات مربعة 3D) |

## 4. تطابق التسميات 1:1 (إلزامي)
ثلاثة مواضع يجب أن تتطابق نصاً:
1. عنوان بطاقة لوحة الانطلاق — `dashboard.tsx` (المبيعات · المنتجات · المخزون · الفواتير · الورديات · العملاء · المالية · التقارير · الإعدادات).
2. تبويب شريط التنقل — `NativeTitleBar.tsx`.
3. مفتاح الترجمة — [`ar.json`](../../frontend/src/i18n/locales/ar.json).

أي تسمية جديدة: أضفها في المواضع الثلاثة + `en.json` في نفس التغيير.

## 5. الأيقونات
- `@phosphor-icons/react` (Duotone) أو `lucide-react` — انظر `frontend/src/components/icons3d/`.
- **ممنوع الإيموجي والصور النقطية** كأيقونات واجهة نهائياً.

## 6. الأداء
- أي قائمة > 100 عنصر: Virtualization إلزامي.
- بحث محلي كبير: `useDeferredValue`.
- لا Base64 ضخم في قوائم؛ الصور عبر خادم الصور المحلي.
- تُفضَّل مكونات Radix القائمة على بناء بدائل.

## 7. الاختبار البصري والدخاني
```bash
cd frontend
npm run typecheck
npx vitest run --fileParallelism=false
npm run test:e2e
```
حدّث اختبارات المكوّن عند تغيير سلوك، واختبارات E2E عند تغيير مسار/تسمية.
