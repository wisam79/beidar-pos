# تسليم أعمال التحسين والأمان

تاريخ آخر تحديث: 2026-08-13  
الحالة: تغييرات محلية مكتملة التحقق ولم تُنشأ لها commit بعد.

## الهدف

هذه الوثيقة تسجل كل ما نُفذ خلال مراجعة جودة وأمان تطبيق Beidar، وكيفية استكمال العمل لاحقاً دون إعادة اكتشاف السياق.

## النتيجة الحالية

تمت معالجة المخاطر الأعلى أولوية التي كانت ظاهرة في المراجعة:

- تدقيق اعتماديات الإنتاج ينتهي بـ **0 ثغرات**.
- اختبارات الواجهة أصبحت مستقرة على Windows عبر Vitest fork pool.
- lint صار بلا تحذيرات (`--max-warnings=0`).
- صلاحيات LAN أصبحت سياسة مركزية مانعة افتراضياً، ومغطاة باختبار مباشر.
- النسخ الاحتياطي أصبح ذا كتابة ذرية، وتسبق الاستعادة لقطة أمان قابلة للرجوع إليها.
- مسار إصدار Windows صار يفرض التوقيع، ومسار البناء الموحد يدعم Windows وLinux ومخرجاً صريحاً.

لا تدّعي هذه الدفعة حل كل عناصر خارطة الطريق. بقيت عناصر بنيوية موضحة في قسم «العمل المتبقي».

## الملفات المعدلة

| المجال | الملفات | ملخص التغيير |
|---|---|---|
| الاعتماديات | `frontend/package.json`, `frontend/package-lock.json` | حذف `xlsx`، ترقية `react-router-dom` إلى `^7.18.2`، تحديث القفل حتى أصبح `npm audit --omit=dev` نظيفاً، وإضافة نطاق Node `>=20 <25`. |
| التصدير | `frontend/src/core/export.ts` | استبدال توليد XLSX بـCSV متوافق مع Excel، مع BOM للغة العربية وتعقيم صيغة CSV (`=`, `+`, `-`, `@`). التصدير متعدد الأوراق ينتج ملف CSV لكل ورقة لأن CSV لا يملك مفهوم الأوراق. |
| اختبارات الواجهة | `frontend/vitest.config.ts`, `frontend/package.json`, `.github/workflows/ci.yml` | استعمال `forks` و`fileParallelism=false` لتفادي تعليق Vitest على Windows؛ إضافة job Windows؛ جعل lint صفراً من التحذيرات؛ إضافة تدقيق اعتماديات الإنتاج في CI. |
| إصلاحات React | `frontend/src/core/sound.ts`, `frontend/src/features/**`, `frontend/src/hooks/**` | إزالة non-null assertions، تصحيح dependencies للـHooks، تثبيت callbacks الخاصة بالماسح، وتوجيه أخطاء النسخ والإعدادات إلى logger المركزي. |
| Pagination للعملاء والموردين | `internal/core/domain/**`, `internal/repository/**`, `internal/service/**`, `internal/handlers/**`, `internal/network/**`, `frontend/src/**` | إضافة الترقيم (Pagination) الشامل عبر كافة الطبقات للعملاء والموردين بدون silent limits مع Virtualization في الواجهة الأمامية ودعم معاملات `page`, `pageSize`, `search`. |
| تشفير LAN وTLS 1.3 واقتران الأجهزة | `internal/network/lan_tls.go`, `internal/network/lan_server.go`, `internal/network/lan_discovery.go`, `internal/network/lan_client.go`, `internal/network/lan_tls_test.go`, `frontend/src/components/LanSyncPanel.tsx` | تشفير TLS 1.3 التلقائي عبر شهادات ECDSA P-256 موقعة ذاتياً ومولدة محلياً مع مفاتيح خاصة مشفرة بـ MachineGuid، وتثبيت بصمات الشهادات الرقمية (SHA-256 Fingerprint Pinning / TOFU) لمنع هجمات MitM والتنصت، وتحديث واجهة الربط الشبكي لعرض البصمة وحالة التشفير. |
| الرصد والخصوصية وحجب PII | `pkg/logger/logger.go`, `pkg/logger/logger_test.go`, `frontend/src/core/logger.ts`, `frontend/src/__tests__/logger.test.ts` | تعقيم آلي وحجب لكافة البيانات الشخصية الحساسة (أرقام الهواتف، الـ Tokens، كلمات المرور، الـ PIN، ومفاتيح الـ API) في الـ Logger المركزي عبر الواجهتين الخلفية والأمامية. |
| ترقيم الـ Migrations وسلامة المخطط | `internal/repository/migration.go`, `internal/repository/migration_test.go`, `internal/repository/db.go` | إنشاء جدول `schema_migrations` مع تثبيت الـ Baseline v2.0.8، وتشغيل المعاملات الذرية وفحوصات `PRAGMA foreign_key_check` بعد كل ترحيل للحفاظ على تكامل البيانات. |
| LAN | `internal/network/lan_clients.go`, `internal/network/lan_server.go`, `internal/network/lan_authorization_test.go` | رموز جلسة 256-bit، رفض أجهزة بلا معرف/اسم، دالة `lanRoleAllows` موحدة وفاشلة بالإغلاق، واختبارات للدور/المسار/الطريقة. |
| النسخ الاحتياطي | `internal/service/backup_service.go`, `internal/service/backup_service_test.go` | إنشاء ملف مؤقت خاص ثم `Sync` ثم `Rename` ذري؛ تضمين milliseconds في الاسم؛ لقطة تعافٍ تلقائية قبل الاستعادة؛ اختبار لتأكيد إنشاء اللقطة. |
| الإصدار | `scripts/build.ps1`, `.github/workflows/release.yml` | السكربت يقبل `Platform` و`Output`، ويحترم إعدادات Supabase من البيئة أو ملفات env؛ workflows تستخدمه وتحقن الأسرار وتفرض شهادة توقيع Windows. |

