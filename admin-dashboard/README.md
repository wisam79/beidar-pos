# لوحة الإدارة — Admin Dashboard (Beidar)

> ⚠️ هذا مشروع فرعي مستقل (`admin-dashboard/`) وهو غير مدمج حالياً في التطبيق الرئيسي.

**Admin Dashboard** هو مشروع React + TypeScript + Vite منفصل يُطوّر كلوحة تحكم إدارية مستقلة (قد تُستخدم كـ Web App أو تُدمج مع Wails لاحقاً).

## التطوير

```bash
cd admin-dashboard
npm install
npm run dev      # خادم تطوير Vite على http://localhost:5173
npm run build    # بناء للإنتاج → dist/
```

## ملاحظات

- هذا المشروع منفصل تماماً عن `frontend/` الرئيسي
- لا يُستخدم في Build الحالي للتطبيق (`wails build`)
- قد يُدمج في الإصدارات المستقبلية كوحدة إدارة منفصلة
