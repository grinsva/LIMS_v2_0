#!/usr/bin/env node
"use strict";

/**
 * db/schema/dump-schema.cjs
 *
 * Выгружает структуру SQLite-базы (только DDL: таблицы, индексы, триггеры,
 * представления) в текстовый файл. Данные НЕ выгружаются.
 *
 * Зачем: hist.db — бинарный файл, в git-диффе видно только "Bin 135168 -> 135168".
 * schema.sql даёт читаемый дифф при любом изменении структуры.
 *
 * Использование:
 *   node db/schema/dump-schema.cjs                -> пишет db/schema/schema.sql
 *   node db/schema/dump-schema.cjs --check        -> сравнивает schema.sql с базой, код 1 при расхождении
 *   node db/schema/dump-schema.cjs <путь к .db> -o <куда писать>
 *
 * Требования: Node.js >= 22.5 (встроенный модуль node:sqlite). Внешних зависимостей нет.
 */

const fs = require("node:fs");
const path = require("node:path");

// node:sqlite помечен как experimental и печатает предупреждение в stderr.
// Глушим ровно его, чтобы не мешало в выводе скриптов и git-хуков.
const _emitWarning = process.emitWarning;
process.emitWarning = function (warning, ...rest) {
  const msg = typeof warning === "string" ? warning : (warning && warning.message) || "";
  if (/SQLite is an experimental feature/.test(msg)) return;
  return _emitWarning.call(process, warning, ...rest);
};
const { DatabaseSync } = require("node:sqlite");
process.emitWarning = _emitWarning;

const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_DB = path.join(ROOT, "db", "sqliteDb", "hist.db");
const DEFAULT_OUT = path.join(__dirname, "schema.sql");

// Порядок секций в выходном файле. Внутри секции объекты сортируются по имени,
// чтобы диффы были стабильными независимо от истории правок базы.
const SECTIONS = [
  ["table", "ТАБЛИЦЫ"],
  ["index", "ИНДЕКСЫ"],
  ["trigger", "ТРИГГЕРЫ"],
  ["view", "ПРЕДСТАВЛЕНИЯ"],
];

// sqlite_% — служебные объекты самого SQLite (sqlite_sequence, sqlite_stat1...),
// autoindex-ы имеют sql = NULL и тоже не нужны: они создаются автоматически.
const SELECT_OBJECTS = `
  select type, name, sql
    from sqlite_master
   where sql is not null
     and name not like 'sqlite\\_%' escape '\\'
   order by type, name
`;

function usage() {
  console.log(`Использование: node db/schema/dump-schema.cjs [база.db] [-o файл.sql] [--check]

  база.db        путь к SQLite-базе (по умолчанию db/sqliteDb/hist.db)
  -o, --out      куда писать (по умолчанию db/schema/schema.sql)
  --check        не писать, а сравнить schema.sql с текущей базой
  -h, --help     эта справка`);
}

function parseArgs(argv) {
  const opts = { dbPath: DEFAULT_DB, outPath: DEFAULT_OUT, check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      usage();
      process.exit(0);
    } else if (a === "--check") {
      opts.check = true;
    } else if (a === "-o" || a === "--out") {
      const v = argv[++i];
      if (!v) throw new Error("после " + a + " нужен путь к файлу");
      opts.outPath = path.resolve(process.cwd(), v);
    } else if (a.startsWith("-")) {
      throw new Error("неизвестный параметр: " + a);
    } else {
      opts.dbPath = path.resolve(process.cwd(), a);
    }
  }
  return opts;
}

function schemaObjects(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return db.prepare(SELECT_OBJECTS).all().map((r) => ({
      type: String(r.type),
      name: String(r.name),
      sql: String(r.sql),
    }));
  } finally {
    db.close();
  }
}

// Создаёт базу в памяти по тексту .sql и возвращает её структуру.
// Нужно для --check: так можно сравнить не только порядок строк, но и
// конкретные объекты (что добавилось / удалилось / изменилось).
function objectsFromSqlText(sqlText) {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(sqlText);
    return db.prepare(SELECT_OBJECTS).all().map((r) => ({
      type: String(r.type),
      name: String(r.name),
      sql: String(r.sql),
    }));
  } finally {
    db.close();
  }
}

