#!/usr/bin/env node
'use strict';

/**
 * Проверка контейнера IntraSCADA.
 *
 * node validate-container.js <container.json> [--project <dir>] [--strict] [--json]
 *
 * Проверяет: структуру list/elements, геометрию и границы, наложения плиток,
 * дубли устройств, привязку lval к masterLink.id, существование устройств
 * и диалогов в проекте.
 *
 * Код возврата: 0 — успех, 1 — ошибки (или предупреждения при --strict),
 * 2 — не удалось прочитать файл.
 */

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project' || a === '-p') args.project = argv[++i];
    else if (a === '--strict') args.strict = true;
    else if (a === '--json') args.json = true;
    else if (a === '--ignore' || a === '-i') (args.ignore = args.ignore || []).push(argv[++i]);
    else if (a === '--help' || a === '-h') args.help = true;
    else args._.push(a);
  }
  return args;
}

const HELP = `Проверка контейнера IntraSCADA

  node validate-container.js <container.json> [опции]

Опции:
  --project, -p <dir>  каталог проекта (для devices.db и dialog/)
  --strict             считать предупреждения ошибками
  --ignore, -i <text>  не учитывать предупреждения, содержащие текст
                       (можно повторять; для известных старых дефектов)
  --json               вывести отчёт в JSON
  --help, -h           эта справка
`;

const args = parseArgs(process.argv.slice(2));
if (args.help || args._.length === 0) {
  process.stdout.write(HELP);
  process.exit(args.help ? 0 : 2);
}

const file = path.resolve(args._[0]);
const project = args.project ? path.resolve(args.project) : (process.env.INTRASCADA_PROJECT || null);

function readLines(p) {
  if (!p || !fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(l => l.trim()).map(l => {
    try { return JSON.parse(l); } catch (e) { return null; }
  }).filter(Boolean);
}

const num = (o) => {
  if (typeof o === 'number') return o;
  if (o && typeof o === 'object' && typeof o.value === 'number') return o.value;
  return NaN;
};

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

let container;
try {
  container = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  const msg = `не удалось прочитать JSON: ${e.message}`;
  if (args.json) process.stdout.write(JSON.stringify({ file, errors: [msg], warnings: [] }, null, 1));
  else process.stderr.write(`ERROR: ${msg}\n`);
  process.exit(2);
}

if (!container || typeof container !== 'object' || Array.isArray(container)) {
  err('корень файла должен быть объектом контейнера');
}

const settings = container && container.settings;
const W = num(settings && settings.w);
const H = num(settings && settings.h);
if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0) {
  err('settings.w/h не заданы или не числа');
}

const list = Array.isArray(container && container.list) ? container.list : null;
const elements = container && container.elements && typeof container.elements === 'object'
  ? container.elements : null;

if (!list) err('нет массива list');
if (!elements) err('нет объекта elements');

if (list && elements) {
  const seen = new Set();
  for (const name of list) {
    if (seen.has(name)) warn(`дубль в list: ${name}`);
    seen.add(name);
    if (!elements[name]) err(`list ссылается на отсутствующий элемент: ${name}`);
  }
  for (const name of Object.keys(elements)) {
    if (!seen.has(name)) warn(`элемент есть в elements, но отсутствует в list: ${name}`);
  }
}

const names = list || Object.keys(elements || {});
const typeCounts = {};
const templates = [];
const rows = [];

for (const name of names) {
  const e = elements && elements[name];
  if (!e || typeof e !== 'object') continue;
  const type = e.type || '(no type)';
  typeCounts[type] = (typeCounts[type] || 0) + 1;

  const x = num(e.x), y = num(e.y), w = num(e.w), h = num(e.h);
  if (![x, y, w, h].every(Number.isFinite)) {
    err(`${name}: координаты x/y/w/h должны быть числами`);
    continue;
  }
  if (w < 0 || h < 0) err(`${name}: отрицательные w/h (${w}x${h})`);

  // Выход за границы — предупреждение: в живых проектах встречается
  // намеренная обрезка (например, аналоговые плитки с x = -17).
  // Для выпускаемой раскладки запускать с --strict.
  const overflow = Math.max(-x, -y, x + w - W, y + h - H);
  if (Number.isFinite(overflow) && overflow > 0) {
    warn(`${name}: выход за границы на ${overflow.toFixed(1)} px`);
  }

  rows.push({ name, type, x, y, w, h });

  if (type === 'template') {
    if (!e.templateId) err(`${name}: у шаблона нет templateId`);
    if (!e.masterLink || !e.masterLink.id) err(`${name}: у шаблона нет masterLink.id`);
    templates.push({ name, e, masterLink: e.masterLink || {} });
  }
}

