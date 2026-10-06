#!/usr/bin/env node
/**
 * coverage-gate.mjs — بوابة تغطية Go (Beidar Coverage Gate)
 *
 * المرجع الحاكم: docs/DOCUMENTATION_MAP.md · الدستور: AGENTS.md
 *
 * الوظائف:
 *   1) قراءة ملف coverprofile الناتج من `go test -coverprofile=...`.
 *   2) طباعة جدول تغطية لكل حزمة (الأدنى أولاً — أرخص مواضع كسب التغطية).
 *   3) كتابة ملخص Markdown في `GITHUB_STEP_SUMMARY` عند التشغيل داخل GitHub Actions.
 *   4) العمل كسقّاطة (ratchet): الفشل إذا نزل الإجمالي تحت عتبة `--min`.
 *
 * الاستخدام:
 *   go test -p 4 -covermode=atomic -coverpkg=./internal/...,./pkg/... \
 *     -coverprofile=coverage.out ./internal/... ./pkg/...
 *   node scripts/coverage-gate.mjs --profile=coverage.out            # تقرير فقط
 *   node scripts/coverage-gate.mjs --profile=coverage.out --min=48.5 # بوابة عتبة
 *   node scripts/coverage-gate.mjs --profile=coverage.out --top=10   # أقصر جدول
 *
 * رموز الخروج: 0 = نجاح · 1 = انخفاض تحت العتبة · 2 = ملف مفقود أو غير قابل للقراءة.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARGS = process.argv.slice(2);
const argValue = (name, fallback = '') => {
  const hit = ARGS.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const PROFILE = resolve(ROOT, argValue('profile', 'coverage.out'));
const MIN_RAW = argValue('min', '').trim();
const TOP = Number(argValue('top', '0')) || 0;

const useColor = !process.env.NO_COLOR;
const paint = (code, text) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : text);
const colors = {
  red: (t) => paint('31', t),
  green: (t) => paint('32', t),
  yellow: (t) => paint('33', t),
  cyan: (t) => paint('36', t),
  dim: (t) => paint('2', t),
};

const formatPercent = (value) => `${value.toFixed(1)}%`;
const formatCount = (value) => value.toLocaleString('en-US');

/**
 * يحوّل مسار الاستيراد الكامل في الملف (مثل beidar-desktop/internal/service/x.go)
 * إلى مسار نسبي للجذر (internal/service/x.go) كي يبقى الجدول مقروءاً ومستقراً
 * مهما كان اسم الموديول.
 */
function repoPath(importPath) {
  for (const marker of ['/internal/', '/pkg/', '/cmd/', '/frontend/']) {
    const index = importPath.indexOf(marker);
    if (index >= 0) return importPath.slice(index + 1);
  }
  const slash = importPath.indexOf('/');
  return slash >= 0 ? importPath.slice(slash + 1) : importPath;
}

function parseArgs() {
  if (ARGS.includes('--help') || ARGS.includes('-h')) {
    process.stdout.write(
      'الاستخدام: node scripts/coverage-gate.mjs [--profile=coverage.out] [--min=NN.N] [--top=N]\n',
    );
    process.exit(0);
  }
  if (MIN_RAW && Number.isNaN(Number(MIN_RAW))) {
    process.stderr.write(`⛔ عتبة غير صالحة: --min=${MIN_RAW}\n`);
    process.exit(2);
  }
}

/** يقرأ الملف ويُرجع { files, packages, totals } أو null عند الفشل مع سبب مطبوع. */
function readProfile() {
  if (!existsSync(PROFILE)) {
    process.stderr.write(
      `⛔ ملف التغطية غير موجود: ${PROFILE}\n` +
        '   أنشئه أولاً: go test -covermode=atomic -coverprofile=coverage.out ./internal/... ./pkg/...\n',
    );
    return null;
  }

  const lines = readFileSync(PROFILE, 'utf8').split(/\r?\n/);
  const modeLine = lines.find((line) => line.startsWith('mode:'));
  if (!modeLine) {
    process.stderr.write(`⛔ ملف تغطية غير صالح (لا يحتوي سطر mode): ${PROFILE}\n`);
    return null;
  }

  const packages = new Map();
  const files = new Map();
  const totals = { statements: 0, covered: 0, blocks: 0 };

  for (const line of lines) {
    if (!line || line.startsWith('mode:')) continue;
    const [location, statementsRaw, countRaw] = line.split(' ');
    const separator = location.lastIndexOf(':');
    if (separator < 0) continue;

    const rawPath = location.slice(0, separator);
    const statements = Number(statementsRaw);
    const count = Number(countRaw);
    if (!Number.isFinite(statements) || !Number.isFinite(count)) continue;

    const relative = repoPath(rawPath);
    const bucket = relative.slice(0, relative.lastIndexOf('/')) || '.';

    totals.statements += statements;
    totals.blocks += 1;
    if (count > 0) totals.covered += statements;

    const pkg = packages.get(bucket) ?? { statements: 0, covered: 0, blocks: 0, files: 0 };
    pkg.statements += statements;
    pkg.blocks += 1;
    if (count > 0) pkg.covered += statements;
    packages.set(bucket, pkg);

    if (!files.has(relative)) {
      files.set(relative, true);
      pkg.files += 1;
    }
  }

  if (totals.statements === 0) {
    process.stderr.write(`⛔ لا عبارات قابلة للقياس في: ${PROFILE}\n`);
    return null;
  }

  return { mode: modeLine.slice('mode:'.length).trim(), packages, files, totals };
}

