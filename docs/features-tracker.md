# تتبع الميزات والقرارات — بيدر (Features Tracker)

**تاريخ التأسيس:** 2026-10-05 · **المنهجية:** فحص الكود الفعلي وإسناد كل ادعاء إلى `ملف:سطر` أو نتيجة أمر مُشغَّل.
**الغرض:** مستند حي يُحدَّث مع كل جلسة عمل جوهري؛ يكمل `CHANGELOG.md` ولا يستبدله.

أسطورة الحالة: ✅ مكتمل ومُتحقق | ⚠️ مكتمل مع فجوات | 🔶 جزئي | ❌ غير منفذ | 🆕 أُضيف/أُصلح في جلسة حديثة | 🔍 قيد التدقيق (بانتظار جولة الوكلاء العشرة)

---

## 0.1 سجل جلسة تأسيس نظام الوكلاء والتوثيق — 2026-10-05

**المرجع:** طلب المالك الصريح بالاستفادة من تجربة مشروع Grido في إدارة الوكلاء والتوثيقات والتعليمات البرمجية وتطبيقها على بيدر.

| البند | التنفيذ | الإثبات |
| --- | --- | --- |
| طبقات تعليمات الوكلاء | إنشاء `.agents/rules/` (9 قواعد بمشغلات `trigger` دائمة ونطاقية) و`.agents/skills/` (8 مهارات مرجعية) و`.agents/agents/` (10 وكلاء فرعيين) و`.agents/workflows/` (5 مسارات SOP) | `find .agents -type f` = 32 ملفاً ✅ |
| دستور مفهرس | إعادة هيكلة `AGENTS.md` الجذر إلى دستور رئيسي يوزع التفاصيل على القواعد والمهارات مع الإبقاء على الثوابت الحرجة | `wc -l AGENTS.md` + `.agents/rules/` ✅ |
| بوابة التوثيق الآلية | إنشاء `scripts/docs-gate.mjs`: انحراف الأرقام المرجعية + تغطية الجرد + كومت بلا توثيق + مراجع المسارات + تأكيدات الكود (14 تأكيداً في النسخة الأولى) | `node scripts/docs-gate.mjs --strict-refs` ✅ |
| سكربت المقاييس | إنشاء `scripts/quality-metrics.mjs` لتوليد أرقام الجودة القابلة لإعادة التشغيل (لا ادعاء بلا دليل) | `node scripts/quality-metrics.mjs` ✅ |
| خريطة التوثيق | إنشاء `docs/DOCUMENTATION_MAP.md` بجرد كامل + مصفوفة مزامنة + 3 بوابات + أرقام مرجعية | الملف + نجاح البوابة ✅ |
| الخطافات الآلية | تفعيل `frontend/.husky/pre-commit` (بوابة + `lint-staged`) و`frontend/.husky/pre-push` (بوابة الدفع) بدل تشغيل كامل اختبارات الواجهة على كل كومت | `frontend/.husky/` + `git config core.hooksPath` ✅ |
| CI | إضافة وظيفة `docs-gate` إلى `.github/workflows/ci.yml` + تصحيح إصدار Go إلى `1.25.x` مطابقةً لـ `go.mod` (1.25.8) | الملف ✅ |
| تصحيح مرجع خاطئ | الدستور السابق كان يشير إلى `allMigrations` غير الموجودة؛ الاسم الفعلي `registeredMigrations` في `internal/repository/migration.go` | `grep -n "registeredMigrations" internal/repository/migration.go` ✅ |
| مزامنة README | تحديث فهرس التوثيق وقسم الاختبارات ليرجع إلى الخريطة بدل أرقام قديمة من الذاكرة | `README.md` ✅ |

**قرارات الجلسة:** بوابة التوثيق إلزامية قبل أي كومت/دفع. لا رقم بلا أمر. تأكيدات الكود لا تُحذف ولا تُضعف بصمت.

---

## 0.2 سجل جلسة إصلاح ترخيص LAN — 2026-10-05

**المرجع:** طلب المالك: تحديد أخطر عيب، ثم إصلاح «ترخيص الطلبات البعيدة بهوية الجهاز الطالب + ربط `StaffID` خادمياً + اختبارات انحدار لخادم مسجَّل خروجاً».

