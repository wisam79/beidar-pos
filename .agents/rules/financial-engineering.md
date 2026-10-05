---
trigger: glob
globs:
  - "internal/service/**"
  - "internal/core/domain/**"
  - "internal/repository/**"
  - "frontend/src/features/pos/**"
  - "frontend/src/features/finance/**"
  - "frontend/src/features/invoices/**"
  - "frontend/src/core/api/finance.ts"
description: "الهندسة المالية والحسابية: domain.Amount، الأقساط، الخصومات، الحماية من Mass-Assignment، وعقود الخدمات"
---

# قواعد الهندسة المالية (Zero Floating-Point Error)

> المصدر الحاكم: `AGENTS.md` القسم 3.8 و3.10 · المهارة: [`/skills/beidar-financial-integrity/SKILL.md`](../skills/beidar-financial-integrity/SKILL.md)

## 1. المبالغ المالية
- **الخلفية:** النوع الوحيد المسموح للمال هو `domain.Amount` (int64 cents) من [`internal/core/domain/money.go`](../../internal/core/domain/money.go).
  - للبناء: `NewAmount` · `FromCents` · `ParseAmount` | للقراءة: `Cents()` · `Float()` (للعرض فقط)
  - للعمليات: `Add` · `Sub` · `Mul` · `MulFloat` · `Div` · `Percentage` · `RoundToNearest` · `Abs`
  - يُمنع `float64` في أي جمع/طرح/ضرب مالي. الضرائب والخصومات عبر `Percentage`/`MulFloat` اللتين تعالجان الكسر وتجبرانه.
- **الواجهة:** كل المبالغ القادمة من الخلفية أعداد صحيحة (cents). يُمنع استخدامها في حسابات دون `Math.round()` لمنع الانجراف العشري في JavaScript.

## 2. الأقساط (Installments)
المرجع الحي: [`internal/service/payment_service.go`](../../internal/service/payment_service.go) — `CalculateInstallmentPlan`.
- **التحقق أولاً:** `if downPayment > total` ⇒ خطأ فوري (حماية من أرصدة ديون سالبة).
- دفعة أولى == الإجمالي ⇒ لا حاجة لتقسيط (خطأ `NO_INSTALLMENT_NEEDED`).
- القسط الأساسي = قسمة صحيحة ثم `RoundToNearest(25000)` (تقريب لأقرب 250 دينار = 25000 قرش). لا تقسيم عشري.
- **القسط الأخير = المتبقي الكلي − (القسط الأساسي × عدد الأشهر السابقة)** لضمان عدم فقدان أي قرش.
- إذا نتج قسط أساسي صفري ⇒ خطأ `INSTALLMENT_BELOW_MINIMUM` (أقساط صفرية غير قابلة للتحصيل).
- إنشاء خطة بدفعة أولى `DownPayment > 0` يسجل قيد دفع نقدي فوري مرتبط بالفاتورة والوردية النشطة.

## 3. الخصومات والفواتير
- يُمنع خصم على مستوى الفاتورة يتجاوز إجمالي الفاتورة المحسوب من الأصناف: `sale.Discount > calculatedTotal` ⇒ مرفوض.
- عند تقديم عينات مجانية (خصم 100%) يُضبط الخصم على مستوى الصنف نفسه لتفادي خطأ الخصم المزدوج.
- إرجاع الفواتير المقسمة (Split) يفحص طريقة الدفع ويعيد خصم الجزء المقيد ديناً من حساب العميل بشكل سليم.

## 4. عقود الخدمات (Service Contracts)
- **إنشاء عميل جديد (`SaveCustomer`):** يجب ترك `c.ID` فارغاً `""` — الـ service تولّد UUID ذرياً وتفحص تكرار الهاتف. تمرير معرف غير فارغ يُعامل كتعديل ويفشل إن لم يوجد.
- **استلام أوامر الشراء (`ReceivePurchaseOrder`):** الكميات المستلمة تُقرأ حصراً من `item.ReceivedQty` وليس `item.Quantity`.
- **التحديثات الذرية:** أرصدة الورديات والمجاميع التراكمية تُحدَّث عبر `gorm.Expr` في الـ repository (انظر قاعدة `database-concurrency`).
- **الآنية (Idempotency):** أي عملية دفع/تحصيل قد تُعاد يجب أن تتحمل التكرار دون ازدواج القيد.

## 5. قوائم التحقق قبل إنهاء أي عمل مالي
- [ ] لا `float64` في مسار مالي (ابحث في الملف المعدَّل).
- [ ] الأقساط: تحقق DownPayment، تقريب 250، تسوية الشهر الأخير.
- [ ] الخصم ≤ إجمالي الأصناف.
- [ ] اختبارات الـ service ذات الصلة تعمل: `go test ./internal/service/... ./internal/core/domain/...`
