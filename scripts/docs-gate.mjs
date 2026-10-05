#!/usr/bin/env node
/**
 * docs-gate.mjs — بوابة التوثيق الإلزامية (Beidar Documentation Sync Gate)
 *
 * المرجع الحاكم: docs/DOCUMENTATION_MAP.md · الدستور: AGENTS.md
 * المهارة: .agents/skills/beidar-docs-sync-guard/SKILL.md
 *
 * الفحوص:
 *   1) انحراف الأرقام المرجعية (بلوك docs-metrics في الخريطة) مقابل الواقع الفعلي.
 *   2) تغطية الجرد: كل ملف في docs/*.md وكل مجلد فرعي تحت docs/ مُدرَج في الخريطة.
 *   3) كومت/دفعة تغيّر كوداً بلا أي تحديث توثيق مرافق.
 *   4) سلامة مراجع المسارات في AGENTS.md و.agents/ — صارم مع --strict-refs.
 *   5) تأكيدات التحقق على مستوى الكود (CODE_ASSERTIONS) — الثوابت المعمارية
 *      والثغرات المُصلحة يجب أن تبقى مُثبتة بالأسطر، وإلا فشلت البوابة.
 *
 * الاستخدام:
 *   node scripts/docs-gate.mjs                 # قبل الكومت (يفحص الملفات المُجهَّزة)
 *   node scripts/docs-gate.mjs --push          # قبل الدفع (مدى الكومتات غير المدفوعة)
 *   node scripts/docs-gate.mjs --strict-refs   # فحص صارم لمراجع المسارات
 *   node scripts/docs-gate.mjs --ci            # داخل CI (لا يفشل عند غياب تاريخ git)
 *   BEIDAR_DOCS_GATE=off                       # تخطٍّ طارئ مبرَّر (يُذكر السبب في رسالة الكومت)
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAP_PATH = join(ROOT, 'docs', 'DOCUMENTATION_MAP.md');
const ARGS = process.argv.slice(2);
const MODE_PUSH = ARGS.includes('--push');
const STRICT_REFS = ARGS.includes('--strict-refs');
const IN_CI = ARGS.includes('--ci') || String(process.env.CI || '') === 'true';
const DISABLED = String(process.env.BEIDAR_DOCS_GATE || '').toLowerCase() === 'off';

const useColor = !process.env.NO_COLOR;
const paint = (code, text) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : text);
const colors = {
  red: (t) => paint('31', t),
  green: (t) => paint('32', t),
  yellow: (t) => paint('33', t),
  cyan: (t) => paint('36', t),
  dim: (t) => paint('2', t),
};

const errors = [];
const warnings = [];
const notes = [];

function walk(dir, predicate, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, out);
    else if (entry.isFile() && predicate(entry.name, full)) out.push(full);
  }
  return out;
}

/** الأرقام المرجعية القابلة للعدّ من نظام الملفات (سريعة وحتمية). */
function collectMetrics() {
  const isUnitTest = (name) => /\.(test|spec)\.(ts|tsx)$/.test(name);
  return {
    vitest_test_files:
      walk(join(ROOT, 'frontend', 'src'), isUnitTest).length +
      walk(join(ROOT, 'frontend', 'test'), isUnitTest).length,
    e2e_spec_files: walk(join(ROOT, 'frontend', 'e2e'), (name) => /\.spec\.ts$/.test(name)).length,
    go_test_files:
      walk(join(ROOT, 'internal'), (name) => /_test\.go$/.test(name)).length +
      walk(join(ROOT, 'pkg'), (name) => /_test\.go$/.test(name)).length,
    docs_files: readdirSync(join(ROOT, 'docs'), { withFileTypes: true }).filter(
      (e) => e.isFile() && e.name.endsWith('.md'),
    ).length,
  };
}

function readMetricsBlock(mapText) {
  const match = mapText.match(/```docs-metrics\r?\n([\s\S]*?)```/);
  if (!match) return null;
  const metrics = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, value] = trimmed.split('=');
    if (key && value !== undefined) metrics[key.trim()] = Number(value.trim());
  }
  return metrics;
}