function buildRows(packages) {
  return [...packages.entries()]
    .map(([name, pkg]) => ({
      name,
      percent: (pkg.covered / pkg.statements) * 100,
      uncovered: pkg.statements - pkg.covered,
      statements: pkg.statements,
      files: pkg.files,
    }))
    .sort((a, b) => a.percent - b.percent || b.uncovered - a.uncovered);
}

function printReport(rows, totals, fileCount, mode) {
  const totalPercent = (totals.covered / totals.statements) * 100;
  const shown = TOP > 0 ? rows.slice(0, TOP) : rows;

  process.stdout.write('\n');
  process.stdout.write(`📈 ${colors.cyan('بوابة تغطية Go (coverage-gate)')}\n`);
  process.stdout.write(
    `  · الملف: ${PROFILE.replace(`${ROOT}\\`, '').replace(`${ROOT}/`, '')} · الوضع: ${mode}\n`,
  );
  process.stdout.write(
    `  · الحزم: ${rows.length} · الملفات: ${formatCount(fileCount)} · العبارات: ${formatCount(totals.statements)}\n`,
  );
  if (MIN_RAW) {
    process.stdout.write(`  · العتبة: ${colors.dim(`${MIN_RAW}%`)}\n`);
  } else {
    process.stdout.write(`  · العتبة: ${colors.dim('غير محددة (تقرير فقط)')}\n`);
  }
  process.stdout.write('\n');

  const nameWidth = Math.max(...shown.map((row) => row.name.length), 12);
  process.stdout.write(
    `  ${'الحزمة'.padEnd(nameWidth)}  ${'التغطية'.padStart(8)}  ${'غير مغطى'.padStart(10)}  ${'ملفات'.padStart(5)}\n`,
  );
  process.stdout.write(`  ${'-'.repeat(nameWidth + 30)}\n`);
  for (const row of shown) {
    const tone = row.percent < 40 ? colors.red : row.percent < 70 ? colors.yellow : colors.green;
    process.stdout.write(
      `  ${row.name.padEnd(nameWidth)}  ${tone(formatPercent(row.percent).padStart(8))}  ${formatCount(row.uncovered).padStart(10)}  ${String(row.files).padStart(5)}\n`,
    );
  }
  process.stdout.write(`  ${'-'.repeat(nameWidth + 30)}\n`);
  process.stdout.write(
    `  ${'الإجمالي'.padEnd(nameWidth)}  ${colors.cyan(formatPercent(totalPercent).padStart(8))}  ${formatCount(totals.statements - totals.covered).padStart(10)}\n\n`,
  );

  return totalPercent;
}

function writeStepSummary(rows, totals, totalPercent, mode) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const shown = TOP > 0 ? rows.slice(0, TOP) : rows;
  const lines = [
    '## 📈 تغطية Go (coverage-gate)',
    '',
    `- الوضع: \`${mode}\``,
    `- العبارات: **${formatCount(totals.covered)} / ${formatCount(totals.statements)}**`,
    `- الإجمالي: **${formatPercent(totalPercent)}**`,
    MIN_RAW ? `- العتبة (ratchet): **${MIN_RAW}%**` : '- العتبة: غير محددة',
    '',
    '| الحزمة | التغطية | غير مغطى |',
    '|---|---:|---:|',
    ...shown.map(
      (row) => `| \`${row.name}\` | ${formatPercent(row.percent)} | ${formatCount(row.uncovered)} |`,
    ),
    '',
  ];

  appendFileSync(summaryPath, `${lines.join('\n')}\n`, 'utf8');
}

parseArgs();
const profile = readProfile();
if (!profile) process.exit(2);

const rows = buildRows(profile.packages);
const totalPercent = printReport(rows, profile.totals, profile.files.size, profile.mode);
writeStepSummary(rows, profile.totals, totalPercent, profile.mode);

if (MIN_RAW && totalPercent < Number(MIN_RAW)) {
  process.stderr.write(
    `⛔ ${colors.red('انخفاض في تغطية Go')}: الإجمالي ${formatPercent(totalPercent)} أقل من العتبة ${MIN_RAW}%.\n` +
      '   أضف اختبارات لتغطية السلوك الجديد — لا تُخفّض العتبة إلا بقرار موثّق في CHANGELOG.md.\n',
  );
  process.exit(1);
}

process.stdout.write(`  ✅ ${colors.green('التغطية عند/فوق العتبة')} (${formatPercent(totalPercent)})\n\n`);
