-- ==========================================================================
-- 0006_fix_vk_isp_and_isp_status.sql
--
-- Что делает (одна правка по смыслу — привести vk_isp к конвенции проекта):
--   1. isp_status: столбец id_pk переименовывается в id, как в остальных
--      справочниках (isp_result, isp_stg_status, vk_isp_stages).
--   2. vk_isp пересобирается:
--        * id_status ссылается на isp_status (id) вместо (id_pk);
--        * result_isp DEFAULT (1) -> DEFAULT (0): 0 — это «нет данных»
--          в справочнике isp_result, 1 — «соотвествует».
--   3. создаётся триггер trg_vk_isp_dtlu — такой же, как у остальных таблиц
--      с dtc/dtlu: при изменении полей обновляет dtlu.
--
-- Почему пересборка, а не ALTER: в SQLite нельзя изменить ни ссылку внешнего
-- ключа, ни значение по умолчанию у существующего столбца. Способ тот же,
-- что в 0002/0003/0004.
--
-- Данные: на момент создания файла vk_isp пуста, но строки всё равно
-- переносятся через vk_isp_old — файл не должен терять данные, если их успели
-- добавить. В isp_status переименование столбца данные не затрагивает.
--
-- Применять ОДИН раз, после 0005.
-- ==========================================================================

PRAGMA foreign_keys = OFF;

BEGIN;

-- --------------------------------------------------------------------------
-- 1. vk_isp: сохранить строки и удалить старую таблицу
-- --------------------------------------------------------------------------

CREATE TABLE vk_isp_old AS
SELECT * FROM vk_isp;

DROP TABLE vk_isp;

-- --------------------------------------------------------------------------
-- 2. isp_status: id_pk -> id
-- --------------------------------------------------------------------------

ALTER TABLE isp_status RENAME COLUMN id_pk TO id;

-- --------------------------------------------------------------------------
-- 3. vk_isp: создать заново
-- --------------------------------------------------------------------------

CREATE TABLE vk_isp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_zv INTEGER REFERENCES vk_zvk (id) ON DELETE CASCADE ON UPDATE CASCADE,
    id_status INTEGER REFERENCES isp_status (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (1),
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
    result_isp INTEGER REFERENCES isp_result (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0),
    result_info TEXT,
    result_user TEXT DEFAULT ('System')
);

-- --------------------------------------------------------------------------
-- 4. Вернуть строки
-- --------------------------------------------------------------------------

INSERT INTO vk_isp
    (id, id_zv, id_status, num_stage, id_stage, id_stg_status, ts_opn, ts_upd,
     ts_cls, user, info, num_otbr, num_prot, ts_otbr, ts_prot, dtc, dtlu,
     result_isp, result_info, result_user)
SELECT
     id, id_zv, id_status, num_stage, id_stage, id_stg_status, ts_opn, ts_upd,
     ts_cls, user, info, num_otbr, num_prot, ts_otbr, ts_prot, dtc, dtlu,
     result_isp, result_info, result_user
  FROM vk_isp_old;

DROP TABLE vk_isp_old;

-- --------------------------------------------------------------------------
-- 5. Автоинкремент: строку в sqlite_sequence создаём только если данные были
-- --------------------------------------------------------------------------

INSERT INTO sqlite_sequence (name, seq)
SELECT 'vk_isp', COALESCE((SELECT MAX(id) FROM vk_isp), 0)
 WHERE (SELECT COUNT(*) FROM vk_isp) > 0
   AND NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'vk_isp');

-- --------------------------------------------------------------------------
-- 6. Триггер отметки времени
-- --------------------------------------------------------------------------

CREATE TRIGGER trg_vk_isp_dtlu AFTER UPDATE OF id_zv, id_status, num_stage, id_stage, id_stg_status, ts_opn, ts_upd, ts_cls, user, info, num_otbr, num_prot, ts_otbr, ts_prot, result_isp, result_info, result_user ON vk_isp FOR EACH ROW WHEN OLD.id_zv IS NOT NEW.id_zv OR OLD.id_status IS NOT NEW.id_status OR OLD.num_stage IS NOT NEW.num_stage OR OLD.id_stage IS NOT NEW.id_stage OR OLD.id_stg_status IS NOT NEW.id_stg_status OR OLD.ts_opn IS NOT NEW.ts_opn OR OLD.ts_upd IS NOT NEW.ts_upd OR OLD.ts_cls IS NOT NEW.ts_cls OR OLD.user IS NOT NEW.user OR OLD.info IS NOT NEW.info OR OLD.num_otbr IS NOT NEW.num_otbr OR OLD.num_prot IS NOT NEW.num_prot OR OLD.ts_otbr IS NOT NEW.ts_otbr OR OLD.ts_prot IS NOT NEW.ts_prot OR OLD.result_isp IS NOT NEW.result_isp OR OLD.result_info IS NOT NEW.result_info OR OLD.result_user IS NOT NEW.result_user BEGIN UPDATE vk_isp SET dtlu = datetime('now', 'localtime') WHERE id = NEW.id; END;

COMMIT;

PRAGMA foreign_keys = ON;