function runGit(command) {
  try {
    return execSync(command, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

function firstNonEmpty(lists) {
  for (const list of lists) {
    if (list && list.length) return list;
  }
  return [];
}

function changedFiles() {
  if (!MODE_PUSH) return runGit('git diff --cached --name-only') || [];

  if (IN_CI) {
    const lists = [
      'git diff --name-only origin/main...HEAD',
      'git diff --name-only origin/master...HEAD',
      'git diff --name-only HEAD~1..HEAD',
    ]
      .map(runGit)
      .filter((list) => list !== null);
    return firstNonEmpty(lists);
  }

  const upstream = runGit('git diff --name-only @{u}..HEAD');
  if (upstream !== null) return upstream;

  const fallback = ['git diff --name-only origin/master...HEAD', 'git diff --name-only HEAD~1..HEAD']
    .map(runGit)
    .filter((list) => list !== null);
  return firstNonEmpty(fallback);
}

function checkMetrics(mapText) {
  const documented = readMetricsBlock(mapText);
  if (!documented) {
    errors.push('لا يوجد بلوك ```docs-metrics``` في docs/DOCUMENTATION_MAP.md — أضفه ووثّق الأرقام المرجعية.');
    return;
  }
  const actual = collectMetrics();
  for (const [key, expected] of Object.entries(documented)) {
    const real = actual[key];
    if (real === undefined) {
      warnings.push(`مفتاح أرقام غير معروف في الخريطة: ${key} (لا يقابله عدّ فعلي).`);
      continue;
    }
    if (real !== expected) {
      errors.push(
        `انحراف رقم مرجعي: ${key} موثَّق=${expected} والواقع=${real} — حدّث بلوك docs-metrics في docs/DOCUMENTATION_MAP.md.`,
      );
    }
  }
}

function checkInventory(mapText) {
  const docsDir = join(ROOT, 'docs');
  const required = [
    'README.md',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'AGENTS.md',
    'DESIGN.md',
    '.agents/rules/',
    '.agents/skills/',
    '.agents/agents/',
    '.agents/workflows/',
  ];
  for (const entry of readdirSync(docsDir, { withFileTypes: true })) {
    if (entry.isDirectory()) required.push(`docs/${entry.name}/`);
    else if (entry.name.endsWith('.md')) required.push(`docs/${entry.name}`);
  }
  const missing = required.filter((item) => !mapText.includes(item));
  if (missing.length) {
    errors.push(
      `مستندات/مجلدات غير مُسجَّلة في جرد docs/DOCUMENTATION_MAP.md:\n    - ${missing.join('\n    - ')}`,
    );
  } else {
    notes.push(`الجرد مكتمل (${required.length} مدخلاً).`);
  }
}

const SOURCE_PATTERNS = [
  'internal/',
  'pkg/',
  'frontend/src/',
  'frontend/e2e/',
  'scripts/',
  '.github/workflows/',
  'supabase/',
  'app.go',
  'main.go',
  'wails.json',
];

const DOC_PATTERNS = ['CHANGELOG.md', 'README.md', 'docs/', 'AGENTS.md', '.agents/', 'CONTRIBUTING.md'];

function checkDocumentedCommit() {
  const files = changedFiles();
  if (!files.length) {
    notes.push(
      MODE_PUSH
        ? 'لا كومتات غير مدفوعة تحتاج فحصاً — اقتُصر الفحص على الأرقام والجرد والتأكيدات.'
        : 'لا ملفات مُجهَّزة للكومت — اقتُصر الفحص على الأرقام والجرد والتأكيدات.',
    );
    return;
  }
  const sourceTouched = files.filter((file) => SOURCE_PATTERNS.some((p) => file === p || file.startsWith(p)));
  const docsTouched = files.filter((file) => DOC_PATTERNS.some((p) => file === p || file.startsWith(p)));
  if (sourceTouched.length && !docsTouched.length) {
    errors.push(
      `هذه التغييرات تمسّ الكود بلا أي تحديث توثيق مرافق (${sourceTouched.length} ملفاً):\n` +
        `    - ${sourceTouched.slice(0, 8).join('\n    - ')}${sourceTouched.length > 8 ? '\n    - …' : ''}\n` +
        '    المطلوب: حدّث CHANGELOG.md تحت [Unreleased] + المستند المعني وفق مصفوفة المزامنة في docs/DOCUMENTATION_MAP.md.',
    );
  } else if (sourceTouched.length) {
    notes.push(`كومت موثَّق: ${sourceTouched.length} ملف كود + ${docsTouched.length} ملف توثيق.`);
  }
}

const REF_ROOTS = [
  '.agents/',
  '.husky/',
  'frontend/',
  'internal/',
  'pkg/',
  'docs/',
  'scripts/',
  'supabase/',
  '.github/',
];

function referenceTargets() {
  const targets = [join(ROOT, 'AGENTS.md')];
  const rulesDir = join(ROOT, '.agents', 'rules');
  if (existsSync(rulesDir)) {
    for (const entry of readdirSync(rulesDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md')) targets.push(join(rulesDir, entry.name));
    }
  }
  const skillsDir = join(ROOT, '.agents', 'skills');
  if (existsSync(skillsDir)) {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillFile = join(skillsDir, entry.name, 'SKILL.md');
      if (existsSync(skillFile)) targets.push(skillFile);
    }
  }
  const agentsDir = join(ROOT, '.agents', 'agents');
  if (existsSync(agentsDir)) {
    for (const entry of readdirSync(agentsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const agentFile = join(agentsDir, entry.name, 'agent.md');
      if (existsSync(agentFile)) targets.push(agentFile);
    }
  }
  const workflowsDir = join(ROOT, '.agents', 'workflows');
  if (existsSync(workflowsDir)) {
    for (const entry of readdirSync(workflowsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md')) targets.push(join(workflowsDir, entry.name));
    }
  }
  return targets;
}

function checkReferences(mapText) {
  const ignoreMatch = mapText.match(/<!--\s*docs-gate:ignore-refs([\s\S]*?)-->/);
  const ignoreList = (ignoreMatch ? ignoreMatch[1].replace(/\([^)]*\)/g, '') : '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const missing = new Set();
  for (const file of referenceTargets()) {
    const text = readFileSync(file, 'utf8');
    for (const raw of text.matchAll(/`([^`\n]+)`/g)) {
      let token = raw[1].trim().replace(/^["'(]+|["'),.;:]+$/g, '');
      token = token.replace(/:\d+(-\d+)?$/, '');
      if (!token.includes('/')) continue;
      if (!REF_ROOTS.some((root) => token.startsWith(root))) continue;
      if (/[*{}<>|$=\s]/.test(token) || token.includes('...')) continue;
      if (ignoreList.some((ignored) => token === ignored || token.startsWith(ignored))) continue;
      if (!existsSync(join(ROOT, token))) missing.add(`${token}  ←  ${file.replace(ROOT, '.')}`);
    }
  }

  if (missing.size) {
    const list = [...missing].sort();
    const message =
      `مراجع مسارات غير موجودة في AGENTS.md و.agents/ (${list.length}):\n    - ${list.slice(0, 12).join('\n    - ')}` +
      `${list.length > 12 ? '\n    - …' : ''}`;
    if (STRICT_REFS) errors.push(message);
    else warnings.push(`${message}\n    (تحذير فقط — شغّل --strict-refs لجعلها مُعِقة.)`);
  } else {
    notes.push('كل مراجع المسارات في AGENTS.md و.agents/ موجودة فعلياً.');
  }
}

/**
 * تأكيدات التحقق على مستوى الكود (code-assertions).
 *
 * كل ثابت معماري أو عيب مُصلح مُثبت نصياً كي لا يعود الانحراف صامتاً:
 * إرجاع عيب مغلق إلى الكود يجب أن يُفشل البوابة، لا أن يمر كادعاء قديم.
 *
 * form: { label, file, mustContain, mustNotContain, count: [{ needle, equals }] }
 */
const CODE_ASSERTIONS = [
  {
    label: 'ARCH-01 — قفل الاتصال الواحد ووضع WAL (SQLite في بيئة LAN)',
    file: 'internal/repository/db.go',
    mustContain: ['sqlDB.SetMaxOpenConns(1)', 'PRAGMA journal_mode=WAL;'],
  },
  {
    label: 'ARCH-02 — دقة المال: Amount (int64 cents) وواجهة الضرائب والتقريب',
    file: 'internal/core/domain/money.go',
    mustContain: [
      'func (a Amount) MulFloat(factor float64) Amount',
      'func (a Amount) Percentage(p float64) Amount',
      'func (a Amount) RoundToNearest(unit Amount) Amount',
    ],
  },
  {
    label: 'FIN-01 — حماية الأقساط: دفعة أولى ≤ الإجمالي + تقريب 250 دينار + تسوية الشهر الأخير',
    file: 'internal/service/payment_service.go',
    mustContain: [
      'if downPayment > total {',
      'roundedBase := rawPerMonth.RoundToNearest(unit)',
      'amount = remaining - roundedBase*domain.Amount(months-1)',
    ],
  },
  {
    label: 'FIN-02 — القفل المتشائم والتحديث الذري لأرصدة العملاء',
    file: 'internal/repository/customer_repo.go',
    mustContain: ['clause.Locking{Strength: "UPDATE"}', 'gorm.Expr("points + ?", delta)'],
  },
  {
    label: 'SEC-01 — التحقق من الرمز السري بـ bcrypt مع Tarpitting (لا Lockout)',
    file: 'internal/service/admin_pin.go',
    mustContain: ['bcrypt.CompareHashAndPassword', 'adminPinFailures++', 'delay = 15 * time.Second'],
  },
  {
    label: 'SEC-02 — المقارنة الزمنية الثابتة لرموز جلسات LAN',
    file: 'internal/network/lan_clients.go',
    mustContain: ['subtle.ConstantTimeCompare'],
  },
  {
    label: 'SEC-03 — تعقيم CSV ضد Formula Injection',
    file: 'internal/service/backup_service.go',
    mustContain: ['sanitizeCSVField := func(val string) string {', "return \"'\" + val"],
  },
  {
    label: 'LAN-01 — اكتشاف UDP على 9765 ببصمة BEIDAR_POS_V1 ورفض الأقدم من 30 ثانية',
    file: 'internal/network/lan_discovery.go',
    mustContain: ['DiscoveryPort', 'BEIDAR_POS_V1', '(now-msg.Timestamp) > 30'],
  },
  {
    label: 'LAN-02 — سياسة الأدوار المغلقة fail-closed لمسارات LAN',
    file: 'internal/network/lan_server.go',
    mustContain: [
      'func lanRoleAllows(role domain.Role, method, path string) bool {',
      '!lanRoleAllows(domain.Role(client.Role), r.Method, r.URL.Path)',
    ],
  },
  {
    label: 'LAN-03 — سقف قراءة استجابات LAN (10MB) ضد استنزاف الذاكرة',
    file: 'internal/network/lan_client.go',
    mustContain: ['io.LimitReader(resp.Body, 10<<20)'],
  },
  {
    label: 'LAN-04 — ترخيص طلبات LAN بهوية الجهاز المُتحقق (Actor) لا بجلسة سطح المكتب',
    file: 'internal/network/lan_server.go',
    mustContain: [
      'ctx := context.WithValue(r.Context(), lanClientContextKey{}, client)',
      'ProcessSaleAs(lanActor(lanClientFrom(r)), &sale)',
      's.staffService.GetStaff(sale.StaffID)',
    ],
  },
  {
    label: 'LAN-05 — ثبات سر إقران LAN عبر إعادة التشغيل (تخزين مشفر بمفتاح الجهاز)',
    file: 'internal/network/lan_server_secret_store.go',
    mustContain: [
      'func (fileServerSecretStore) Set(secret string) error {',
      'crypto.Decrypt(string(data), deriveLanTLSKey())',
      "'lan_server_secret.enc'",
    ],
  },
  {
    label: 'LAN-06 — استرجاع السر المحفوظ قبل بدء خدمة LAN',
    file: 'internal/network/lan_server.go',
    mustContain: ['if err := s.ensureServerSecret(); err != nil {'],
  },
  {
    label: 'UI-04 — عرض رمز الإقران على الخادم وحقل إلزامي على العميل',
    file: 'frontend/src/components/LanSyncPanel.tsx',
    mustContain: ['api.lan.getServerSecret()', '!serverSecret.trim()'],
  },
  {
    label: 'SEC-04 — فحص الصلاحية على الطالب الصريح (Actor) في طبقة الخدمة',
    file: 'internal/service/sale_service.go',
    mustContain: [
      'func (s *saleService) ProcessSaleAs(actor domain.Actor, sale *domain.Sale) error {',
      'auth.RequirePermissionFor(actor, auth.PermDiscounts)',
    ],
    // الفحص القديم كان يقرأ الجلسة العالمية لسطح المكتب — لا يجوز أن يعود
    mustNotContain: ['auth.RequirePermission(auth.PermDiscounts)'],
  },
  {
    label: 'SESSION-01 — انتهاء جلسة الخمول بعد 12 ساعة',
    file: 'pkg/auth/session.go',
    mustContain: ['DefaultIdleSessionTimeout = 12 * time.Hour'],
  },
  {
    label: 'DB-MIG-01 — المهاجرات المرقمة داخل معاملة مع فحص المفاتيح الأجنبية',
    file: 'internal/repository/migration.go',
    mustContain: [
      'var registeredMigrations = []Migration{',
      'db.Transaction(func(tx *gorm.DB) error',
      'PRAGMA foreign_key_check;',
    ],
    // الاسم القديم الخاطئ في الدستور السابق — لا يجوز أن يعود
    mustNotContain: ['var allMigrations'],
  },
  {
    label: 'PRINT-01 — مسار الطباعة الصامتة بالصور عبر winspool (GS v 0)',
    file: 'pkg/print/direct.go',
    mustContain: ['NewLazyDLL("winspool.drv")', 'GS v 0'],
  },
  {
    label: 'PRINT-02 — جسر طباعة BitmapReceipt مُصدَّر في طبقة handlers',
    file: 'internal/handlers/print_handler.go',
    mustContain: ['func (h *PrintHandler) PrintBitmapReceipt(printerName, base64Image string) error {'],
  },
  {
    label: 'PRINT-03 — التقاط الإيصال في الواجهة عبر html-to-image',
    file: 'frontend/src/components/PrintPortal.tsx',
    mustContain: ["await import('html-to-image')"],
  },
  {
    label: 'UI-01 — الالتقاط الصامت للباركود مستخدم في شاشة البيع',
    file: 'frontend/src/features/pos/views/SalesPage.tsx',
    mustContain: ['useUsbScannerDetection'],
  },
  {
    label: 'UI-02 — عناوين لوحة الانطلاق هي مصدر التسميات الموحدة',
    file: 'frontend/src/features/dashboard/dashboard.tsx',
    mustContain: ["title: 'المبيعات'", "title: 'المنتجات'", "title: 'الورديات'"],
  },
  {
    label: 'UI-03 — الافتراضية في شبكة منتجات نقطة البيع',
    file: 'frontend/src/features/pos/components/VirtualProductGrid.tsx',
    mustContain: ["from '@tanstack/react-virtual'"],
  },
  {
    label: 'CI-01 — وظيفة docs-gate في خط CI',
    file: '.github/workflows/ci.yml',
    mustContain: ['node scripts/docs-gate.mjs --push --ci'],
  },
  {
    label: 'HOOK-01 — بوابة pre-commit مفعَّلة مرة واحدة بلا تكرار',
    file: 'frontend/.husky/pre-commit',
    count: [{ needle: 'scripts/docs-gate.mjs', equals: 1 }],
  },
];

function checkCodeAssertions() {
  const missingFiles = [];
  for (const assertion of CODE_ASSERTIONS) {
    const full = join(ROOT, ...assertion.file.split('/'));
    if (!existsSync(full)) {
      missingFiles.push(`${assertion.file}  ←  ${assertion.label}`);
      continue;
    }
    const text = readFileSync(full, 'utf8');
    const lines = text.split(/\r?\n/);
    const normalizeQuotes = (str) => str.replace(/["']/g, '"');
    const hits = (needle) =>
      lines.findIndex(
        (line) => line.includes(needle) || normalizeQuotes(line).includes(normalizeQuotes(needle)),
      ) + 1;

    for (const needle of assertion.mustContain ?? []) {
      if (hits(needle) === 0) {
        errors.push(
          `انحراف تأكيد كود (${assertion.label}):\n` +
            `    العبارة المفترضة غير موجودة: ${needle}\n` +
            `    في الملف: ${assertion.file}`,
        );
      }
    }
    for (const needle of assertion.mustNotContain ?? []) {
      const line = hits(needle);
      if (line > 0) {
        errors.push(
          `انحراف تأكيد كود (${assertion.label}):\n` +
            `    عبارة ممنوعة عادت للملف ${assertion.file}:${line} ⇒ ${needle}\n` +
            '    إن كان العيب قد عاد فعلاً فصحّح الكود وأضف تصحيحاً مؤرخاً في التوثيق؛ لا تُسقط التأكيد.',
        );
      }
    }
    for (const rule of assertion.count ?? []) {
      const found = lines.filter((line) => line.includes(rule.needle)).length;
      if (found !== rule.equals) {
        errors.push(
          `انحراف تأكيد كود (${assertion.label}):\n` +
            `    تكرار غير متوقع لعبارة في ${assertion.file}: المتوقع ${rule.equals} والواقع ${found}\n` +
            `    ⇒ ${rule.needle}`,
        );
      }
    }
  }

  if (missingFiles.length) {
    errors.push(
      `ملفات مفترضة لتأكيدات التحقق غير موجودة (${missingFiles.length}):\n    - ${missingFiles.join('\n    - ')}`,
    );
  } else {
    notes.push(`تأكيدات التحقق على الكود سليمة (${CODE_ASSERTIONS.length} تأكيداً).`);
  }
}

function main() {
  console.log(colors.cyan(`\n📚 بوابة التوثيق (docs-gate) — الوضع: ${MODE_PUSH ? 'قبل الدفع' : 'قبل الكومت'}`));

  if (DISABLED) {
    console.log(colors.yellow('  ⚠️  BEIDAR_DOCS_GATE=off — تم تخطّي البوابة (يجب تبريره في رسالة الكومت).\n'));
    process.exit(0);
  }

  if (!existsSync(MAP_PATH)) {
    console.log(colors.red('  ⛔ docs/DOCUMENTATION_MAP.md غير موجود — لا يمكن التحقق من التوثيق.\n'));
    process.exit(1);
  }

  const mapText = readFileSync(MAP_PATH, 'utf8');
  checkMetrics(mapText);
  checkInventory(mapText);
  checkDocumentedCommit();
  checkReferences(mapText);
  checkCodeAssertions();

  for (const note of notes) console.log(colors.dim(`  · ${note}`));
  for (const warning of warnings) console.log(colors.yellow(`  ⚠️  ${warning}`));
  for (const error of errors) console.log(colors.red(`  ⛔ ${error}`));

  if (errors.length) {
    console.log(
      colors.red(
        `\n  ❌ فشلت بوابة التوثيق (${errors.length} خطأ). راجع docs/DOCUMENTATION_MAP.md — القسم 2 (المصفوفة) والقسم 3 (البوابات).\n`,
      ),
    );
    process.exit(1);
  }

  console.log(colors.green('\n  ✅ التوثيق متزامن مع الكود — البوابة ناجحة.\n'));
}

main();
