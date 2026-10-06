# 🧪 دليل الاختبارات (Testing Guide)

يوثق هذا المستند استراتيجية الاختبارات في نظام **Beidar**، بما في ذلك اختبارات الوحدة (Unit Tests)، اختبارات المكونات (Component Tests)، واختبارات النهاية إلى النهاية (E2E).

---

## 1. استراتيجية الاختبارات (Testing Strategy)

```
                      ┌─────────────────────────┐
                      │   Playwright E2E Tests   │
                      │  (18 ملف مواصفات E2E)  │
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

### التوزيع الحالي (تحقق: 2026-10-06)
| المجلد | عدد ملفات الاختبار | التركيز |
|--------|-------------------|---------|
| `internal/service/` | 33 | منطق الأعمال الأساسي والمالية والاسترجاع |
| `internal/repository/` | 23 | استعلامات GORM والعمليات الذرية والتزامن |
| `internal/core/domain/` | 9 | نوع Amount والحسابات المالية والصلاحيات |
| `internal/e2e/` | 29 | تكامل شامل (بيع/شبكة/أمان/ورديات/ضغط) |
| `internal/network/` | 7 | خادم وعميل واكتشاف LAN وسر الإقران |
| `internal/integration/` | 4 | التكامل السحابي والاستعادة من الكوارث |
| `pkg/` | 17 | الأمان والتشفير والطباعة والترجمة i18n |
| `internal/testutil/` | 1 | أدوات تجهيز قاعدة بيانات الاختبارات |
| **الإجمالي** | **123** | `find internal pkg -name '*_test.go' \| wc -l` |

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

### اختبارات انحدار ترخيص LAN (Actor Authorization)
```bash
go test -count=1 -run 'TestProcessSaleAs_AuthorizesExplicitActor' ./internal/service/
go test -count=1 -v -run 'TestE2E_LAN' ./internal/e2e/
```
- `TestProcessSaleAs_AuthorizesExplicitActor` (`internal/service/sale_service_test.go`): طالب مجهول بخصم يُرفض، وطالب جهاز كاشير يمرّ (والخادم بلا جلسة)، وطالب بلا صلاحية خصم يُرفض.
- `TestE2E_LAN_RemoteDiscountSaleWhenHostLoggedOut` (`internal/e2e/lan_network_integration_test.go`): بيع بخصم عن بُعد بعد تسجيل خروج جهاز الخادم + رفض `StaffID` غير معروف بلا أي كتابة + قبول موظف مسجَّل على الخادم.
- `TestServerSecretPersistenceAcrossRestarts` و`TestServerSecretRotationPersists` و`TestFileServerSecretStoreRoundTrip` (`internal/network/lan_secret_persistence_test.go`): ثبات سر الإقران بعد إعادة التشغيل، والدوران اليدوي، وأن التخزين على القرص مشفَّر (يشمل اختبار round-trip بمسار تهيئة معزول مؤقتاً).

> **ملاحظة على الآثار الجانبية:** اختبارات تُشغّل خادم LAN حقيقياً تكتب سر الإقران المشفَّر في مجلد إعدادات المستخدم (`lan_server_secret.enc`) كما يفعل التطبيق نفسه؛ والاختبارات المخصّصة للسر تستخدم مخزناً وهمياً في الذاكرة أو مساراً مؤقتاً معزولاً.

### اختبارات انحدار سلامة الاسترجاع والدفعات (Return & Payment Integrity)
```bash
go test -count=1 -run 'TestReturnSplit_CreditOverpay|TestDeletePayment_ShiftUpdateFailureRollsBack' ./internal/service/
```
- `TestReturnSplit_CreditOverpay_LeavesDrawer` (`internal/service/return_integrity_test.go`): استرجاع فاتورة `split` بعدَين آجل مسدَّد يُعيد النقد الزائد للعميل ويخصمه من الرصيد المتوقع للوردية — فلا يظهر فائض وهمي عند الإقفال.
- `TestReturnSplit_CreditOverpay_FailedLedgerWriteRollsBack`: فشل أول قيد في دفتر الدفعات يُرجِع الاسترجاع كاملاً (الفاتورة لا تُوسم «مُرتجَعة»، الدين يعود كما كان، والمخزون لا يتغيّر) بدل إغلاق الفاتورة بلا قيد نقدي.
- `TestDeletePayment_ShiftUpdateFailureRollsBack`: حذف دفعة نقدية مستقلة يفشل ويُبقي صف الدفعة إذا تعذّر تحديث الوردية، بدل حذف النقد من الدفتر مع بقائه محسوباً في الوردية.

### اختبارات انحدار الأخطاء المُبتلَعة (Swallowed Errors Hardening)
```bash
go test -count=1 -run 'TestProcessSale_DiscountAuditFailureRollsBack|TestReturnSale_AuditFailureRollsBack|TestReturnSalePartial_AuditFailureRollsBack|TestSeedDefaultAdmin_HealUpdateFailurePropagates|TestAuthenticateByUsername_BookkeepingFailureDoesNotBlockLogin|TestGetActiveStaff_RefreshFailurePropagates|TestGetActiveStaff_SeedFailurePropagates|TestSaveGlobalGroqKeys_MalformedConfigDoesNotWipeKeys|TestSaveGlobalGroqKeys_FetchFailureDoesNotWipeKeys|TestSeedDefaultAdmin_HealReadFailurePropagates|TestGetActiveStaff_MissingAdminRow_HealsSilently|TestGetActiveStaff_HealthyRosterNeverSeeds' ./internal/service/ && go test -count=1 -run 'TestStaffRepository_GetByUsername_TranslatesNotFound' ./internal/repository/
```
- `TestProcessSale_DiscountAuditFailureRollsBack` و`TestReturnSale_AuditFailureRollsBack` و`TestReturnSalePartial_AuditFailureRollsBack` (`internal/service/swallowed_error_regressions_test.go`): فشل قيد التدقيق يُرجِع البيع بخصم أو الإرجاع الكامل/الجزئي كاملاً (لا فاتورة بلا أثر، لا مخزون مُعدَّل، لا حركة وردية).
- `TestSeedDefaultAdmin_HealUpdateFailurePropagates`: العلاج الذاتي لكلمة مدير لم يسجّل دخوله يُبلّغ عن فشل الحفظ بدل إرجاع نجاح وهمي.
- `TestAuthenticateByUsername_BookkeepingFailureDoesNotBlockLogin`: فشل حفظ وقت آخر دخول يُسجَّل تحذيراً ولا يمنع دخولاً تم التحقق منه.
- `TestGetActiveStaff_RefreshFailurePropagates`: فشل قراءة قائمة الموظفين بعد بذر المدير الافتراضي يُعاد كخطأ لا كقائمة فارغة.
- `TestSaveGlobalGroqKeys_MalformedConfigDoesNotWipeKeys` و`TestSaveGlobalGroqKeys_FetchFailureDoesNotWipeKeys`: إعداد `ai_keys` تالف أو فشل جلب الإعداد الحالي (شبكة/غير 200) يوقف الحفظ قبل إرسال أي PATCH حتى لا تُمسح مفاتيح المزوّدين الآخرين.
- `TestSeedDefaultAdmin_HealReadFailurePropagates` و`TestGetActiveStaff_MissingAdminRow_HealsSilently`: فشل قراءة صف المدير أثناء العلاج الذاتي يُعاد كخطأ، أما غيابه الحقيقي فيبقى لا-عملية صامتة — والثاني يقفل عقد المستودع على `domain.ErrRecordNotFound`.
- `TestGetActiveStaff_HealthyRosterNeverSeeds`: وجود موظف نشط يعني أن البذر لا يُستدعى أصلاً (`GetStaffCount` لا يُنادى)، فلا يمسّ النشر fail-closed أي تثبيت سليم.
- `TestStaffRepository_GetByUsername_TranslatesNotFound` (`internal/repository/staff_repo_test.go`): `GetByUsername` لصف غير موجود يُرجع `domain.ErrRecordNotFound` لا خطأ gorm الخام.

### قياس التغطية (Go Coverage)
```bash
# قياس شامل لكل كود الإنتاج (نفس أمر CI)
go test -p 4 -covermode=atomic \
  -coverpkg=./internal/core/...,./internal/handlers/...,./internal/integration/...,./internal/network/...,./internal/repository/...,./internal/service/...,./pkg/... \
  -coverprofile=coverage.out \
  ./internal/... ./pkg/...

