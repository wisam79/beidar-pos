---
name: beidar-financial-integrity
description: الهندسة المالية في بيدر — دليل استخدام domain.Amount والأقساط والخصومات والحماية من أخطاء الفاصلة العائمة
---

# 💰 سلامة الهندسة المالية (Financial Integrity)

المرجع الحي: [`internal/core/domain/money.go`](../../internal/core/domain/money.go) · [`internal/service/payment_service.go`](../../internal/service/payment_service.go)

## 1. واجهة `domain.Amount` (int64 cents)
| الحاجة | الدالة |
|---|---|
| بناء من رقم صحيح/عشري | `NewAmount(v float64)` · `FromCents(c int64)` · `ParseAmount(s string)` |
| قراءة | `Cents() int64` · `Float() float64` (للعرض فقط) |
| عمليات | `Add` · `Sub` · `Mul(factor int64)` · `MulFloat(factor float64)` · `Div` · `Percentage(p float64)` |
| تقريب | `RoundToNearest(unit Amount)` (تقريب لأسفل لأقرب وحدة) |
| فحوص | `IsZero` · `IsNegative` · `Abs` |
| عرض | `String()` |

### أمثلة صحيحة
```go
total := items.Sum()                       // Amount
tax := total.Percentage(15)                // ضريبة 15%
withTax := total.Add(tax)
perMonth := remaining.Div(int64(months)).RoundToNearest(domain.Amount(25000))
```
### ممنوع
```go
var price float64 = 12.5        // ❌ لأي مبلغ
total := price * 1.15           // ❌ انجراف عشري
```
الاستثناء الوحيد لـ `Float()`: العرض/التنسيق، لا الحساب.

## 2. دليل الأقساط (Installment Playbook)
من `CalculateInstallmentPlan` في [`payment_service.go`](../../internal/service/payment_service.go):
1. `months <= 0` ⇒ خطأ فوري.
2. `downPayment > total` ⇒ خطأ فوري (لا ديون سالبة).
3. `remaining = total - downPayment`؛ إن كان صفراً ⇒ `NO_INSTALLMENT_NEEDED`.
4. القسط الأساسي: قسمة صحيحة ثم `RoundToNearest(25000)`.
5. إن صار الأساسي صفراً ⇒ `INSTALLMENT_BELOW_MINIMUM`.
6. الجدولة: الأشهر 1..N-1 بالقيمة الأساسية، **والشهر الأخير = `remaining - roundedBase*(months-1)`**.
7. الدفعة الأولى > 0 ⇒ قيد دفع نقدي فوري مرتبط بالفاتورة والوردية.

## 3. الخصومات
- `sale.Discount` على مستوى الفاتورة ≤ إجمالي الأصناف المحسوب.
- العينات المجانية: خصم 100% على مستوى **الصنف** لا الفاتورة (تفادي ازدواج الخصم).
- تطبيق الخصم عبر `Amount` والتحقق قبل الحفظ في الـ service.

## 4. حماية الأرصدة (Mass-Assignment)
عند تعديل عميل/مورد:
1. اجلب الكائن الحالي من الـ repository.
2. دمج الحقول المسموحة فقط (الاسم، الهاتف، الملاحظات).
3. احمِ الحقول المالية: الديون، النقاط، المشتريات التراكمية، رصيد المورد.
التحديثات التراكمية عبر `gorm.Expr` فقط (انظر [`/rules/database-concurrency.md`](../rules/database-concurrency.md)).

## 5. الواجهة الأمامية
- كل المبالغ من الخلفية صحيحة (cents).
- أي ضرب/جمع في الواجهة يمر عبر `Math.round()`.
- التنسيق للعرض عبر دوال مساعدة قائمة (لا منطق مالي موازٍ في React).

## 6. التحقق
```bash
go test ./internal/service/... ./internal/core/domain/...
```
اختبارات مرجعية موجودة: `payment_service_test.go` · `payment_service_edge_test.go` · `financial_logic_test.go` · `money_comprehensive_test.go`.
