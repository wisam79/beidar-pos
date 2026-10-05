# مسار الإصدار والبناء (Release & Build SOP)

> **الهدف:** إصدار متزامن المواضع، مبني بالسكربت الرسمي، ومتحقق سحابياً.

---

## الخطوة 1: تجميد المحتوى
- تأكد أن كل الأعمال موثقة: `CHANGELOG.md` تحت `[Unreleased]` محدَّث.
- لا كومتات كود بلا توثيق مرافق.

## الخطوة 2: البوابات المحلية
```bash
go test ./internal/... ./pkg/...
go vet ./internal/... ./pkg/...
cd frontend && npm run typecheck && npm run lint && npm run test:ci
node scripts/docs-gate.mjs --strict-refs
```
كلها يجب أن تنجح قبل أي خطوة إصدار. **لا تبنِ قبل نجاح البوابات.**

## الخطوة 3: مزامنة الإصدار
حدّث المواضع الأربعة معاً من الرقم المصدر في `wails.json`:
1. `wails.json` → `info.productVersion` + `info.fileVersion`
2. `frontend/package.json` → `version`
3. `CHANGELOG.md` → حوّل `[Unreleased]` إلى `[x.y.z] - YYYY-MM-DD` وافتح `[Unreleased]` جديداً
4. شارة `Version` في `README.md`

## الخطوة 4: البناء الرسمي
```powershell
pwsh ./scripts/build.ps1 -Installer
```
المخرجات المتوقعة:
- `build/bin/beidar-desktop.exe`
- مثبت NSIS: `build/bin/beidar-desktop-amd64-installer.exe`

> يُمنع `wails build` أو `npm run build` مباشرة — السكربت يحقن الأسرار السحابية.

## الخطوة 5: التحقق السحابي
- ادفع بطلب صريح من المالك فقط.
- راقب CI (وظائف: `go-backend` · `frontend` · `e2e` · `docs-gate`) حتى النجاح الكامل.
- أنشئ الوسم/الإصدار بطلب صريح فقط.

## الخطوة 6: سجل الجلسة
- أضف سجل إصدار في `docs/features-tracker.md` مع تاريخ ومحتوى الإصدار.
- شغّل `node scripts/docs-gate.mjs --push` قبل الدفع.
