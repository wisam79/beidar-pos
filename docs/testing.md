# 🧪 دليل الاختبارات (Testing Guide)

يوثق هذا المستند استراتيجية الاختبارات في نظام **Beidar**، بما في ذلك اختبارات الوحدة (Unit Tests)، اختبارات المكونات (Component Tests)، واختبارات النهاية إلى النهاية (E2E).

---

## 1. استراتيجية الاختبارات (Testing Strategy)

```
                      ┌─────────────────────────┐
                      │   Playwright E2E Tests   │
                      │  (3 سيناريوهات متكاملة)  │
                      └───────────┬─────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐
   │  Go Unit Tests   │  │  Vitest Tests    │  │  Zustand     │
   │  (service layer) │  │  (utils, hooks)  │  │  Store Tests │
   │  ~70% coverage   │  │  + Component     │  │              │
   └──────────────────┘  └──────────────────┘  └──────────────┘
```

---

## 2. اختبارات Go الخلفية (Go Backend Tests)

### الموقع
جميع ملفات الاختبارات بجانب الملف المُختبر (`*_test.go`).

### التوزيع الحالي
| المجلد | عدد ملفات الاختبار | التركيز |
|--------|-------------------|---------|
| `internal/service/` | 11 | منطق الأعمال الأساسي |
| `internal/repository/` | 3 | استعلامات GORM |
| `internal/core/domain/` | 1 | نوع Amount والحسابات المالية |
| `internal/integration/` | 1 | التكامل السحابي |

### التشغيل
```bash
# جميع اختبارات Go
go test ./...

# مع Race Detector
go test -race ./...

# خدمة محددة مع تفاصيل
go test ./internal/service/... -v

# تقرير التغطية
go test ./internal/service/... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

### إعداد قاعدة بيانات الاختبار
تستخدم الاختبارات SQLite في الذاكرة (`:memory:`) بدلاً من Mock:
```go
func setupTestDB(t *testing.T) *gorm.DB {
    db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
        Logger: logger.Default.LogMode(logger.Silent),
    })
    db.AutoMigrate(&domain.Product{}, &domain.Sale{}, /* ... */)
    repository.SetTestDB(db)
    return db
}
```

### نمط الاختبارات
```go
func TestProcessSale(t *testing.T) {
    db := setupTestDB(t)
    defer repository.SetTestDB(nil)

    // ترتيب (Arrange)
    product := createTestProduct(db, "Test Product", 1000) // 10.00 IQD
    saleReq := createTestSaleReq(product.ID, 2)

    // تنفيذ (Act)
    svc := service.NewSaleService(/* ... */)
    result, err := svc.ProcessSale(saleReq)

    // تحقق (Assert)
    assert.NoError(t, err)
    assert.Equal(t, domain.NewAmount(2000), result.Total)
    
    // تحقق من خصم المخزون
    updatedProduct, _ := getProduct(db, product.ID)
    assert.Equal(t, 8.0, updatedProduct.Stock) // كان 10، خصم 2
}
```

### التغطية المستهدفة
- طبقة `internal/service/`: **70%+**
- طبقة `internal/core/domain/`: **90%+**
- طبقة `internal/repository/`: **50%+** (اختبارات الاستعلامات الحرجة فقط)

---

## 3. اختبارات الواجهة الأمامية (Frontend Tests)

### الموقع
`frontend/__tests__/` — 9 ملفات اختبار باستخدام Vitest.

### التشغيل
```bash
cd frontend
npm run test          # تشغيل جميع الاختبارات
npm run test:coverage # مع تقرير التغطية
npm run test:ci       # بيئة CI
```

### أنواع الاختبارات
| النوع | مثال | الوصف |
|-------|------|-------|
| Unit | `utils.test.ts` | اختبار دوال التنسيق والمساعدة |
| Schema | `staff.schema.test.ts` | اختبار Zod schemas للتحقق من الصحة |
| Hook | `useCart.test.ts` | اختبار hooks (خاصة useCart) |
| Store | `__tests__` | اختبار Zustand stores |
| Component | `ui-components.test.tsx` | اختبار rendering المكونات |

### القواعد
- **لا تكرار**: استيراد الدوال الفعلية من `core/` و `utils/` — لا نسخ تعريفات داخل ملفات التست
- **اختبار الحالات**: تغطية حالات Loading, Error, Success, Empty
- **تجنب `any`**: استخدام الأنواع الفعلية من Wails auto-generated models

---

## 4. اختبارات E2E (Playwright)

### الموقع
`frontend/e2e/` — 3 سيناريوهات متكاملة.

### التشغيل
```bash
cd frontend
npm run test:e2e         # تشغيل في الخلفية (headless)
npm run test:e2e:ui      # تشغيل مع واجهة Playwright المرئية
npm run test:e2e:report  # عرض تقرير آخر تشغيل
```

### السيناريوهات الحالية
| الملف | الوصف |
|-------|-------|
| `master-simulation.spec.ts` | محاكاة دورة بيع كاملة (بحث ← إضافة للسلة ← دفع ← تحقق) |
| `finance-treasury.spec.ts` | اختبار الخزينة: مصروفات، ورديات، حركات نقدية |
| `debts-installments.spec.ts` | اختبار ديون العملاء والأقساط |

### مثال: سيناريو بيع كامل
```
1. تسجيل الدخول PIN 0000
2. البحث عن منتج بالباركود
3. إضافة المنتج إلى السلة
4. اختيار عميل (مع دين سابق)
5. اختيار طريقة دفع (نقدي + آجل)
6. إتمام البيع
7. التحقق من:
   - خصم المخزون
   - تسجيل المبلغ في الوردية
   - تحديث دين العميل
   - ظهور الفاتورة في سجل المبيعات