| البند | التنفيذ | الإثبات |
| --- | --- | --- |
| عزل الترخيص عن الجلسة العالمية | `domain.Actor` + `auth.CurrentActor` و`auth.RequirePermissionFor` + `ProcessSaleAs(actor, sale)`؛ وخادم LAN يمرّر جلسة الجهاز المُتحقق منها عبر سياق الطلب | `pkg/auth/actor.go` · `internal/core/domain/actor.go` · `internal/network/lan_server.go` + تأكيدا `LAN-04`/`SEC-04` ✅ |
| إسناد موظف مربوط خادمياً | `StaffID` القادم من الجهاز يُتحقق من وجوده في سجل موظفي الخادم، وإلا يُرفض (400) قبل أي كتابة | `internal/network/lan_server.go` + اختبار E2E ✅ |
| مصدر واحد لسياسة الأدوار | نقل `RolePermissions` إلى `domain` مع `PermissionsForRole` (13 صلاحية؛ Admin 13 / Manager 10 / Cashier 4 / Viewer 0) | `internal/core/domain/permissions.go` ✅ |
| اختبارات الانحدار | وحدة: `TestProcessSaleAs_AuthorizesExplicitActor`؛ E2E: `TestE2E_LAN_RemoteDiscountSaleWhenHostLoggedOut` (بيع بخصم والخادم مسجَّل خروجاً + رفض معرّف مجهول) | `go test -count=1 ./internal/... ./pkg/...` → EXIT 0 (20 حزمة ناجحة) ✅ |
| إقران الأجهزة (أُغلق في 0.3) | كان سر الخادم يُولَّد في الذاكرة ولا تعرضه أي واجهة ⇒ إقران أجهزة العميل عبر الواجهة غير ممكن | أُصلح في السجل 0.3 ✅ |

**قرار الجلسة:** لا يُقرأ `pkg/auth` العالمي من أي مسار LAN؛ كل فحص خدمي يأخذ هوية صريحة (`domain.Actor`).

---

## 0.3 سجل إكمال إقران أجهزة LAN — 2026-10-05

**المرجع:** متابعة إغلاق الفجوة الحرجة المكتشفة في الجولة السابقة (استحالة إقران الأجهزة عبر الواجهة).

| البند | التنفيذ | الإثبات |
| --- | --- | --- |
| ثبات سر الإقران | تخزين مشفَّر بمفتاح مشتق من عتاد الجهاز (`lan_server_secret.enc`، 0600) واسترجاعه قبل بدء الخدمة عبر `ensureServerSecret` | `internal/network/lan_server_secret_store.go` + `TestServerSecretPersistenceAcrossRestarts` ✅ |
| واجهة الإقران | عرض «رمز الإقران» مع زر نسخ في لوحة الخادم، وحقل العميل إلزامي بتسمية واضحة | `frontend/src/components/LanSyncPanel.tsx` + `npm run typecheck` ✅ |
| إعادة الاتصال التلقائية | حفظ الرمز مشفَّراً في `lan_config.json` وإعادة التسجيل عند بدء التطبيق (`reconnectSavedServer`) | `internal/network/lan_client.go` ✅ |
| التحقق | Go كامل + `-race` للمسارات المتغيرة + Vitest | `go test -count=1 ./internal/... ./pkg/...` = EXIT 0 (20 حزمة)؛ `npx vitest run` = 36 ملف/352 اختبار ✅ |

---

## 0.4 سجل جلسة تحصين سلامة الدفاتر والاسترجاع — 2026-10-05

**المرجع:** دفعة تحصين تالية لجولة التدقيق الشامل: معالجة أخطاء كانت تُبتلع صامتة في مسارات الاسترجاع والدفعات والاستيراد والإعدادات وإسناد موظفي LAN.

