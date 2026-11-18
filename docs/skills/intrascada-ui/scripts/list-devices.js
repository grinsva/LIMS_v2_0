#!/usr/bin/env node
'use strict';

/**
 * Список устройств IntraSCADA по папкам (lists.db + devices.db).
 *
 * node list-devices.js --project <dir> [--folder <dgXXX|имя>] [--no-devices] [--json]
 *
 * Без --folder показывает верхний уровень дерева. Устройства дедуплицируются
 * по _id: в devices.db встречаются повторяющиеся строки.
 */

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project' || a === '-p') args.project = argv[++i];
    else if (a === '--folder' || a === '-f') args.folder = argv[++i];
    else if (a === '--no-devices') args.noDevices = true;
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else args._.push(a);
  }
  return args;
}

const HELP = `Устройства IntraSCADA по папкам

  node list-devices.js --project <dir> [опции]

Опции:
  --project, -p <dir>  каталог проекта (обязателен)
  --folder, -f <id>    папка: id (dg172) или часть имени («Тревоги»)
  --no-devices         только дерево папок, без списка устройств
  --json               вывести данные в JSON
  --help, -h           эта справка
`;

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

const project = args.project ? path.resolve(args.project) : (process.env.INTRASCADA_PROJECT || null);
if (!project) {
  process.stderr.write('ERROR: укажите --project <каталог проекта> или INTRASCADA_PROJECT\n');
  process.exit(2);
}

function readLines(p) {
  return fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(l => l.trim()).map(l => {
    try { return JSON.parse(l); } catch (e) { return null; }
  }).filter(Boolean);
}

const listsPath = path.join(project, 'jbase', 'lists.db');
const devicesPath = path.join(project, 'jbase', 'devices.db');
for (const p of [listsPath, devicesPath]) {
  if (!fs.existsSync(p)) {
    process.stderr.write(`ERROR: нет файла ${p}\n`);
    process.exit(2);
  }
}

const nodes = readLines(listsPath);
const devices = readLines(devicesPath);
const nodeById = new Map(nodes.map(n => [n._id, n]));
const devicesByParent = new Map();
for (const d of devices) {
  if (!devicesByParent.has(d.parent)) devicesByParent.set(d.parent, []);
  devicesByParent.get(d.parent).push(d);
}
const childrenOf = (id) => nodes
  .filter(n => n.parent === id)
  .sort((a, b) => (a.order || 0) - (b.order || 0));
const devicesOf = (id) => (devicesByParent.get(id) || [])
  .slice()
  .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.name).localeCompare(String(b.name), 'ru'));

// Корни — узлы, чей parent не является узлом (в этом проекте parent = "place").
const roots = nodes
  .filter(n => !nodeById.has(n.parent))
  .sort((a, b) => (a.order || 0) - (b.order || 0));

let start = null;
if (args.folder) {
  const q = String(args.folder).toLowerCase();
  start = nodeById.get(args.folder) ||
    nodes.find(n => String(n.name || '').toLowerCase() === q) ||
    nodes.find(n => String(n.name || '').toLowerCase().includes(q));
  if (!start) {
    const candidates = nodes
      .filter(n => String(n.name || '').toLowerCase().includes(q))
      .slice(0, 10)
      .map(n => `${n._id} ${n.name}`);
    process.stderr.write(`ERROR: папка «${args.folder}» не найдена\n`);
    if (candidates.length) process.stderr.write('Похожие: ' + candidates.join('; ') + '\n');
    process.exit(1);
  }
} else {
  start = null;
}

const groups = [];
const flatDevices = [];
const seen = new Set();
const duplicates = new Map();
let rawRows = 0;

function walk(node, depth, skipSelf) {
  const list = devicesOf(node._id);
  rawRows += list.length;
  const unique = [];
  for (const d of list) {
    if (seen.has(d._id)) {
      duplicates.set(d._id, (duplicates.get(d._id) || 1) + 1);
      continue;
    }
    seen.add(d._id);
    unique.push(d);
    flatDevices.push(d);
  }
  if (!skipSelf) {
    groups.push({ id: node._id, name: node.name, depth, count: unique.length, devices: unique });
  }
  const childDepth = skipSelf ? depth : depth + 1;
  for (const child of childrenOf(node._id)) walk(child, childDepth, false);
}

if (start) {
  // Если у самой папки нет устройств, не дублируем её отдельной строкой.
  walk(start, 0, devicesOf(start._id).length === 0);
} else {
  for (const root of roots) walk(root, 0, false);
}

const totalRows = rawRows;
const totalUnique = flatDevices.length;

if (args.json) {
  process.stdout.write(JSON.stringify({
    project,
    folder: start ? { id: start._id, name: start.name } : null,
    groups: groups.map(g => ({ id: g.id, name: g.name, depth: g.depth, count: g.count })),
    devices: flatDevices.map(d => ({
      _id: d._id, dn: d.dn, name: d.name, type: d.type, parent: d.parent,
    })),
    totals: {
      rows: totalRows,
      unique: totalUnique,
      duplicatedIds: [...duplicates.keys()],
    },
  }, null, 1) + '\n');
  process.exit(0);
}

const out = [];
out.push(`project: ${project}`);
if (start) out.push(`folder:  ${start._id} «${start.name}»`);
out.push('');

const header = start ? [`${start._id} ${start.name}`] : ['верхний уровень'];
out.push(header[0]);

for (const g of groups) {
  const pad = '  '.repeat(g.depth + (start ? 1 : 0));
  out.push(`${pad}${g.id} ${g.name} (${g.count})`);
  if (!args.noDevices) {
    for (const d of g.devices) {
      out.push(`${pad}  ${d._id}  ${d.dn || ''}  ${d.name || ''}`.replace(/\s+$/, ''));
    }
  }
}

out.push('');
out.push(`итого: строк ${totalRows}, уникальных устройств ${totalUnique}`);
if (duplicates.size) {
  out.push(`дубли _id: ${[...duplicates.entries()].map(([id, n]) => `${id}×${n}`).join(', ')}`);
}
process.stdout.write(out.join('\n') + '\n');