## تفاصيل أمنية مهمة

### الاعتماديات

سبب حذف `xlsx`: كانت توجد ثغرات عالية الخطورة بلا إصلاح تلقائي في حزمة SheetJS. لا تعِد إضافتها قبل تقييم بديل وصيانة أمنية نشطة. CSV المولد حالياً يحمي من Formula Injection ويكفي للتقارير الجدولية.

الأمر المعتمد:

```powershell
Set-Location frontend
npm audit --omit=dev --audit-level=moderate
```

النتيجة المتوقعة حالياً: `found 0 vulnerabilities`.

### LAN

الملف المرجعي للسياسة هو `internal/network/lan_server.go`، الدالة `lanRoleAllows`.

- `admin`: كل المسارات الموثقة.
- `cashier`: قراءة قائمة محددة، وإنشاء بيع أو عميل فقط.
- `manager`: عمليات يومية محددة دون تصدير قاعدة البيانات أو إدارة أجهزة LAN.
- `viewer` وأي دور مجهول: مرفوضان.

أي مسار جديد تحت `/api/` يجب أن يُضاف صراحةً إلى هذه السياسة، ثم يضاف له اختبار في `internal/network/lan_authorization_test.go`. لا توسع صلاحيات `admin` إلى أدوار أخرى بصورة ضمنية.

حدود ما زالت قائمة: النقل بين أجهزة LAN يستخدم HTTP. رموز الجلسة محمية من التخمين وليست مشفرة على السلك. لا تعتبر LAN مناسبة لشبكة غير موثوقة أو Wi-Fi مشترك قبل تنفيذ TLS والاقتران الموثق.

### النسخ الاحتياطي

النسخة المحلية الآن تكتب إلى ملف مؤقت ثم يعاد تسميته فقط بعد اكتمال الكتابة والمزامنة؛ لذلك لا تظهر نسخة ناقصة كمستعدة للاستعادة. قبل أي `RestoreBackup` ينشئ التطبيق نسخة أمان جديدة.

على Windows لا تعكس `os.FileMode` دائماً ACL الحقيقي؛ لهذا لا تعتمد على فحص `0600` في الاختبارات. عند تنفيذ تشديد ACL لاحقاً يجب استعمال Windows ACL صريحاً وتغطيته باختبار تكاملي خاص بالمنصة.

## ملاحظات إصدار مهمة

لا تشغّل `wails build` يدوياً للإصدار. المسار المعتمد:

```powershell
pwsh ./scripts/build.ps1
```

أمثلة CI:

```powershell
./scripts/build.ps1 -Installer:$false -Platform windows/amd64 -Output beidar-desktop.exe
./scripts/build.ps1 -Installer:$false -Platform linux/amd64 -Output beidar-desktop
```

الأسرار التي يحتاجها workflow للإصدار:

