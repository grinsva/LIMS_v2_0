-- ==========================================================================
-- 0003_add_vk_shipment_id_product.sql
--
-- Что делает: добавляет в vk_shipment столбец id_product — внешний ключ
-- на vk_product(id), по той же конвенции, что и остальные ссылки в этой базе:
--   DEFAULT (0), ON DELETE SET DEFAULT, ON UPDATE CASCADE.
-- Заодно дополняет триггер trg_vk_shipment_dtlu этим столбцом.
--
-- Почему таблица пересобирается, а не ALTER TABLE ADD COLUMN:
-- SQLite не разрешает добавлять колонку с REFERENCES и значением по умолчанию,
-- отличным от NULL, а конвенция проекта требует DEFAULT (0) — на строку id=0
-- "не задано" из vk_product.
--
-- Способ пересборки тот же, что в 0002: данные складываются в vk_shipment_old
-- через CREATE TABLE ... AS SELECT, таблица создаётся заново под своим именем
-- (так DDL в sqlite_master остаётся ровно таким, как написано здесь).
--
-- Применять ОДИН раз, после 0002. Повторное применение перезапишет
-- id_product значением 0 (в SQLite нет "ADD COLUMN IF NOT EXISTS").
-- ==========================================================================

PRAGMA foreign_keys = OFF;

BEGIN;

-- 1. Сохраняем текущие данные.
CREATE TABLE vk_shipment_old AS
SELECT * FROM vk_shipment;

-- 2. Удаляем старую таблицу (её триггеры удаляются вместе с ней).
DROP TABLE vk_shipment;

-- 3. Создаём таблицу с новым столбцом id_product.
CREATE TABLE vk_shipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    number TEXT,
    mass TEXT,
    ts_in INTEGER,
    id_part TEXT,
    id_auto INTEGER REFERENCES vk_auto (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0),
    id_provider INTEGER REFERENCES vk_provider (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0),
    id_doc_kachest INTEGER REFERENCES vk_doc_kachest (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0),
    id_aw INTEGER REFERENCES auto_weigths (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0),
    id_prod_item INTEGER REFERENCES vk_prod_item (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0),
    id_product INTEGER REFERENCES vk_product (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0),
    ts INTEGER,
    dtc TEXT DEFAULT (datetime('now', 'localtime')),
    dtlu TEXT,
    user TEXT DEFAULT ('System')
);

-- 4. Возвращаем данные. Для прежних строк id_product получает DEFAULT 0.
INSERT INTO vk_shipment
    (id, number, mass, ts_in, id_part, id_auto, id_provider,
     id_doc_kachest, id_aw, id_prod_item, ts, dtc, dtlu, user)
SELECT
    id, number, mass, ts_in, id_part, id_auto, id_provider,
    id_doc_kachest, id_aw, id_prod_item, ts, dtc, dtlu, user
  FROM vk_shipment_old;

DROP TABLE vk_shipment_old;

-- 5. Восстанавливаем автоинкремент (DROP TABLE стирает строку из sqlite_sequence).
INSERT INTO sqlite_sequence (name, seq)
SELECT 'vk_shipment', COALESCE((SELECT MAX(id) FROM vk_shipment), 0)
 WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'vk_shipment');

-- 6. Пересоздаём триггер отметки времени, добавляя в него id_product.
CREATE TRIGGER trg_vk_shipment_dtlu AFTER UPDATE OF number, mass, ts_in, id_part, id_auto, id_provider, id_doc_kachest, id_aw, id_prod_item, id_product ON vk_shipment FOR EACH ROW WHEN OLD.number IS NOT NEW.number OR OLD.mass IS NOT NEW.mass OR OLD.ts_in IS NOT NEW.ts_in OR OLD.id_part IS NOT NEW.id_part OR OLD.id_auto IS NOT NEW.id_auto OR OLD.id_provider IS NOT NEW.id_provider OR OLD.id_doc_kachest IS NOT NEW.id_doc_kachest OR OLD.id_aw IS NOT NEW.id_aw OR OLD.id_prod_item IS NOT NEW.id_prod_item OR OLD.id_product IS NOT NEW.id_product BEGIN UPDATE vk_shipment SET dtlu = datetime('now', 'localtime') WHERE id = NEW.id; END;

COMMIT;

PRAGMA foreign_keys = ON;

-- Проверка результата (выполнить вручную при необходимости):
--   select * from pragma_table_info('vk_shipment') where name = 'id_product';
--   select * from pragma_foreign_key_list('vk_shipment');
