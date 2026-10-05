---
trigger: glob
globs:
  - "pkg/print/**"
  - "internal/service/print_service.go"
  - "internal/handlers/print_handler.go"
  - "frontend/src/components/PrintPortal.tsx"
  - "frontend/src/features/products/components/BarcodeDesigner.tsx"
  - "frontend/src/features/pos/**"
description: "معمارية الطباعة: الطباعة الحرارية الصامتة بالصور، winspool، ملصقات الواجهة، وبديل PDF"
---

# قواعد الطباعة والعتاد (Printing Architecture)

> المصدر الحاكم: `AGENTS.md` القسم 3.7 · المهارة: [`/skills/beidar-printing-pipeline/SKILL.md`](../skills/beidar-printing-pipeline/SKILL.md)

**يُمنع منعاً باتاً تغيير هذه المسارات أو إدخال مكتبات طباعة خارجية جديدة.**

## 1. الطباعة الحرارية (Thermal — Silent Bitmap Print)
المسار المعتمد لإيصالات POS:
1. الواجهة تُصيّر الفاتورة HTML ثم تلتقطها صورة Base64 عبر `html-to-image` (استيراد ديناميكي `toPng`) في [`PrintPortal.tsx`](../../frontend/src/components/PrintPortal.tsx).
2. تُرسل الصورة إلى [`PrintBitmapReceipt`](../../internal/handlers/print_handler.go) (Wails) — الدالة في [`print_service.go`](../../internal/service/print_service.go).
3. الخلفية ترسل الصورة للطابعة عبر `winspool.drv` بأوامر `GS v 0` (raster bitmap) في [`pkg/print/direct.go`](../../pkg/print/direct.go).

- **لا ترسل نصوصاً عربية مباشرة عبر ESC/POS** — الطابعات الحرارية لا تدعم تشكيل العربية بشكل موثوق.
- الطباعة صامتة: لا نوافذ منبثقة ولا حوارات نظام.

## 2. ملصقات الباركود (Labels)
- طباعة الملصقات تتم **كلياً في الواجهة** عبر [`BarcodeDesigner.tsx`](../../frontend/src/features/products/components/BarcodeDesigner.tsx) باستخدام `window.print()` داخل iframe مخفي.
- لا تُرسل الملصقات إلى الواجهة الخلفية.
- توليد الأصول: `jsbarcode` (React) و`skip2/go-qrcode` (Go) — لا مكتبات جديدة.

## 3. البدائل والمرونة (Fallback)
- عند فشل الطابعة أو عدم توفرها: بديل برمجي (توليد PDF عبر `jung-kurt/gofpdf` / فتح ملف) مع رسالة واضحة للمستخدم — لا فشل صامت.
- دعم الطابعات عبر اسم النظام وإعداداتها؛ لا تكتب تعريفات (Drivers) أو Spoolers مخصصة.

## 4. قوائم التحقق قبل أي تعديل طباعة
- [ ] المسار لم يتغير (HTML → Base64 → `PrintBitmapReceipt` → winspool).
- [ ] لا ESC/POS نصي عربي.
- [ ] الملصقات بقيت في الواجهة.
- [ ] بديل الفشل متوفر.
- [ ] `go test ./pkg/print/... ./internal/service/ -run "TestPrint"` ينجح.