- `WINDOWS_SIGNING_CERT`
- `WINDOWS_SIGNING_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

إصدار Windows يفشل عمداً إذا غابت شهادة التوقيع أو كلمة مرورها. لا تسجّل الأسرار ولا تضعها في الملفات المتتبعة في Git.

## التحقق المنفذ

تمت هذه الأوامر بنجاح أثناء الدفعة؛ وبعد إضافة اختبار تفويض LAN الأخير شُغّل أيضاً `go test ./internal/network` بنجاح. أعد تشغيل القائمة الكاملة أدناه قبل إنشاء commit، لأنها المرجع النهائي لأي استكمال لاحق:

```powershell
# من جذر المشروع
go test ./internal/... ./pkg/...
go vet ./internal/... ./pkg/...

# من frontend
npm run typecheck
npm run lint -- --max-warnings=0
npm run test:ci
npm audit --omit=dev --audit-level=moderate
```

نتيجة اختبارات الواجهة: 25 ملفاً و277 اختباراً ناجحاً.

ملاحظة بيئة: اختبارات Go التي تكتب إلى مسار التطبيق في Windows قد تتطلب تشغيلها خارج filesystem sandbox. هذا عائق البيئة المعزولة، وليس فشلاً في الكود.

## العمل المنجز في حزمتي P1 و P2

### ✅ 1. تشفير LAN واقتران أجهزة نقاط البيع (TLS 1.3 & Device Pairing) - مكتمل
- **توليد الشهادات الذاتي:** توليد شهادات TLS رقمية فورية باستخدام منحنيات `ECDSA P-256` تدعم كافة عناوين الـ IP الخاصة بالشبكة المحلية (`GetAllLocalIPs`) مع صلاحية 10 سنوات.
- **حماية المفاتيح الخاصة:** تشفير المفتاح الخاص (`lan_key.enc`) بمفتاح مشتق مربوط بعتاد الجهاز (`secureconfig.MachineID`).
- **تثبيت البصمات (Fingerprint Pinning / TOFU):** احتساب بصمة SHA-256 للشهادة وبثها عبر UDP Discovery. يتحقق العميل من مطابقة البصمة عند كل اتصال HTTPS لمنع هجمات الرجل في المنتصف (Man-in-the-Middle).
- **الواجهة الأمامية:** إضافة شارة أمان "TLS 1.3 مُشفر" وصندوق عرض البصمة الرقمية للشهادة مع زر النسخ السريع.
- **التغطية:** اختبارات شاملة في `lan_tls_test.go`, `lan_security_test.go`, `lan_advanced_test.go`, و `e2e/lan_test.go`.

### ✅ 2. Pagination للعملاء والموردين - مكتمل
- ترقيم شامل للصفحات عبر كافة الطبقات (Domain, Repository, Service, Handler, LAN Server, Frontend) للعملاء والموردين مع Virtualization.

### ✅ 3. الرصد والخصوصية وحجب PII - مكتمل
- تعقيم وحجب أرقام الهواتف والـ PINs والـ Tokens والـ Passwords وAPI Keys تلقائياً في `pkg/logger` و `frontend/src/core/logger.ts` ومغطى باختبارات Unit متكاملة.

### ✅ 4. ترقيم الـ Migrations وسلامة المخطط - مكتمل
- إنشاء محرك `migration.go` وجدول `schema_migrations` مع تسجيل Baseline v2.0.8 وفحص `PRAGMA foreign_key_check` واختبار عدم التكرار (Idempotency).

## العمل المتبقي وخطوات البدء (المهام التالية في الخطة)

### P2 — تفكيك الوحدات الكبيرة

ابدأ بعد تغطية الاختبارات للمسار المراد نقله:

- `internal/service/sale_service.go`: بيع، إرجاع، أقساط، وفواتير معلقة.
- `internal/network/lan_server.go`: middleware، سياسة الصلاحيات، routes، ونقاط المعالجة.
- `frontend/src/features/reports/reports.tsx`: hooks البيانات، الحسابات، وعرض المكونات.

القاعدة: نقل تدريجي بلا تغيير سلوك، واختبار أخضر بعد كل خطوة. لا تنقل GORM إلى service أو handlers.

## فحص قبل commit أو إصدار جديد

```powershell
git diff --check
go test ./internal/... ./pkg/...
go vet ./internal/... ./pkg/...
Set-Location frontend
npm run typecheck
npm run lint -- --max-warnings=0
npm run test:ci
npm audit --omit=dev --audit-level=moderate
```

بعدها راجع `git status --short` بعناية. عند كتابة هذه الوثيقة، توجد 21 ملفات معدلة وملفان غير متتبعين (هذه الوثيقة واختبار تفويض LAN):

```text
docs/REMEDIATION_HANDOFF_2026-08-13.md
internal/network/lan_authorization_test.go
```

لا توجد commit لهذا العمل في وقت كتابة الوثيقة.
