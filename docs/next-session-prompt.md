# برومت استكمال العمل على بيدر — انسخه في محادثة جديدة

> انسخ كل ما يلي (من الخط الفاصل التالي حتى نهاية الملف) والصقه كأول رسالة في محادثة جديدة.

---

# استكمال تطوير وتثبيت Beidar POS & ERP

أنت تعمل في مشروع `C:\projects\beidar` (بيدر — نظام ERP/POS لسطح المكتب: Go 1.25 + Wails v2.12 + GORM/SQLite في الخلفية، React 18 + Vite + Tailwind + Zustand + React Query في الواجهة).

اقرأ أولاً هذه الملفات قبل أي كود:
1. `AGENTS.md` — الدستور الحاكم والثوابت المطلقة.
2. `docs/DOCUMENTATION_MAP.md` — **خريطة التوثيق الإلزامية** (الجرد + مصفوفة المزامنة + البوابات + الأرقام المرجعية).
3. `docs/features-tracker.md` — حالة الميزات والجلسات والقرارات المحمية والفجوات.
4. قاعدة النطاق والمهارة المعنية من `.agents/rules/` و`.agents/skills/` حسب مجال العمل.

> 🔒 **إلزام:** قبل بدء العمل أعلن المستندات التي سيتغيرها العمل، وقبل أي كومت/دفع شغّل `node scripts/docs-gate.mjs --strict-refs` (مفروض آلياً عبر `frontend/.husky/pre-commit` و`frontend/.husky/pre-push` ووظيفة `docs-gate` في CI). **لا رقم من الذاكرة** — الأرقام المرجعية في الخريطة القسم 4 بأوامرها.

## أبرز القواعد الحرجة (التفصيل في الدستور والقواعد)
- العمارة النظيفة: `handlers → service → repository → domain`، وتُمنع GORM في service/handlers.
- المال حصراً `domain.Amount` (int64 cents)؛ الأقساط بتقريب 250 دينار والقسط الأخير بالمتبقي.
- SQLite: `WAL` + `MaxOpenConns(1)` لا يُكسران؛ العمليات المالية داخل معاملات مع أقفال.
- المهاجرات مرقمة في `registeredMigrations` في `internal/repository/migration.go` — لا تعدّل مهاجرة مطبقة.
- الطباعة: مسار الصور الصامت (لا ESC/POS عربي) والملصقات في الواجهة.
- الأمان: bcrypt + Tarpitting، مقارنة زمنية ثابتة، تعقيم CSV، صلاحيات خلفية إلزامية.
- البناء حصراً: `pwsh ./scripts/build.ps1` — لا تبنِ إلا بطلب صريح.

## أوامر التحقق قبل الإنهاء
```bash
go test ./internal/... ./pkg/...
go vet ./internal/... ./pkg/...
cd frontend && npm run typecheck && npx vitest run --fileParallelism=false
node scripts/docs-gate.mjs --strict-refs
```
عند تغيير واجهة/مسار/Handler: زامن `frontend/e2e/mock-wails.ts` وشغّل `npm run test:e2e`.

## ماذا أُنجز في الجلسة السابقة (2026-10-05)
تأسيس نظام إدارة الوكلاء والتوثيق بالاستفادة من تجربة مشروع Grido:
- طبقات تعليمات كاملة في `.agents/` (9 قواعد + 8 مهارات + 10 وكلاء + 5 مسارات عمل) ودستور جذري مفهرس.
- بوابة توثيق آلية `scripts/docs-gate.mjs` (أرقام مرجعية + جرد + كومت موثق + مراجع مسارات + تأكيدات كود) وسكربت مقاييس `scripts/quality-metrics.mjs`.
- `docs/DOCUMENTATION_MAP.md` + `docs/features-tracker.md` + هذا الملف، وربط البوابات بـ Husky وCI، وتصحيح مرجع `allMigrations` ونسخة CI من Go.

## الأولويات المقترحة للجلسة القادمة
1. تنفيذ جولة التدقيق الشاملة (الوكلاء العشرة) وفق `.agents/workflows/comprehensive-audit.md` وتسجيل النتائج في المتتبع.
2. حسم انحراف `DESIGN.md` الجذر مقابل `docs/DESIGN.md` (قرار المالك مطلوب).
3. إكمال مصفوفة الميزات في المتتبع من 🔍 إلى ✅ بأدلة `ملف:سطر`.
4. أي ميزة/إصلاح يطلبه المالك مع الالتزام بمصفوفة المزامنة في الخريطة.

## قيود ثابتة
- لا `commit` ولا `push` بلا طلب صريح.
- لا تحذف ميزة قائمة ولا تُعد ملفات توثيق تاريخي.
- عند تعارض أي تعليمات مع `AGENTS.md` — الدستور هو الحاكم.
