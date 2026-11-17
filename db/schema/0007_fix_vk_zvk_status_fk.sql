-- ==========================================================================
-- 0007_fix_vk_zvk_status_fk.sql
--
-- Что делает: исправляет внешний ключ vk_zvk.status — ссылку на
-- zv_status (id_pk), которого не существует, на zv_status (id).
--
-- Причина: у справочника zv_status первичный ключ называется id
--   CREATE TABLE zv_status (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
-- а в vk_zvk было указано REFERENCES zv_status (id_pk). SQLite не проверяет
-- это при создании таблицы, но на первой же вставке со status не NULL
-- выдаёт "foreign key mismatch - vk_zvk referencing zv_status".
-- То же самое ломало pragma foreign_key_check по всей базе.
--
-- Меняется только ссылка; ON DELETE / ON UPDATE остаются NO ACTION, как было.
-- Таблица пересобирается по образцу 0002/0003/0006, данные сохраняются
-- (на момент создания файла vk_zvk пуста).
--
-- Применять ОДИН раз, после 0006.
-- ==========================================================================

PRAGMA foreign_keys = OFF;

BEGIN;

-- 1. Сохраняем строки.
CREATE TABLE vk_zvk_old AS
SELECT * FROM vk_zvk;

-- 2. Удаляем старую таблицу.
DROP TABLE vk_zvk;

-- 3. Создаём заново — отличается только строка status.
CREATE TABLE vk_zvk (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    id_vid_probi INTEGER REFERENCES vk_vid_probi (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0),
    id_product INTEGER REFERENCES vk_product (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0),
    id_prod_item INTEGER REFERENCES vk_prod_item (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0),
    id_shipment INTEGER DEFAULT (0) REFERENCES vk_shipment (id) ON DELETE SET DEFAULT ON UPDATE CASCADE,
    id_lab INTEGER REFERENCES labs (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0),
    id_gost INTEGER REFERENCES vk_gost (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0),
    creator TEXT DEFAULT ('System'),
    user TEXT DEFAULT ('System'),
    ts_crt INTEGER,
    ts_opn INTEGER,
    ts_upd INTEGER,
    ts_cls INTEGER,
    dtc TEXT DEFAULT (datetime('now', 'localtime')),
    dtlu TEXT,
    status INTEGER REFERENCES zv_status (id),
    info TEXT
);

-- 4. Возвращаем строки.
INSERT INTO vk_zvk
    (id, id_vid_probi, id_product, id_prod_item, id_shipment, id_lab, id_gost,
     creator, user, ts_crt, ts_opn, ts_upd, ts_cls, dtc, dtlu, status, info)
SELECT
     id, id_vid_probi, id_product, id_prod_item, id_shipment, id_lab, id_gost,
     creator, user, ts_crt, ts_opn, ts_upd, ts_cls, dtc, dtlu, status, info
  FROM vk_zvk_old;

DROP TABLE vk_zvk_old;

-- 5. Автоинкремент: строку в sqlite_sequence создаём только если данные были.
INSERT INTO sqlite_sequence (name, seq)
SELECT 'vk_zvk', COALESCE((SELECT MAX(id) FROM vk_zvk), 0)
 WHERE (SELECT COUNT(*) FROM vk_zvk) > 0
   AND NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'vk_zvk');

COMMIT;

PRAGMA foreign_keys = ON;