| البند | التنفيذ | الإثبات |
| --- | --- | --- |
| استرجاع `split` بدَين آجل مسدَّد | قيد دفعة سالبة + `creditOverpayCashRefund` ليُحسم النقد المُعاد من الرصيد المتوقع للوردية، وفشل القيد أو قراءة العميل يُرجِع الاسترجاع كاملاً | `internal/service/sale_service.go:704` · `TestReturnSplit_CreditOverpay_LeavesDrawer` و`TestReturnSplit_CreditOverpay_FailedLedgerWriteRollsBack` ✅ |
| حذف دفعة نقدية مستقلة | فشل `UpdateShiftSales` يُرجِع العملية كاملة بدل حذف الصف وبقاء الوردية تحتسب النقد | `internal/service/payment_service.go:206` · `TestDeletePayment_ShiftUpdateFailureRollsBack` ✅ |
| إسناد موظف على LAN | رفض fail-closed (500) عند غياب خدمة الموظفين بدل تسجيل `StaffID` بلا تحقق | `internal/network/lan_server.go:693` ✅ |
| استيراد CSV للمنتجات | فشل كتابة حركة المخزون يُضاف إلى `result.Errors` بعنوان السطر في مساري الإنشاء والتحديث | `internal/service/backup_service.go:533,578` ✅ |
| مفاتيح Gemini | فشل تشفير `secureconfig` يُعاد للواجهة برسالة صريحة بدل ابتلاعه | `internal/service/settings_service.go:93,97` ✅ |
| صور المنتجات ورسائل المبالغ | فشل حذف الصورة يُسجَّل تحذيراً؛ ورسالتا `CUSTOMER_HAS_DEBT`/`PAYMENT_EXCEEDS_DEBT` تُنسَّقان بقيمة `Float()` | `internal/service/product_service.go:153,183` · `internal/service/crm_service.go:164` · `internal/service/payment_service.go:95` ✅ |
| تثبيت الانحدار في البوابة | 3 تأكيدات كود جديدة: `FIN-03` (قيد النقد المُعاد لورديات `split` + منع ابتلاع فشل قيد الدفعة)، `FIN-04` (تراجع حذف الدفعة عند فشل الوردية)، `FIN-05` (بقاء اختبارات الانحدار الثلاثة) | `scripts/docs-gate.mjs` · اختبار سلبي: إعادة كل عيب مؤقتاً ⇒ فشل البوابة (5 أخطاء) ثم استُعيد الكود ونجحت (28 تأكيداً آنذاك) ✅ |
| التحقق | Go كامل + الاختبارات الثلاثة الجديدة بالاسم + `-race` للمسارات الحساسة | `go test -count=1 ./internal/... ./pkg/...` = EXIT 0 · `go test -race -count=1 ./internal/service/... ./internal/network/...` = EXIT 0 · `node scripts/docs-gate.mjs --strict-refs` ✅ |

**قرار الجلسة:** لا تُبتلع أخطاء كتابة الدفاتر المالية — أي فشل في قيد نقدي أو دفعة أو وردية أو مفاتيح يُفشل العملية مع تراجع، وما كان تنظيفاً هامشياً (صورة قديمة) يُسجَّل في السجل بدل تجاهله صامتاً.

---

## 0.5 سجل جلسة تحصين الأخطاء المُبتلَعة — 2026-10-05

**المرجع:** طلب المالك: مسح طبقة الخدمات بحثاً عن أخطاء مُبتلَعة على عمليات ذات أثر (دفتر، مخزون، وردية)، وإصلاحها مع تأكيد كود واختبار انحدار لكل إصلاح.

**حصيلة المسح:** مسارات المخزون والورديات والدفعات كانت نظيفة (كل كتاباتها تُفحص منذ جلسة 0.4)؛ المتبقي المُبتلَع كان في سجلات التدقيق داخل المعاملات، وحفظ الموظفين، وإعداد مفاتيح AI السحابي، وصيانة `VACUUM`.