```

---

## 5. Race Detector (فحص التزامن)

**إلزامي** قبل كل commit للتأكد من خلو التطبيق من مشاكل التزامن:

```bash
go test -race ./...
```

### لماذا هو مهم؟
- التطبيق يعمل كخادم LAN مع طلبات متزامنة من عدة عملاء
- عمليات البيع تتم ضمن DB Transactions مع قراءة/كتابة متزامنة
- نوع `Amount` (int64) يجب أن يكون thread-safe
- خادم الصور يعمل في Goroutine منفصلة

### مشاكل Race Condition المحتملة
| الموقع | المشكلة المحتملة | الحل |
|--------|-----------------|------|
| `sale_service.go` | وصول متزامن للمخزون | DB Transaction |
| `lan_server.go` | تعديل قائمة العملاء | Mutex lock |
| `settings_service.go` | قراءة/كتابة الإعدادات | RWMutex |
| `stats_service.go` | تجميع إحصائيات متزامنة | Read-only queries |

---

## 6. نصائح للاختبار (Testing Tips)

1. **اختبار الحافة (Edge Cases)**: اختبر القيم الصفرية، السالبة، والحدود القصوى
2. **اختبار Transaction**: تأكد من الـ Rollback عند فشل أي خطوة
3. **اختبار Amount**: استخدم `domain.NewAmount()` للقيم الدقيقة، ليس `float64`
4. **اختبار اللغة**: اختبر الواجهة بالعربية والإنجليزية (RTL/LTR)
5. **اختبار الأداء**: اختبر مع قوائم كبيرة من المنتجات (10,000+)
6. **اختبار Offline**: اختبر سلوك التطبيق عند قطع الاتصال بالخادم

---

## 7. أوامر سريعة (Quick Reference)

| الغرض | الأمر |
|-------|-------|
| جميع اختبارات Go | `go test ./...` |
| مع Race Detector | `go test -race ./...` |
| اختبارات Frontend | `cd frontend && npm run test` |
| اختبارات E2E | `cd frontend && npm run test:e2e` |
| تقرير التغطية Go | `go test -coverprofile=coverage.out ./...` |
| تقرير التغطية Frontend | `cd frontend && npm run test:coverage` |