function cleanSql(sql) {
  return String(sql).trim().replace(/;+\s*$/, "");
}

function toMap(objects) {
  const m = new Map();
  for (const o of objects) m.set(o.type + ":" + o.name, cleanSql(o.sql));
  return m;
}

function normalizeText(text) {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").replace(/\s+$/, "\n");
}

function render(objects, sourceLabel) {
  const out = [];
  out.push("-- ==========================================================================");
  out.push("-- schema.sql — структура базы данных (только DDL, без данных)");
  out.push("--");
  out.push("-- Источник  : " + sourceLabel);
  out.push("-- Генератор : node db/schema/dump-schema.cjs");
  out.push("-- Проверка  : node db/schema/dump-schema.cjs --check");
  out.push("--");
  out.push("-- Файл пересобирается скриптом. Руками не править: правка потеряется.");
  out.push("-- Подробности: db/schema/README.md");
  out.push("-- ==========================================================================");

  for (const [type, title] of SECTIONS) {
    const items = objects.filter((o) => o.type === type);
    if (items.length === 0) continue;
    out.push("");
    out.push("-- ***** " + title + " (" + items.length + ") *****");
    for (const o of items) {
      out.push("");
      out.push("-- " + type + ": " + o.name);
      out.push(cleanSql(o.sql) + ";");
    }
  }
  out.push("");
  return out.join("\n");
}

function reportDiff(expected, actual) {
  const e = toMap(expected);
  const a = toMap(actual);
  const onlyDb = [...e.keys()].filter((k) => !a.has(k));
  const onlyFile = [...a.keys()].filter((k) => !e.has(k));
  const changed = [...e.keys()].filter((k) => a.has(k) && a.get(k) !== e.get(k));

  console.error("Расхождение схемы: db/schema/schema.sql устарел.");
  for (const k of onlyDb) console.error("  только в базе, нет в файле : " + k);
  for (const k of onlyFile) console.error("  только в файле, нет в базе : " + k);
  for (const k of changed) console.error("  изменено                   : " + k);
  console.error("");
  console.error("Пересоберите файл: node db/schema/dump-schema.cjs");
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(String(e.message || e));
    usage();
    process.exit(2);
  }

  if (!fs.existsSync(opts.dbPath)) {
    console.error("База не найдена: " + opts.dbPath);
    process.exit(2);
  }

  let objects;
  try {
    objects = schemaObjects(opts.dbPath);
  } catch (e) {
    console.error("Не удалось прочитать схему: " + (e.message || e));
    process.exit(2);
  }

  const sourceLabel = (() => {
    const rel = path.relative(ROOT, opts.dbPath);
    return rel && !rel.startsWith("..") ? rel.split(path.sep).join("/") : opts.dbPath;
  })();
  const text = render(objects, sourceLabel);

  if (!opts.check) {
    fs.writeFileSync(opts.outPath, text, "utf8");
    console.log("ok: " + objects.length + " объектов -> " + opts.outPath);
    return;
  }

  if (!fs.existsSync(opts.outPath)) {
    console.error("Файл не найден: " + opts.outPath);
    console.error("Создайте его: node db/schema/dump-schema.cjs");
    process.exit(1);
  }

  const existingText = fs.readFileSync(opts.outPath, "utf8");
  if (normalizeText(existingText) === normalizeText(text)) {
    console.log("ok: " + opts.outPath + " соответствует базе (" + objects.length + " объектов)");
    return;
  }

  let actualObjects;
  try {
    actualObjects = objectsFromSqlText(existingText);
  } catch (e) {
    console.error("Файл " + opts.outPath + " не удаётся выполнить как SQL: " + (e.message || e));
    process.exit(1);
  }
  reportDiff(objects, actualObjects);
  process.exit(1);
}

main();
