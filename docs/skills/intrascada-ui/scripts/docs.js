#!/usr/bin/env node
'use strict';

/**
 * Адресный доступ к официальной документации IntraSCADA (docs.intrascada.com).
 *
 * node docs.js tree [--filter <текст>]
 * node docs.js search <текст>
 * node docs.js page <id|alias|часть заголовка> [--raw] [--refresh]
 *
 * Страницы и дерево кэшируются локально, повторный запрос работает без сети.
 * Кэш: %LOCALAPPDATA%\intrascada-docs (или os.tmpdir()).
 *
 * Переменные окружения:
 *   INTRASCADA_DOCS_URL     по умолчанию https://docs.intrascada.com
 *   INTRASCADA_DOCS_SOURCE  по умолчанию intrascada
 *   INTRASCADA_DOCS_LANG    по умолчанию ru
 *   INTRASCADA_DOCS_CACHE   каталог кэша
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = (process.env.INTRASCADA_DOCS_URL || 'https://docs.intrascada.com').replace(/\/+$/, '');
const SOURCE = process.env.INTRASCADA_DOCS_SOURCE || 'intrascada';
const LANG = process.env.INTRASCADA_DOCS_LANG || 'ru';
const CACHE = process.env.INTRASCADA_DOCS_CACHE
  || path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'intrascada-docs');
const TREE_TTL = 24 * 60 * 60 * 1000;

const HELP = `Официальная документация IntraSCADA

  node docs.js tree [--filter <текст>] [--refresh]
  node docs.js search <текст> [--refresh]
  node docs.js page <id|alias|часть заголовка> [--raw] [--refresh]

Примеры:
  node docs.js page button
  node docs.js page linkWithLocals
  node docs.js search deviceValue
  node docs.js tree --filter контейнер

Кэш: ${CACHE}
`;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--filter' || a === '-f') args.filter = argv[++i];
    else if (a === '--raw') args.raw = true;
    else if (a === '--refresh') args.refresh = true;
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else args._.push(a);
  }
  return args;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'intrascada-ui-skill' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const data = await res.json();
  if (!data || data.res !== 1) throw new Error(`API вернул ошибку: ${url}`);
  return data.data;
}

function flatten(nodes, depth = 0, out = []) {
  for (const n of nodes || []) {
    out.push({ id: n.id, title: n.title, alias: n.alias || '', depth });
    if (n.children) flatten(n.children, depth + 1, out);
  }
  return out;
}

async function getTree(args) {
  ensureDir(CACHE);
  const file = path.join(CACHE, `tree-${SOURCE}-${LANG}.json`);
  let cached = null;
  if (!args.refresh && fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Date.now() - parsed.ts < TREE_TTL) cached = parsed;
    } catch { /* перезагрузим */ }
  }
  if (cached) return cached.tree;

  const url = `${BASE}/restapi/tree?source=${encodeURIComponent(SOURCE)}&lang=${encodeURIComponent(LANG)}`;
  const tree = await fetchJson(url);
  fs.writeFileSync(file, JSON.stringify({ ts: Date.now(), tree }, null, 0), 'utf8');
  return tree;
}

function resolve(tree, query) {
  const all = flatten(tree);
  const q = query.toLowerCase();
  const byId = all.find(n => n.id.toLowerCase() === q);
  if (byId) return byId;
  const byAlias = all.find(n => n.alias && n.alias.toLowerCase() === q);
  if (byAlias) return byAlias;
  const byTitle = all.filter(n => n.title.toLowerCase().includes(q));
  if (byTitle.length === 1) return byTitle[0];
  if (byTitle.length > 1) {
    throw new Error('Неоднозначно: ' + byTitle.map(n => `${n.id} (${n.title})`).join('; '));
  }
  return null;
}

function pageUrl(node) {
  return `${BASE}/${LANG}/${node.alias || node.id}`;
}

async function cmdTree(args) {
  const tree = await getTree(args);
  const q = (args.filter || '').toLowerCase();
  const match = n => !q
    || n.title.toLowerCase().includes(q)
    || n.id.toLowerCase().includes(q)
    || n.alias.toLowerCase().includes(q);

  const line = (n, depth) =>
    `${'  '.repeat(depth)}${n.id}${n.alias ? ' [' + n.alias + ']' : ''}  ${n.title}`;

  if (!args.filter) {
    for (const n of flatten(tree)) console.log(line(n, n.depth));
    return;
  }

  // Совпадения вместе с родителями, чтобы был виден путь по дереву.
  const filterTree = (nodes, depth = 0) => {
    const out = [];
    for (const n of nodes || []) {
      const children = filterTree(n.children, depth + 1);
      if (match(n) || children.length) out.push({ n, depth, children });
    }
    return out;
  };
  const print = list => {
    for (const item of list) {
      console.log(line(item.n, item.depth));
      print(item.children);
    }
  };
  print(filterTree(tree));
}

async function cmdSearch(args) {
  const query = args._.slice(1).join(' ').trim();
  if (!query) throw new Error('Укажите строку поиска: node docs.js search <текст>');
  const url = `${BASE}/restapi/search?source=${encodeURIComponent(SOURCE)}&lang=${encodeURIComponent(LANG)}&str=${encodeURIComponent(query)}`;
  const data = await fetchJson(url);
  if (!Array.isArray(data) || data.length === 0) {
    console.log(`Ничего не найдено: ${query}`);
    return;
  }
  for (const r of data) {
    console.log(`${r.id}  ${r.title}`);
    if (r.matched) console.log(`    ${String(r.matched).replace(/\s+/g, ' ').trim()}`);
  }
}

async function cmdPage(args) {
  const query = args._.slice(1).join(' ').trim();
  if (!query) throw new Error('Укажите id или alias: node docs.js page <id|alias>');
  const tree = await getTree(args);
  const node = resolve(tree, query);
  if (!node) throw new Error(`Раздел не найден: ${query}. Посмотрите: node docs.js tree --filter ${query}`);

  ensureDir(path.join(CACHE, 'pages'));
  const file = path.join(CACHE, 'pages', `${node.id}.md`);
  let body = null;
  if (!args.refresh && fs.existsSync(file)) {
    body = fs.readFileSync(file, 'utf8');
  } else {
    const url = `${BASE}/restapi/page?source=${encodeURIComponent(SOURCE)}&lang=${encodeURIComponent(LANG)}&id=${encodeURIComponent(node.id)}`;
    const data = await fetchJson(url);
    body = typeof data === 'string' ? data : (data && data.data) || '';
    if (!body) throw new Error(`Пустая страница: ${node.id}`);
    fs.writeFileSync(file, body, 'utf8');
  }

  if (args.raw) {
    process.stdout.write(body.endsWith('\n') ? body : body + '\n');
    return;
  }
  const heading = args.json
    ? JSON.stringify({ id: node.id, alias: node.alias, title: node.title, url: pageUrl(node) })
    : `<!-- ${node.id}${node.alias ? ' / ' + node.alias : ''} | ${node.title}\n     ${pageUrl(node)} -->`;
  console.log(heading);
  console.log(body.endsWith('\n') ? body : body + '\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length === 0) {
    console.log(HELP);
    return;
  }
  const cmd = args._[0];
  if (cmd === 'tree') return cmdTree(args);
  if (cmd === 'search') return cmdSearch(args);
  if (cmd === 'page') return cmdPage(args);
  throw new Error(`Неизвестная команда: ${cmd}\n\n${HELP}`);
}

main().catch(err => {
  console.error('Ошибка: ' + err.message);
  process.exitCode = 1;
});
