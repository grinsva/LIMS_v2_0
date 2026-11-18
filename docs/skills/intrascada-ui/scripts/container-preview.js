#!/usr/bin/env node
'use strict';

/**
 * HTML-превью контейнера IntraSCADA (1:1, без запуска приложения).
 *
 * node container-preview.js <container.json> [--project <dir>] [--out <file.html>]
 *
 * Имена устройств берутся из <project>/jbase/devices.db, если проект указан,
 * иначе — из masterLink.title. Результат — статический HTML с абсолютным
 * позиционированием; снимать скриншот удобно headless-браузером.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project' || a === '-p') args.project = argv[++i];
    else if (a === '--out' || a === '-o') args.out = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
    else args._.push(a);
  }
  return args;
}

const HELP = `HTML-превью контейнера IntraSCADA

  node container-preview.js <container.json> [опции]

Опции:
  --project, -p <dir>  каталог проекта (имена устройств из devices.db)
  --out, -o <file>     куда записать HTML (по умолчанию — во временный каталог)
  --help, -h           эта справка
`;

const args = parseArgs(process.argv.slice(2));
if (args.help || args._.length === 0) {
  process.stdout.write(HELP);
  process.exit(args.help ? 0 : 2);
}

const file = path.resolve(args._[0]);
let container;
try {
  container = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  process.stderr.write(`ERROR: не удалось прочитать ${file}: ${e.message}\n`);
  process.exit(2);
}

const out = args.out
  ? path.resolve(args.out)
  : path.join(os.tmpdir(), path.basename(file, '.json') + '-preview.html');

const project = args.project ? path.resolve(args.project) : (process.env.INTRASCADA_PROJECT || null);

const num = (o) => {
  if (typeof o === 'number') return o;
  if (o && typeof o === 'object' && typeof o.value === 'number') return o.value;
  return 0;
};

const color = (o) => {
  if (!o) return null;
  if (typeof o === 'string') return o;
  if (typeof o.value === 'string' && o.value !== 'unset') return o.value;
  if (typeof o.fill === 'string' && o.fill !== 'transparent' && o.fill !== 'unset') return o.fill;
  return null;
};

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const alignH = (v) => {
  const id = v && v.id;
  if (id === 'center') return 'center';
  if (id === 'flex-end' || id === 'right') return 'flex-end';
  return 'flex-start';
};
const alignV = (v) => {
  const id = v && v.id;
  if (id === 'flex-end' || id === 'bottom' || id === 'bottom2') return 'flex-end';
  return 'center';
};

// devices.db -> { id: {dn, name} }
const devices = new Map();
if (project) {
  const p = path.join(project, 'jbase', 'devices.db');
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      if (!line.trim()) continue;
      let d;
      try { d = JSON.parse(line); } catch (e) { continue; }
      if (d && d._id && !devices.has(d._id)) devices.set(d._id, d);
    }
  }
}

const W = num(container.settings && container.settings.w);
const H = num(container.settings && container.settings.h);

const names = Array.isArray(container.list) ? container.list : Object.keys(container.elements || {});
const items = names.map((name, index) => {
  const e = (container.elements || {})[name];
  return e ? { name, e, index } : null;
}).filter(Boolean).sort((a, b) => {
  const za = num(a.e.zIndex), zb = num(b.e.zIndex);
  return za === zb ? a.index - b.index : za - zb;
});

function deviceLabel(e) {
  const id = e.masterLink && e.masterLink.id;
  const d = id ? devices.get(id) : null;
  if (d) return `${d.dn || ''} \u25AA\uFE0E ${d.name || ''}`.trim();
  return (e.masterLink && (e.masterLink.title || e.masterLink.title2)) || id || '';
}

function render(e, name) {
  const x = num(e.x), y = num(e.y), w = num(e.w), h = num(e.h), z = num(e.zIndex) || 100;
  const base = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;` +
    `z-index:${z};box-sizing:border-box;`;
  const bg = color(e.backgroundColor) || 'transparent';

  if (e.type === 'rectangle') {
    const r = num(e.borderRadius) || 0;
    return `<div class="el rect" style="${base}background:${esc(bg)};border-radius:${r}px"></div>`;
  }

  if (e.type === 'text') {
    const size = num(e.textSize) || 14;
    const bold = num(e.textBold) ? 700 : 400;
    const col = color(e.textColor) || '#333';
    const ah = alignH(e.textAlignH && e.textAlignH.value);
    const av = alignV(e.textAlignV && e.textAlignV.value);
    const r = num(e.borderRadius) || 0;
    const text = (e.text && e.text.value) != null ? e.text.value : '';
    return `<div class="el text" style="${base}background:${esc(bg)};border-radius:${r}px;` +
      `display:flex;align-items:${av};justify-content:${ah};` +
      `font:${bold} ${size}px Arial, sans-serif;color:${esc(col)};` +
      `padding:0 6px;white-space:pre-wrap;overflow:hidden">${esc(text)}</div>`;
  }

  if (e.type === 'template') {
    const isAi = e.templateId === 'vt104';
    const size = isAi ? Math.max(10, Math.round(15 * w / 500)) : Math.max(9, Math.round(16 * w / 310));
    const label = deviceLabel(e);
    const border = '1px solid #dcdcdc';
    const dot = `<span style="flex:none;width:12px;height:12px;border-radius:50%;` +
      `background:#AAAAAA;border:2px solid #8C8C8C;margin-left:6px"></span>`;
    return `<div class="el tpl" title="${esc(label)}" style="${base}background:#fff;` +
      `border:${border};border-radius:2px;display:flex;align-items:center;justify-content:flex-end;` +
      `font:${size}px Arial, sans-serif;color:#333;overflow:hidden;white-space:nowrap;` +
      `padding:0 4px">${esc(label)}${isAi ? '<span style="flex:1"></span><span style="color:#888;font-size:' +
      Math.max(9, size - 1) + 'px">*** ***</span>' : ''}${dot}</div>`;
  }

  if (e.type === 'circle') {
    const bs = num(e.borderSize) || 0;
    const bc = color(e.borderColor) || '#8C8C8C';
    return `<div class="el circle" style="${base}background:${esc(bg)};border-radius:50%;` +
      `border:${bs}px solid ${esc(bc)}"></div>`;
  }

  if (e.type === 'button') {
    const text = (e.text && e.text.value) || '';
    return `<div class="el btn" style="${base}background:#f0f0f0;border:1px solid #c8c8c8;` +
      `border-radius:4px;display:flex;align-items:center;justify-content:center;` +
      `font:14px Arial, sans-serif;color:#333;overflow:hidden">${esc(text)}</div>`;
  }

  if (e.type === 'image') {
    const img = (e.img && e.img.value) || '';
    return `<div class="el img" title="${esc(img)}" style="${base}border:1px dashed #cfcfcf;` +
      `border-radius:2px;display:flex;align-items:center;justify-content:center;` +
      `font:8px Arial, sans-serif;color:#999;overflow:hidden">${esc(path.basename(img))}</div>`;
  }

  if (e.type === 'container') {
    const link = (e.widgetlinks && e.widgetlinks.link && e.widgetlinks.link.id) || '';
    return `<div class="el frame" style="${base}border:1px dashed #b0b0b0;` +
      `background:rgba(0,0,0,0.02);font:10px Arial, sans-serif;color:#888;padding:2px">` +
      `${esc(link)}</div>`;
  }

  if (e.type === 'action') {
    return `<div class="el action" style="${base}background:rgba(0,128,255,0.04)"></div>`;
  }

  return `<div class="el other" title="${esc(e.type)}" style="${base}border:1px dotted #f0a;` +
    `background:rgba(255,0,255,0.03)"></div>`;
}

const body = items.map(({ name, e }) => render(e, name)).join('\n');
const title = path.basename(file) + ` — ${W}x${H}`;

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  html, body { margin: 0; padding: 0; background: #fff; }
  #canvas { position: relative; width: ${W}px; height: ${H}px; overflow: hidden;
            background: #fff; font-family: Arial, sans-serif; }
</style>
</head>
<body>
<div id="canvas" data-container="${esc(path.basename(file, '.json'))}" data-size="${W}x${H}">
${body}
</div>
</body>
</html>
`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html, 'utf8');
process.stdout.write(`preview: ${out}\nsize: ${W}x${H}, elements: ${items.length}\n`);
