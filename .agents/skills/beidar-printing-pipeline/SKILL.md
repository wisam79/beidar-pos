---
name: beidar-printing-pipeline
description: خط أنابيب الطباعة في بيدر — الطباعة الحرارية الصامتة بالصور وwinspool وملصقات الواجهة وبدائل الفشل
---

# 🖨️ خط أنابيب الطباعة (Printing Pipeline)

القاعدة النطاقية: [`.agents/rules/printing-hardware.md`](../rules/printing-hardware.md)

## 1. لماذا الصور لا النصوص؟
الطابعات الحرارية لا تدعم تشكيل العربية (اتصال الحروف) عبر ESC/POS. لذلك يعتمد بيدر **الطباعة الصامتة بالصور**:
تصيير HTML بالواجهة ← صورة نقطية ← أوامر Raster (`GS v 0`).

## 2. المسار الكامل (مُتحقق منه)
```
frontend: PrintPortal.tsx
  └─ const { toPng } = await import('html-to-image')   // التقاط الإيصال/الفاتورة
      └─ api.print.bitmapReceipt(printerName, base64)   // جسر Wails
internal/handlers/print_handler.go → PrintBitmapReceipt(printerName, base64Image)
internal/service/print_service.go  → print.PrintBitmapReceipt(...)
pkg/print/direct.go
  ├─ winspool.drv: OpenPrinterW → StartDocPrinterW → WritePrinter
  └─ imageToBitmapData: raster GS v 0 (escpos)
```

## 3. قواعد ملزمة
- **ممنوع** إرسال نص عربي خام إلى ESC/POS أو تغيير هذا المسار.
- **ممنوع** إدخال مكتبة طباعة خارجية جديدة.
- لا نوافذ منبثقة ولا حوارات نظام أثناء الطباعة الصامتة.
- اسم الطابعة يأتي من إعدادات النظام؛ لا تفترض طابعة افتراضية.

## 4. الملصقات (Labels)
- كلياً في الواجهة عبر [`BarcodeDesigner.tsx`](../../frontend/src/features/products/components/BarcodeDesigner.tsx): `window.print()` داخل iframe مخفي.
- لا تمر ملصقات عبر الخلفية إطلاقاً.
- توليد الباركود: `jsbarcode` في React.

## 5. فواتير A4 وPDF
- فواتير A4/PDF تُولَّد عبر `jung-kurt/gofpdf` في الخلفية.
- عند فشل الطابعة الحرارية: بديل PDF + رسالة واضحة (لا فشل صامت).

## 6. التحقق
```bash
go test ./pkg/print/... ./internal/service/ -run "TestPrint"
```

وفي الواجهة: اختبر `PrintPortal` عبر Vitest، وتأكد أن الاستيراد الديناميكي `html-to-image` ما زال يعمل في حزمة الإنتاج.
