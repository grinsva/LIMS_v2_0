#!/usr/bin/env node
"use strict";

/**
 * db/schema/verify-migrations.cjs
 *
 * Проверяет, что цепочка миграций (файлы NNNN_*.sql в этой же папке, по порядку
 * имён) действительно собирает структуру, совпадающую с реальной базой.
 *
 * Как работает:
 *   1. создаёт пустую базу в памяти (:memory:);
 *   2. выполняет в ней все файлы миграций по порядку;
 *   3. сравнивает полученную структуру (таблицы/индексы/триггеры/представления)
 *      с реальной базой по тексту DDL и списку объектов.
 *
 * Зачем: миграции — текстовые файлы, их можно проверять в CI/перед коммитом,
 * не трогая рабочую базу. Расхождение = цепочка миграций не соответствует
 * фактической структуре (забыли файл миграции либо правили базу руками).
 *
 * Использование:
 *   node db/schema/verify-migrations.cjs              -> сверить с db/sqliteDb/hist.db
 *   node db/schema/verify-migrations.cjs <путь к .db> -> сверить с другой базой
 *
 * Код возврата: 0 — всё совпадает, 1 — расхождения, 2 — ошибка выполнения.
 * Требования: Node.js >= 22.5 (node:sqlite). Внешних зависимостей нет.
 */

const fs = require("node:fs");
const path = require("node:path");

// node:sqlite помечен как experimental и печатает предупреждение в stderr.
// Глушим ровно его, чтобы не мешало в выводе.
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
// Миграции лежат в этой же папке. Отбираются только файлы вида 0001_имя.sql,
// поэтому schema.sql, README.md и сами скрипты в цепочку не попадают.
const MIGRATIONS_DIR = __dirname;
const MIGRATION_FILE = /^\d{4}_.+\.sql$/i;

const SELECT_OBJECTS = `
  select type, name, sql
    from sqlite_master
   where sql is not null
     and name not like 'sqlite\\_%' escape '\\'
   order by type, name
`;

function cleanSql(sql) {
  return String(sql).trim().replace(/;+\s*$/, "");
}

function schemaMap(db) {
  const m = new Map();
  for (const r of db.prepare(SELECT_OBJECTS).all()) {
    m.set(String(r.type) + ":" + String(r.name), cleanSql(r.sql));
  }
  return m;
}

function migrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => MIGRATION_FILE.test(f))
    .sort();
}

function main() {
  const dbPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : DEFAULT_DB;

  if (!fs.existsSync(dbPath)) {
    console.error("База не найдена: " + dbPath);
    process.exit(2);
  }

  const files = migrationFiles();
  if (files.length === 0) {
    console.error("В " + MIGRATIONS_DIR + " нет файлов миграций вида NNNN_*.sql");
    process.exit(2);
  }

  const mem = new DatabaseSync(":memory:");
  let built;
  try {
    for (const f of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
      try {
        mem.exec(sql);
        console.log("  применена: " + f);
      } catch (e) {
        console.error("ОШИБКА в " + f + ": " + (e.message || e));
        process.exit(2);
      }
    }
    built = schemaMap(mem);
  } finally {
    mem.close();
  }

  const target = new DatabaseSync(dbPath, { readOnly: true });
  let actual;
  try {
    actual = schemaMap(target);
  } finally {
    target.close();
  }

  const missing = [...actual.keys()].filter((k) => !built.has(k)); // есть в базе, нет в миграциях
  const extra = [...built.keys()].filter((k) => !actual.has(k)); // создаётся миграциями, но в базе нет
  const changed = [...actual.keys()].filter((k) => built.has(k) && built.get(k) !== actual.get(k));

  if (missing.length === 0 && extra.length === 0 && changed.length === 0) {
    console.log("");
    console.log("ok: миграции (" + files.length + " файлов) собирают структуру, совпадающую с " + path.basename(dbPath));
    console.log("    объектов в схеме: " + actual.size);
    return;
  }

  console.error("");
  console.error("РАСХОЖДЕНИЕ: структура из миграций не совпадает с " + dbPath);
  for (const k of missing) console.error("  нет в миграциях   : " + k);
  for (const k of extra) console.error("  лишнее в миграциях: " + k);
  for (const k of changed) console.error("  отличается        : " + k);
  console.error("");
  console.error("Скорее всего, структуру меняли напрямую в базе и не оформили миграцией.");
  process.exit(1);
}

main();
