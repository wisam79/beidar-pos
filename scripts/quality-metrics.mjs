#!/usr/bin/env node
/**
 * quality-metrics.mjs — مقياس الجودة القابل لإعادة التشغيل (Beidar Quality Report)
 *
 * يُستخدم لتوليد كل رقم في تقارير الجودة — قاعدة «لا ادعاء بلا دليل» في
 * docs/DOCUMENTATION_MAP.md: كل رقم في التوثيق يجب أن يأتي من أمر قابل للتشغيل.
 *
 * الاستخدام:
 *   node scripts/quality-metrics.mjs              # تقرير عربي مختصر
 *   node scripts/quality-metrics.mjs --top=20     # عدد أكبر من الملفات الأضخم
 *   node scripts/quality-metrics.mjs --json       # مخرجات JSON (للاستهلاك الآلي)
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARGS = process.argv.slice(2);
const AS_JSON = ARGS.includes('--json');
const TOP = Number((ARGS.find((a) => a.startsWith('--top=')) || '--top=12').split('=')[1]) || 12;

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
  'wailsjs',
  'build',
]);

function walk(dir, predicate, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, out);
    else if (entry.isFile() && predicate(entry.name, full)) out.push(full);
  }
  return out;
}

const rel = (file) => relative(ROOT, file).split(sep).join('/');
const countLines = (file) => readFileSync(file, 'utf8').split(/\r?\n/).length;

const AREAS = {
  'frontend/src': () => walk(join(ROOT, 'frontend', 'src'), (n) => /\.(ts|tsx)$/.test(n)),
  'frontend/e2e': () => walk(join(ROOT, 'frontend', 'e2e'), (n) => /\.ts$/.test(n)),
  'internal (source)': () => walk(join(ROOT, 'internal'), (n) => n.endsWith('.go') && !n.endsWith('_test.go')),
  'internal (tests)': () => walk(join(ROOT, 'internal'), (n) => n.endsWith('_test.go')),
  'pkg (source)': () => walk(join(ROOT, 'pkg'), (n) => n.endsWith('.go') && !n.endsWith('_test.go')),
  'pkg (tests)': () => walk(join(ROOT, 'pkg'), (n) => n.endsWith('_test.go')),
  scripts: () => walk(join(ROOT, 'scripts'), (n) => /\.(mjs|js|ps1)$/.test(n)),
};

const MARKERS = {
  ts: {
    'any (نوع صريح)': /:\s*any\b/g,
    'as any (تحويل قسري)': /\bas\s+any\b/g,
    'ts-ignore/ts-expect-error': /@ts-(ignore|expect-error)\b/g,
    'eslint-disable': /eslint-disable/g,
    'console.*': /console\.(log|warn|error|debug|info)\(/g,
    'TODO/FIXME/HACK': /\b(TODO|FIXME|HACK)\b/g,
    'test .only (خطر)': /\.only\(/g,
    'test .skip': /\.(skip|todo)\(/g,
  },
  go: {
    'interface{} (نوع فارغ)': /interface\{\}/g,
    'panic(': /\bpanic\(/g,
    'log.Fatal': /\blog\.Fatal/g,
    't.Skip': /\bt\.Skip\(/g,
    'TODO/FIXME/HACK': /\b(TODO|FIXME|HACK)\b/g,
    '//nolint': /\/\/nolint/g,
    'float64 في مسار مالي (فحص يدوي)': /float64/g,
  },
};

function countInFiles(files, pattern) {
  let total = 0;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const matches = text.match(pattern);
    if (matches) total += matches.length;
  }
  return total;
}

function report() {
  const result = { generatedAt: new Date().toISOString(), areas: {}, markers: {}, largest: [] };

  for (const [name, collect] of Object.entries(AREAS)) {
    const files = collect();
    result.areas[name] = { files: files.length, lines: files.reduce((sum, f) => sum + countLines(f), 0) };
  }

  for (const [ext, markers] of Object.entries(MARKERS)) {
    const files =
      ext === 'ts'
        ? AREAS['frontend/src']().concat(AREAS['frontend/e2e']())
        : AREAS['internal (source)']().concat(AREAS['pkg (source)']());
    result.markers[ext] = {};
    for (const [label, pattern] of Object.entries(markers)) {
      result.markers[ext][label] = countInFiles(files, pattern);
    }
  }

  const allSource = [
    ...AREAS['frontend/src'](),
    ...AREAS['internal (source)'](),
    ...AREAS['pkg (source)'](),
  ];
  result.largest = allSource
    .map((file) => ({ file: rel(file), lines: countLines(file) }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, TOP);

  return result;
}

const data = report();

if (AS_JSON) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

console.log('\n📊 تقرير الجودة الكمي — بيدر (Beidar)');
console.log(`   وُلّد في: ${data.generatedAt}\n`);
console.log('  ── أحجام المناطق ──');
for (const [name, info] of Object.entries(data.areas)) {
  console.log(`  · ${name.padEnd(20)} ${String(info.files).padStart(5)} ملفاً · ${String(info.lines).padStart(7)} سطراً`);
}
for (const [ext, markers] of Object.entries(data.markers)) {
  console.log(`\n  ── مؤشرات ${ext === 'ts' ? 'TypeScript' : 'Go'} ──`);
  for (const [label, count] of Object.entries(markers)) {
    console.log(`  · ${label.padEnd(28)} ${count}`);
  }
}
console.log('\n  ── أكبر الملفات المصدرية ──');
for (const item of data.largest) {
  console.log(`  · ${String(item.lines).padStart(6)} سطراً  ${item.file}`);
}
console.log('\n  ℹ️  كل رقم أعلاه قابل لإعادة التوليد بهذا الأمر — لا أرقام من الذاكرة.\n');
