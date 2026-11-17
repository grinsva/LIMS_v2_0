-- ==========================================================================
-- 0004_add_isp_tables_and_vk_doc_kachest.sql
--
-- Что делает: догоняет цепочку миграций до фактической структуры живой базы.
-- К моменту создания файла в hist.db уже были (не оформленные миграцией):
--   1) справочники испытаний: isp_result, isp_stg_status, vk_isp_stages;
--   2) vk_doc_kachest с порядком столбцов dtc -> dtlu (в 0001 было dtlu -> dtc).
--
-- Ничего нового по смыслу не добавляется: фиксируется то, что уже работает.
-- Файл нужен, чтобы verify-migrations.cjs снова сходился и чтобы база,
-- собранная с нуля по 0001..0004, получалась такой же, как живая.
--
-- Особенности:
-- * Справочники создаются через DROP TABLE IF EXISTS + CREATE TABLE, поэтому
--   файл одинаково работает и на живой базе (таблицы уже есть), и на пустой
--   (таблиц нет). Справочные строки переносятся явными INSERT — это данные
--   словарей, а не рабочие записи (см. правило 5 в MIGRATIONS.md).
--   Если после 17.11.2026 в эти справочники добавили строки, при накате на
--   живую базу они будут потеряны: сначала сверьтесь с базой.
-- * vk_doc_kachest пересобирается по тому же образцу, что 0002/0003: данные
--   сначала складываются в vk_doc_kachest_old, затем возвращаются.
--   Для живой базы это только порядок столбцов, данные не меняются.
--
-- Применять ОДИН раз, после 0003.
-- ==========================================================================

PRAGMA foreign_keys = OFF;

BEGIN;

-- --------------------------------------------------------------------------
-- 1. Справочники испытаний
-- --------------------------------------------------------------------------

DROP TABLE IF EXISTS isp_result;
CREATE TABLE isp_result (
    id   INTEGER PRIMARY KEY AUTOINCREMENT
                 NOT NULL,
    name TEXT    NOT NULL
);
INSERT INTO isp_result (id, name) VALUES
    (0, 'нет данных'),
    (1, 'соотвествует'),
    (2, 'не соотвествует'),
    (3, 'с ограничениями');

DROP TABLE IF EXISTS isp_stg_status;
CREATE TABLE isp_stg_status (
    id     INTEGER PRIMARY KEY AUTOINCREMENT
                       NOT NULL,
    name  TEXT    NOT NULL
);
INSERT INTO isp_stg_status (id, name) VALUES
    (1, 'не начато'),
    (2, 'в работе'),
    (3, 'на таймере'),
    (4, 'завершено');

DROP TABLE IF EXISTS vk_isp_stages;
CREATE TABLE vk_isp_stages (
    id       INTEGER PRIMARY KEY AUTOINCREMENT
                        NOT NULL,
    name TEXT    NOT NULL,
    full_name TEXT,
    info      TEXT
);

-- --------------------------------------------------------------------------
-- 2. vk_doc_kachest: порядок столбцов dtc -> dtlu, как в живой базе
-- --------------------------------------------------------------------------

-- 2.1. Сохраняем строки.
CREATE TABLE vk_doc_kachest_old AS
SELECT * FROM vk_doc_kachest;

-- 2.2. Удаляем старую таблицу (триггер удаляется вместе с ней).
DROP TABLE vk_doc_kachest;

-- 2.3. Создаём заново — DDL ровно как в живой базе.
CREATE TABLE vk_doc_kachest (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, number TEXT NOT NULL, ts_doc INTEGER, name TEXT, full_name TEXT, info TEXT, ts INTEGER, dtc TEXT DEFAULT (datetime('now', 'localtime')), dtlu TEXT, user TEXT DEFAULT ('System'));

-- 2.4. Возвращаем строки.
INSERT INTO vk_doc_kachest
    (id, number, ts_doc, name, full_name, info, ts, dtc, dtlu, user)
SELECT id, number, ts_doc, name, full_name, info, ts, dtc, dtlu, user
  FROM vk_doc_kachest_old;

DROP TABLE vk_doc_kachest_old;

-- 2.5. Восстанавливаем автоинкремент.
INSERT INTO sqlite_sequence (name, seq)
SELECT 'vk_doc_kachest', COALESCE((SELECT MAX(id) FROM vk_doc_kachest), 0)
 WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'vk_doc_kachest');

-- 2.6. Пересоздаём триггер отметки времени.
CREATE TRIGGER trg_vk_doc_kachest_dtlu AFTER UPDATE OF number, ts_doc, name, full_name, info ON vk_doc_kachest FOR EACH ROW WHEN OLD.number IS NOT NEW.number OR OLD.ts_doc IS NOT NEW.ts_doc OR OLD.name IS NOT NEW.name OR OLD.full_name IS NOT NEW.full_name OR OLD.info IS NOT NEW.info BEGIN UPDATE vk_doc_kachest SET dtlu = datetime('now', 'localtime') WHERE id = NEW.id; END;

COMMIT;

PRAGMA foreign_keys = ON;