| البند | التنفيذ | الإثبات |
| --- | --- | --- |
| تدقيق البيع/الإرجاع | fail-closed: فشل قيد التدقيق (خصم/إرجاع كامل/جزئي) يُفشل المعاملة كاملة | `internal/service/sale_service.go:518,808,1099` · 3 اختبارات تراجع ✅ |
| إعداد مفاتيح AI السحابي | صرامة كاملة في `SaveGlobalGroqKeys`: فشل الجلب/غير 200/فشل فك الترميز/إعداد تالف يوقف الحفظ بدل PATCH بتكوين فارغ يمسح مفاتيح Gemini | `internal/service/settings_service.go` · `TestSaveGlobalGroqKeys_MalformedConfigDoesNotWipeKeys` و`..._FetchFailureDoesNotWipeKeys` ✅ |
| العلاج الذاتي للمدير | فشل حفظ إعادة الضبط يُعاد كخطأ بدل نجاح وهمي | `internal/service/staff_service.go` · `TestSeedDefaultAdmin_HealUpdateFailurePropagates` ✅ |
| تحديث قائمة الموظفين | فشل `GetActive` بعد البذر يُعاد كخطأ بدل استبدال القائمة بقائمة فارغة | `internal/service/staff_service.go` · `TestGetActiveStaff_RefreshFailurePropagates` ✅ |
| حفظ ثانوي (توقيت/محاولات/VACUUM) | تسجيل تحذيري بدل الابتلاع الصامت، دون إفشال العملية الأصلية | `staff_service.go` · `backup_service.go` · `TestAuthenticateByUsername_BookkeepingFailureDoesNotBlockLogin` ✅ |
| تثبيت الانحدار | 9 تأكيدات كود جديدة: `FIN-06` · `FIN-07` · `STAFF-01`…`05` · `SET-01` · `LOG-01` (وصل المجموع إلى 37 آنذاك) + اختبار سلبي بإعادة قيدين مبتلَعين مؤقتاً ⇒ فشل البوابة ثم نجحت بعد الاستعادة | `scripts/docs-gate.mjs` ✅ |
| فشل بذر المدير الافتراضي | فشل `SeedDefaultAdmin` داخل `GetActiveStaff` يُسجَّل تحذيراً ويُنشر بدل ابتلاعه وإرجاع قائمة فارغة صامتة — قرر نشره لأن البذر هو المسار الوحيد من قائمة فارغة إلى تطبيق قابل للاستخدام — ولا يُستدعى البذر أصلاً عندما توجد قائمة نشطة | `internal/service/staff_service.go:520` · `TestGetActiveStaff_SeedFailurePropagates` و`TestGetActiveStaff_HealthyRosterNeverSeeds` ✅ |
| تثبيت انحدار البذر | تأكيدان كود إضافيان `STAFF-04` (تحذير البذر + عدم العودة للابتلاع) و`STAFF-05` (بقاء اختباره) — المجموع 37 آنذاك (39 بعد جلسة 0.6) | `scripts/docs-gate.mjs` · اختبار سلبي: تعطيل الإصلاح مؤقتاً ⇒ فشل البوابة (2 خطأ) ثم نجحت بعد الاستعادة ✅ |
| التحقق | الخدمة كاملة + الاختبارات الجديدة بالاسم + حزمة كاملة | `go test -count=1 ./internal/service/` = EXIT 0 · `go test -count=1 ./internal/... ./pkg/...` = EXIT 0 ✅ |

**قرار الجلسة:** قيود التدقيق داخل أي معاملة مالية جزء من المعاملة نفسها (fail-closed)؛ أما الحفظ الثانوي غير المالي فيُسجَّل تحذيراً ولا يُفشل العملية الأصلية — ولا يُقبل الابتلاع الصامت في الحالتين.

---

## 0.6 سجل جلسة تحصين العلاج الذاتي للمدير — 2026-10-06

**المرجع:** مراجعة تعديلات جلسة 0.5 كشفت بقاء ابتلاعين في نفس الدالة التي حُصّنت (`SeedDefaultAdmin`) واعتماداً ضمنياً على خطأ gorm الخام في طبقة الخدمة.

