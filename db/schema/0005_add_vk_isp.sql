-- ==========================================================================
-- 0005_add_vk_isp.sql
--
-- Что делает: создаёт таблицу vk_isp — результаты/этапы испытаний по заявке.
--
-- Отличия от присланного DDL (смысл не меняется):
--   * id_status ссылается на isp_status (id_pk), а не (id): первичный ключ
--     справочника isp_status называется id_pk, столбца id в нём нет.
--     Ссылка на (id) создала бы внешний ключ, который не работает —
--     первый INSERT с id_status падал бы с
--     "foreign key mismatch - vk_isp referencing isp_status".
--   * iNTEGER -> INTEGER, табы -> пробелы: регистр и отступы в SQLite
--     значения не имеют, но этот текст попадает в schema.sql как есть.
--
-- Особенности данных (не ошибка файла, но важно знать):
--   * vk_isp_stages пока пуста. id_stage имеет DEFAULT (1) и
--     ON DELETE SET DEFAULT (1), поэтому INSERT без явного id_stage будет
--     нарушать внешний ключ, пока в справочнике нет строки id = 1.
--   * vk_zvk пока пуста, так что ON DELETE CASCADE по id_zv сейчас ни на что
--     не влияет.
--
-- Применять ОДИН раз, после 0004.
-- ==========================================================================

BEGIN;

CREATE TABLE vk_isp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_zv INTEGER REFERENCES vk_zvk (id) ON DELETE CASCADE ON UPDATE CASCADE,
    id_status INTEGER REFERENCES isp_status (id_pk) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (1),
    num_stage INTEGER DEFAULT (1),
    id_stage INTEGER REFERENCES vk_isp_stages (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (1),
    id_stg_status INTEGER REFERENCES isp_stg_status (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (1),
    ts_opn INTEGER,
    ts_upd INTEGER,
    ts_cls INTEGER,
    user TEXT DEFAULT ('System'),
    info TEXT,
    num_otbr TEXT,
    num_prot TEXT,
    ts_otbr INTEGER,
    ts_prot INTEGER,
    dtc TEXT DEFAULT (datetime('now', 'localtime')),
    dtlu TEXT,
    result_isp INTEGER REFERENCES isp_result (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (1),
    result_info TEXT,
    result_user TEXT DEFAULT ('System')
);

COMMIT;
