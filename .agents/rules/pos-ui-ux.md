---
trigger: glob
globs:
  - "frontend/src/**/*.{ts,tsx,css}"
  - "frontend/e2e/**"
  - "frontend/index.html"
description: "قواعد واجهة نقطة البيع وتجربة المستخدم: التخطيط اللمسي، الالتقاط الصامت، الأيقونات المتجهة، تطابق التسميات، والأداء"
---

# قواعد واجهة نقاط البيع وتجربة المستخدم (POS UI/UX)

> المصدر الحاكم: `AGENTS.md` القسم 3.6 · المهارة: [`/skills/beidar-pos-design-system/SKILL.md`](../skills/beidar-pos-design-system/SKILL.md)

## 1. ثوابت شاشة البيع (لا تُخالف)
- **تخطيط ثنائي الأقسام (Dual-Pane):** فصل دائم بين الفاتورة (Cart) وشبكة المنتجات (Product Grid) — انظر `frontend/src/features/pos/`.
- **سهولة اللمس:** يُمنع إجبار الكاشير على لوحة المفاتيح. استخدم لوحة الأرقام الداخلية [`Numpad.tsx`](../../frontend/src/features/pos/components/Numpad.tsx) لتعديل الكميات، واجعل الأزرار كبيرة بمسافات كافية (Touch Targets).
- **الالتقاط الصامت للباركود:** يُمنع اشتراط حقل بحث نشط. الالتقاط عبر [`useUsbScannerDetection.ts`](../../frontend/src/hooks/useUsbScannerDetection.ts) في الخلفية، مع دعم القارئ اللاسلكي عبر الهاتف.
- **وضع التركيز (Zen Mode):** الشاشات سريعة الإيقاع تدعم إخفاء القوائم الجانبية والعلوية.

## 2. الهوية البصرية
- **الأيقونات:** مكتبات متجهة فقط (`@phosphor-icons/react` بنمط Duotone أو `lucide-react`). **يُمنع منعاً باتاً** استخدام الإيموجي أو الصور النقطية كأيقونات واجهة.
- **تطابق التسميات 1:1:** عناوين بطاقات لوحة الانطلاق في [`dashboard.tsx`](../../frontend/src/features/dashboard/dashboard.tsx) تطابق تماماً تبويبات [`NativeTitleBar.tsx`](../../frontend/src/components/NativeTitleBar.tsx) وملفات الترجمة [`ar.json`](../../frontend/src/i18n/locales/ar.json). زر «المنتجات» يفتح صفحة «المنتجات» بنفس الاسم — يُمنع أي انحراف.
- **البطاقات التفاعلية:** بطاقات لوحة الانطلاق على سطح المكتب تحافظ على تناسب مربع `aspect-square` مع إضاءة ناعمة وتفاعل Hover، بلا تمدد رأسي غير متناسق.
- **الإيجاز:** عناوين وأزرار بكلمة أو كلمتين كحد أقصى، مع Tooltips للتفصيل. تجنّب الشروح والفقرات الطويلة.
- **RTL أصلي:** استخدم الخصائص المنطقية (`start/end`) لا الفيزيائية (`left/right`) في التخطيط العربي.

## 3. معمارية الواجهة (Frontend Conventions)
- **الحالة العالمية:** Zustand فقط ([`frontend/src/store/appStore.ts`](../../frontend/src/store/appStore.ts)). لا `Context` معقدة ولا `useState` في أعلى الهرم.
- **بيانات الخادم:** `@tanstack/react-query` حصراً عبر الوحدات في [`frontend/src/core/api/`](../../frontend/src/core/api).
- **الجداول:** `@tanstack/react-table`، والتقارير/المخططات عبر المكونات القائمة.
- **التحقق:** Zod schemas من [`frontend/src/core/schemas/`](../../frontend/src/core/schemas). **يُمنع `any` منعاً باتاً.**
- **التصميم:** Tailwind + مكونات Radix القائمة في `frontend/src/components/` — لا مكتبات UI جديدة بلا مبرر.
- **اللوجر:** الأخطاء غير المعالجة تُمرر إلى [`frontend/src/core/logger.ts`](../../frontend/src/core/logger.ts).

## 4. الأداء (Performance Invariants)
- **Virtualization:** يُمنع تصيير قوائم/جداول تتجاوز 100 عنصر بـ `.map()` مباشرة — استخدم `@tanstack/react-virtual` (النماذج: `VirtualProductGrid`، `ProductGridView`، `ProductListView`).
- **Debouncing:** حقول البحث التي تفلتر مصفوفات كبيرة محلياً تُغلف بـ `useDeferredValue`.
- **الذاكرة:** لا تحمّل صوراً Base64 ضخمة في قوائم؛ استخدم خادم الصور المحلي والمسارات.
- **المبالغ:** أي حساب مالي في الواجهة يمر عبر `Math.round()` (انظر قاعدة `financial-engineering`).

## 5. الاختبار قبل الإنهاء
```bash
cd frontend
npm run typecheck
npx vitest run --fileParallelism=false
```
وأضف/حدّث اختبار المكوّن عند تغيير سلوك واجهي، وزامن الـ E2E عند تغيير مسار أو تسمية.