| البند | التنفيذ | الإثبات |
| --- | --- | --- |
| عقد المستودع | `GetByUsername` يُترجم `gorm.ErrRecordNotFound` إلى `domain.ErrRecordNotFound` مثل `GetLoginAttempt` وبقية المستودعات | `internal/repository/staff_repo.go:36-48` · `TestStaffRepository_GetByUsername_TranslatesNotFound` ✅ |
| غياب المدير مقابل فشل قراءته | الغياب الحقيقي لا-عملية صامتة، وفشل القراءة يُعاد كخطأ لأن `nil` تعني عند المستدعي «المدير قابل للاستخدام» | `internal/service/staff_service.go:739-747` · `TestSeedDefaultAdmin_HealReadFailurePropagates` و`TestGetActiveStaff_MissingAdminRow_HealsSilently` ✅ |
| فشل توليد الهاش | يُعاد بدل ابتلاعه | `internal/service/staff_service.go:749-752` · مغطى باختبار الوحدة أعلاه ✅ |
| ضمان عدم تأثر التثبيتات السليمة | القائمة النشطة غير الفارغة لا تُبذر أصلاً (البذر لا يُستدعى) | `internal/service/staff_service.go:515-529` · `TestGetActiveStaff_HealthyRosterNeverSeeds` (يتحقق أن `GetStaffCount` لم يُستدعَ) ✅ |
| تثبيت الانحدار | `STAFF-05` توسّع ليشمل اختبارَي القائمة، وأُضيف `STAFF-06` و`STAFF-07` — المجموع **39 تأكيداً** | `scripts/docs-gate.mjs` · اختبار سلبي: حذف الترجمة مؤقتاً ⇒ فشل `STAFF-06` واختبارين ثم نجحت بعد الاستعادة ✅ |
| التحقق | `go vet ./internal/service/` و`go test -count=1 ./internal/... ./pkg/...` و`node scripts/docs-gate.mjs --strict-refs` | كلها خضراء بتاريخ 2026-10-06 ✅ |

**قرار الجلسة:** أي خطأ يقرره المستدعي كحالة صحيحة فعلية (مثل «nil = المدير سليم») يجب أن يمر بتمييز صريح للنوع — لا يُختزل فشل القراءة إلى الحالة الصحيحة بصمت.

---

## 1. مصفوفة مجالات الميزات (خط الأساس — قيد التدقيق التفصيلي)

> هذه المصفوفة تُبنى تدريجياً عبر جولات التدقيق العشرية (`.agents/workflows/comprehensive-audit.md`). الحالة «🔍» تعني: موجود ومُوثق في الوثائق الحالية، بانتظار جلسة تدقيق توكلاء مثبتة بالأدلة.

| المجال | جذور الكود | الاختبارات القائمة | الحالة |
| --- | --- | --- | --- |
| نقطة البيع والمبيعات | `frontend/src/features/pos/` + `internal/service/` | `SalesPage` E2E + `payment_service_test.go` | 🔍 |
| المخزون وأوامر الشراء | `frontend/src/features/inventory/` + `internal/repository/purchase_order_repo.go` | `business_logic_comprehensive_test.go` | 🔍 |
| المالية والأقساط والخزينة | `internal/core/domain/money.go` + `internal/service/payment_service.go` | `money_*_test.go` + `payment_service_*_test.go` | ✅ (دقة Amount مثبتة باختبارات) |
| العملاء والموردون (CRM) | `internal/service/` + `internal/repository/customer_repo.go` | `customer_repo` اختبارات خدمة | 🔍 |
| الشبكة المحلية والأجهزة | `internal/network/` | اختبارات `lan_*_test.go` في `internal/network/` (6) و`internal/e2e/` (2) | ✅ ترخيص الجهاز الطالب + إقران الأجهزة بسر ثابت مشفَّر (جلسة 2026-10-05) |
| الطباعة (حرارية/A4/ملصقات) | `pkg/print/` + `frontend/src/components/PrintPortal.tsx` | `pkg/print/direct_test.go` + `print_service_test.go` | 🔍 |
| الذكاء الاصطناعي والمستشار | `internal/service/ai_service.go` + `frontend/src/core/ai.ts` | `ai_service_test.go` | 🔍 |
| التقارير والتحليلات | `frontend/src/features/reports/` | E2E + اختبارات إحصاء | 🔍 |
| الإعدادات والإضافات | `frontend/src/features/settings/` + `pkg/` | `plugins` docs | 🔍 |

---

## 2. القرارات المحمية (Protected Decisions) — يُمنع نقضها بلا موافقة صريحة