# التقرير: جدول لكل حزمة (الأدنى أولاً) + الإجمالي، ويكتب ملخصاً في GITHUB_STEP_SUMMARY داخل CI
node scripts/coverage-gate.mjs --profile=coverage.out

# سقّاطة (ratchet): ترجع 1 إذا نزل الإجمالي تحت العتبة
node scripts/coverage-gate.mjs --profile=coverage.out --min=<العتبة>
```
- **ما يُقاس بالضبط:** نسبة العبارات (statements) المشمولة ÷ كل عبارات كود الإنتاج المُدرج في `-coverpkg`. المقام **ثابت** لا يتغيّر عند إضافة أول ملف اختبار لحزمة كانت بلا اختبارات (بخلاف `go test -coverprofile` الافتراضي الذي يُسقط الحزم بلا اختبارات من المقام)، ويُقاس فيه الكود الذي تغطّيه اختبارات حزمة أخرى.
- **خارج المقام:** `internal/e2e` و`internal/testutil` — كود اختبار لا كود إنتاج.
- **أين تُقرأ الأرقام:** جدول التغطية يُطبع في ملخص وظيفة `go-backend` (Job Summary) داخل كل تشغيل، وملف `coverage.out` يُرفع كأرتيفاكت `go-coverage`.
- **دمج الكتل المكررة (مهم):** ملف `go test -coverprofile` مع `-coverpkg` يحتوي كل كتلة **مرة لكل حزمة اختبار** (~80 ألف سطر مقابل ~5 آلاف كتلة فريدة في قياس 2026-10-06)، لأن كل ثنائية اختبار تُصدّر تغطيتها كاملة بما فيها ما لم تنفّذه. من يقرأ الملف يجب أن يدمج الكتل بمفتاح الموقع ويجمع العدّادات (سلوك `atomic` رسمياً) وإلا ينتفخ المقام فتنخفض النتيجة كذباً (6.3% بدل 57.7% في نفس القياس). `coverage-gate.mjs` يفعل ذلك ويطبع سطر «دمج الكتل المكررة».
- **مطابقة التعريف الرسمي:** الإجمالي المُحسوب طابق `go tool cover -func` على نفس الملف بفارق تقريب ≤0.1 نقطة (57.7% مقابل 57.6% في قياس 2026-10-06).

#### دفعات رفع التغطية
```bash
# الدفعة 1 (2026-10-06) — طابعة PDF + ضغط النسخ الاحتياطي + عميل LAN
node scripts/coverage-gate.mjs --profile=coverage.out   # بعد تشغيل CI، أو محلياً بملف coverage.out من الأرتيفاكت
```
- `pkg/print/pdf_test.go`: الطابعة الحرارية بكل مقاسات الورق (`58mm`/`110mm`/`80mm`) مع/بدون عميل وخصم وجدول أقساط، مسار A4، الفشل الحقيقي عند مسار غير قابل للكتابة، وQR (نجاح PNG + حجم غير صالح).
- `internal/integration/backup_compress_test.go`: ZIP النسخة الاحتياطية يحتوي `beidar_v3.db` برأس SQLite حقيقي عبر مسار `VACUUM INTO`، مسار السقوط بلا قاعدة نشطة، ورفض الحمولة التالفة/الفارغة قبل لمس أي ملف.
- `internal/network/lan_client_test.go`: `RemoteGet`/`RemotePost`/`RemoteDelete` (نجاح، 401، خطأ خادم، JSON غير صالح، فشل الترميز، غير متصل)، `TestConnection` (قصير/طويل/خطأ شبكة)، و`GetClientStatus` (standalone/client-over-TLS/server).
- **الخط الأساس والعتبة الحالية:** 57.7% تغطية كلية (تشغيل CI رقم `37482085839`) والعتبة المفروضة `--min=57.5` في خطوة `Coverage Ratchet Gate` بوظيفة `go-backend`.
- **رموز خروج `coverage-gate.mjs`:** `0` نجاح · `1` انخفاض تحت العتبة · `2` ملف مفقود أو غير قابل للتحليل.
- **العتبة (السقّاطة):** تُمرَّر إلى `--min` في خطوة التغطية داخل [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)، ولا تُخفَّض إلا بقرار موثّق في `CHANGELOG.md`.

### التغطية المستهدفة
> المستهدف التالي هو طبقات حرجة داخل الإجمالي المقاس أعلاه (ولا يُغني عن سقّاطة الإجمالي في CI).

- طبقة `internal/service/`: **70%+**
- طبقة `internal/core/domain/`: **90%+**
- طبقة `internal/repository/`: **50%+** (اختبارات الاستعلامات الحرجة فقط)

---

## 3. اختبارات الواجهة الأمامية (Frontend Tests)

### الموقع
`frontend/src/**` — 36 ملف اختبار باستخدام Vitest (يُحتسب آلياً في بلوك `docs-metrics` بخريطة التوثيق).

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
`frontend/e2e/` — 18 ملف مواصفات (يُحتسب آلياً في بلوك `docs-metrics`).

### التشغيل
```bash
cd frontend
npm run test:e2e         # تشغيل في الخلفية (headless)
npm run test:e2e:ui      # تشغيل مع واجهة Playwright المرئية
npm run test:e2e:report  # عرض تقرير آخر تشغيل
```

### أمثلة على السيناريوهات
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
