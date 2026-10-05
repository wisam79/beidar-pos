# مسار التدقيق الشامل من الألف إلى الياء (10-Agent Audit SOP)

> **الهدف:** جولة مراجعة كاملة بمصفوفة الوكلاء العشرة، بمخرجات مثبتة بالأدلة، وإغلاق الفجوات المنفذة.

> عند طلب مراجعة شاملة للتطبيق، تُقسَّم المهمة على الوكلاء العشرة في `.agents/agents/` بالترتيب.

---

## المرحلة 1: الاستنفار (قبل أي إصلاح)
1. اقرأ `AGENTS.md` + `docs/DOCUMENTATION_MAP.md` + `docs/features-tracker.md`.
2. **لا تعديلات أثناء التدقيق** — الجولة الأولى جمع أدلة فقط.
3. شغّل خط الأساس:
   ```bash
   go test ./internal/... ./pkg/...
   go vet ./internal/... ./pkg/...
   cd frontend && npm run typecheck && npm run lint && npx vitest run --fileParallelism=false
   node scripts/docs-gate.mjs --strict-refs
   node scripts/quality-metrics.mjs
   ```

## المرحلة 2: الوكلاء العشرة (تقرير لكل وكيل)
| # | الوكيل | نطاقه الأساسي |
|---|---|---|
| 1 | `core_domain_architect` | عزل domain ومنع تسرب GORM وAmount |
| 2 | `database_concurrency_engineer` | WAL · الأقفال · Atomic · المهاجرات |
| 3 | `financial_logic_guardian` | الفواتير · الأقساط · CRM · العقود |
| 4 | `lan_network_warden` | UDP · `lanRoleAllows` · الجلسات · التحصين |
| 5 | `security_crypto_officer` | bcrypt · PBKDF2 · الصلاحيات · CSV · PII |
| 6 | `hardware_printing_engineer` | الطباعة الصامتة · winspool · الملصقات · Fallback |
| 7 | `wails_ipc_bridge_keeper` | عقود التصدير · `initHandlers` · Mock E2E |
| 8 | `frontend_state_performance_engineer` | Zustand · Query · Virtualization · Logger |
| 9 | `pos_ux_designer` | Dual-Pane · الأيقونات · تطابق التسميات · RTL |
| 10 | `qa_release_gatekeeper` | البوابات · البناء · مزامنة الإصدار |

**قاعدة الدليل:** كل ملاحظة تحمل: الوصف · الخطورة · `ملف:سطر` · سيناريو الأثر · الإصلاح المقترح. لا ملاحظة بلا دليل.

## المرحلة 3: التوحيد والفرز
- اجمع التقارير في قائمة واحدة بلا تكرار.
- صنّف: حرج / عالي / متوسط / منخفض.
- احذف المواضيع المكررة أو المتعارضة، وحدّد الفجوات المحمية بقرارات موثقة (تحتاج موافقة المالك).

## المرحلة 4: الإصلاح (بدفعات)
- حرج ← عالي ← متوسط ← منخفض، مع اختبار لكل إصلاح.
- أي بند مغلق: أضف **تأكيد كود** في `scripts/docs-gate.mjs` (CODE_ASSERTIONS) إن كان قابلاً للتثبيت النصي، ليمنع عودة العيب صامتاً.
- **يُمنع** حذف أو إضعاف تأكيد قائم.

## المرحلة 5: الإغلاق والتوثيق
- حدّث `CHANGELOG.md` + `docs/features-tracker.md` (سجل جلسة بالأدلة) والمستندات المتخصصة.
- أضف تقرير الجولة في `docs/` إن كان جوهرياً وسجّله في الجرد.
- شغّل البوابات كاملة حتى النجاح، ثم `node scripts/docs-gate.mjs --strict-refs`.