1. **SQLite:** `WAL` + `MaxOpenConns(1)` لا يُكسران — الضمان الوحيد ضد `database is locked` في LAN.
2. **المال:** `domain.Amount` (int64 cents) فقط؛ لا `float64` في أي حساب مالي.
3. **الأقساط:** تقريب `RoundToNearest(25000)` والقسط الأخير = المتبقي − مجموع السابق؛ رفض `downPayment > total`.
4. **الطباعة:** مسار الصور الصامت (HTML → `html-to-image` → `PrintBitmapReceipt` → winspool `GS v 0`)؛ لا ESC/POS نصي عربي؛ الملصقات في الواجهة.
5. **الأمان:** bcrypt + Tarpitting (لا Lockout كلي) · `subtle.ConstantTimeCompare` للأسرار · PBKDF2 ثم AES-256-GCM · أسرار عبر `secureconfig`.
6. **CSV:** تعقيم إلزامي ضد Formula Injection (`'` قبل `=`, `+`, `-`, `@`).
7. **واجهة POS:** أيقونات متجهة فقط (لا إيموجي/صور نقطية) · تطابق مسميات 1:1 (لوحة الانطلاق ↔ شريط التنقل ↔ ملفات الترجمة) · ثنائية الأقسام.
8. **البناء:** حصرياً `pwsh ./scripts/build.ps1` — لا `wails build` مباشر.
9. **المهاجرات:** مرقمة في `registeredMigrations` ولا يُعدَّل ملف مطبَّق (تصحيح مؤرخ 2026-10-05).
10. **E2E:** أي Handler Wails جديد يُزامن في `frontend/e2e/mock-wails.ts`.

---

## 3. الفجوات والملاحظات المعروفة

| # | الملاحظة | الحالة |
| --- | --- | --- |
| 1 | `allMigrations` في الدستور القديم لا وجود له؛ الصحيح `registeredMigrations` | 🆕 صُحّح 2026-10-05 |
| 2 | `DESIGN.md` في الجذر و`docs/DESIGN.md` نسختان شبه متطابقتين (فرق ~2 بايت) — تحتاجان قرار دمج من المالك | ⚠️ قرار مالك مطلوب |
| 3 | CI كان يستخدم Go `1.24.x` بينما `go.mod` يتطلب 1.25.8 | 🆕 صُحّح 2026-10-05 |
| 4 | README كان يعرض أرقام اختبارات قديمة (270/102) بلا أمر | 🆕 استُبدلت بإحالة إلى خريطة التوثيق |
| 5 | خطاف pre-commit كان يشغّل كامل اختبارات الواجهة على كل كومت (بطء محلي) | 🆕 استُبدل ببوابة التوثيق + `lint-staged` مع بقاء الاختبارات الكاملة في CI |
| 6 | لا جرد موحد للتوثيق قبل هذا التاريخ | 🆕 أُنشئ `docs/DOCUMENTATION_MAP.md` |
| 7 | جولة التدقيق التفصيلية للميزات (الوكلاء العشرة) لم تُنفَّذ بعد على النسخة الحالية | 🔍 جاهزة للتنفيذ وفق `.agents/workflows/comprehensive-audit.md` |

---

## 4. سجل الجلسات (الأحدث أولاً)

| الجلسة | التاريخ | الملخص |
| --- | --- | --- |
| 0.6 | 2026-10-06 | تحصين العلاج الذاتي للمدير: ترجمة غياب الموظف في المستودع، والتفريق بين غياب المدير وفشل قراءته، ونشر فشل الهاش — مع 4 اختبارات انحدار واختبار سلبي للبوابة |
| 0.5 | 2026-10-05 | تحصين الأخطاء المُبتلَعة: تدقيق فاتورة/مرتجع fail-closed، منع مسح مفاتيح AI عند إعداد تالف، إبلاغ فشل حفظ علاج المدير وقائمة الموظفين ونشر فشل بذر المدير الافتراضي، وتسجيل الحفظ الثانوي |
| 0.4 | 2026-10-05 | تحصين سلامة الدفاتر والاسترجاع: قيد نقدي للورديات المقسّمة عند الاسترجاع، تراجع كامل عند فشل قيد/وردية، رفض إسناد موظف غير مُتحقق منه، وتوثيق اختبارات الانحدار |
| 0.3 | 2026-10-05 | إكمال إقران أجهزة LAN بسر ثابت مشفَّر وواجهة إقران وإعادة اتصال تلقائية |
| 0.2 | 2026-10-05 | إصلاح ترخيص طلبات LAN بهوية الجهاز الطالب (Actor) وربط `StaffID` خادمياً |
| 0.1 | 2026-10-05 | تأسيس نظام الوكلاء والتوثيق وبوابة `docs-gate` وربطها بـ Husky وCI |