// Наложения проверяем только между плитками: текст и подложки лежат слоями.
for (let i = 0; i < rows.length; i++) {
  const a = rows[i];
  if (a.type !== 'template') continue;
  for (let j = i + 1; j < rows.length; j++) {
    const b = rows[j];
    if (b.type !== 'template') continue;
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
      warn(`наложение плиток: ${a.name} и ${b.name}`);
    }
  }
}

// Устройства и их уникальность.
const devices = readLines(project && path.join(project, 'jbase', 'devices.db'));
const deviceIds = devices ? new Set(devices.map(d => d._id)) : null;
const used = new Map();

for (const t of templates) {
  const id = t.masterLink.id;
  if (!id) continue;
  if (used.has(id)) warn(`устройство ${id} встречается дважды: ${used.get(id)} и ${t.name}`);
  else used.set(id, t.name);
  if (deviceIds && !deviceIds.has(id)) warn(`${t.name}: устройства ${id} нет в devices.db`);
}

// Привязка клика: lval должен совпадать с masterLink.id.
function walk(node, cb) {
  if (!node || typeof node !== 'object') return;
  cb(node);
  for (const key of Object.keys(node)) walk(node[key], cb);
}

const dialogIds = new Set();
if (project) {
  const ddir = path.join(project, 'jbase', 'dialog');
  if (fs.existsSync(ddir)) {
    for (const f of fs.readdirSync(ddir)) {
      if (f.endsWith('.json')) dialogIds.add(path.basename(f, '.json'));
    }
  }
}

for (const t of templates) {
  const e = t.e;
  if (!e.actions) continue;
  walk(e.actions, (n) => {
    if (!n.command || !n.value || !Array.isArray(n.value.targetFrameTable)) return;
    if (n.command === 'dialog_any' && n.id && dialogIds.size && !dialogIds.has(n.id)) {
      warn(`${t.name}: диалог ${n.id} не найден в jbase/dialog`);
    }
    for (const target of n.value.targetFrameTable) {
      if (!target || target.lval === undefined) continue;
      if (target.lval !== t.masterLink.id) {
        warn(`${t.name}: lval=${target.lval}, а masterLink.id=${t.masterLink.id}`);
      }
    }
  });
}

// Итог.
const ignored = [];
if (args.ignore && args.ignore.length) {
  for (let i = warnings.length - 1; i >= 0; i--) {
    if (args.ignore.some(s => s && warnings[i].includes(s))) {
      ignored.unshift(warnings.splice(i, 1)[0]);
    }
  }
}
const strictFail = args.strict && warnings.length > 0;
const ok = errors.length === 0 && !strictFail;

if (args.json) {
  const report = {
    file,
    project,
    size: { w: W, h: H },
    elements: {
      total: names.length,
      byType: typeCounts,
    },
    tiles: {
      total: templates.length,
      byTemplate: templates.reduce((acc, t) => {
        const k = t.e.templateId || '(none)';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {}),
      devices: used.size,
    },
    errors,
    warnings,
    ignored,
    ok,
  };
  process.stdout.write(JSON.stringify(report, null, 1) + '\n');
} else {
  const out = [];
  out.push(`container: ${path.basename(file)}`);
  if (project) out.push(`project:   ${project}`);
  out.push(`size:      ${W}x${H}`);
  out.push(`elements:  ${names.length} (${Object.entries(typeCounts).map(([k, v]) => `${k} ${v}`).join(', ')})`);
  const tplCounts = templates.reduce((acc, t) => {
    const k = t.e.templateId || '(none)';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  out.push(`tiles:     ${templates.length} (${Object.entries(tplCounts).map(([k, v]) => `${k} ${v}`).join(', ')})`);
  out.push(`devices:   ${used.size} unique`);
  out.push('');
  if (errors.length) {
    out.push(`ERRORS (${errors.length}):`);
    errors.forEach(m => out.push(`  - ${m}`));
  } else {
    out.push('ERRORS: 0');
  }
  if (warnings.length) {
    out.push(`WARNINGS (${warnings.length}):`);
    warnings.forEach(m => out.push(`  - ${m}`));
  } else {
    out.push('WARNINGS: 0');
  }
  if (ignored.length) {
    out.push(`IGNORED (${ignored.length}):`);
    ignored.forEach(m => out.push(`  - ${m}`));
  }
  out.push('');
  out.push(ok ? 'OK' : 'FAILED');
  process.stdout.write(out.join('\n') + '\n');
}

process.exit(ok ? 0 : 1);
