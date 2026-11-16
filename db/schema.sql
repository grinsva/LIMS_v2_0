-- ==========================================================================
-- schema.sql — структура базы данных (только DDL, без данных)
--
-- Источник  : db/sqliteDb/hist.db
-- Генератор : node db/dump-schema.cjs
-- Проверка  : node db/dump-schema.cjs --check
--
-- Файл пересобирается скриптом. Руками не править: правка потеряется.
-- Подробности: db/README.md
-- ==========================================================================

-- ***** ТАБЛИЦЫ (20) *****

-- table: auto_weigths
CREATE TABLE auto_weigths (
    id    INTEGER PRIMARY KEY
                     NOT NULL,
    name  TEXT,
    full_name  TEXT,
    id_lab       INTEGER REFERENCES labs (id) ON DELETE SET DEFAULT
                                              ON UPDATE CASCADE
                         DEFAULT (0)
);

-- table: bsu
CREATE TABLE bsu (id NUMERIC PRIMARY KEY NOT NULL, name TEXT NOT NULL, id_lab INTEGER REFERENCES labs (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0));

-- table: customtable
CREATE TABLE customtable (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, ts INTEGER NOT NULL, payload TEXT);

-- table: formulas
CREATE TABLE formulas (id INTEGER PRIMARY KEY NOT NULL, rid TEXT NOT NULL, title TEXT NOT NULL, description TEXT, comments TEXT, active INTEGER, ts INTEGER, jhead TEXT, jrows TEXT);

-- table: isp_status
CREATE TABLE isp_status (
    id_pk      INTEGER PRIMARY KEY AUTOINCREMENT
                       NOT NULL,
    name TEXT    NOT NULL
);

-- table: labs
CREATE TABLE labs (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);

-- table: pk_auto
CREATE TABLE pk_auto (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT NOT NULL UNIQUE, name TEXT, ts INTEGER, dtc TEXT DEFAULT (datetime('now', 'localtime')), dtlu TEXT, user TEXT DEFAULT ('System'));

-- table: records
CREATE TABLE records (id INTEGER PRIMARY KEY NOT NULL,ts INTEGER NOT NULL,dn TEXT NOT NULL,prop TEXT,val REAL);

-- table: strrecords
CREATE TABLE strrecords (id INTEGER PRIMARY KEY NOT NULL,ts INTEGER NOT NULL,dn TEXT NOT NULL,prop TEXT,val TEXT);

-- table: timeline
CREATE TABLE timeline (id INTEGER PRIMARY KEY NOT NULL,dn TEXT NOT NULL,prop TEXT,start INTEGER  NOT NULL,end INTEGER NOT NULL,state char(8));

-- table: vk_auto
CREATE TABLE vk_auto (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT NOT NULL UNIQUE, name TEXT, ts INTEGER, dtc TEXT DEFAULT (datetime('now', 'localtime')), dtlu TEXT, user TEXT DEFAULT ('System'));

-- table: vk_doc_kachest
CREATE TABLE vk_doc_kachest (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, number TEXT NOT NULL, ts_doc INTEGER, name TEXT, full_name TEXT, info TEXT, ts INTEGER, dtlu TEXT, dtc TEXT DEFAULT (datetime('now', 'localtime')), user TEXT DEFAULT ('System'));

-- table: vk_gost
CREATE TABLE vk_gost (
    id        INTEGER PRIMARY KEY AUTOINCREMENT
                      NOT NULL,
    name      TEXT    NOT NULL,
    full_name TEXT,
    info TEXT
);

-- table: vk_prod_item
CREATE TABLE vk_prod_item (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name TEXT NOT NULL, id_product INTEGER REFERENCES vk_product (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0), ts INTEGER, dtc TEXT DEFAULT (datetime('now', 'localtime')), dtlu TEXT, user TEXT DEFAULT ('System'), bsu_id NUMERIC DEFAULT (0) NOT NULL REFERENCES bsu (id) ON DELETE SET DEFAULT ON UPDATE CASCADE, bsu_comp_id INTEGER, bsu_comp_type_id INTEGER, bsu_data TEXT, bsu_code_asu TEXT);

-- table: vk_product
CREATE TABLE vk_product (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name TEXT NOT NULL, full_name TEXT);

-- table: vk_provider
CREATE TABLE vk_provider (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name TEXT NOT NULL ON CONFLICT FAIL, full_name TEXT, id_product INTEGER REFERENCES vk_product (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0), id_prod_item INTEGER REFERENCES vk_prod_item (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0), user TEXT DEFAULT System, ts INTEGER, dtc TEXT DEFAULT (datetime('now', 'localtime')), dtlu TEXT);

-- table: vk_shipment
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
    ts INTEGER,
    dtc TEXT DEFAULT (datetime('now', 'localtime')),
    dtlu TEXT,
    user TEXT DEFAULT ('System')
);

-- table: vk_vid_probi
CREATE TABLE vk_vid_probi (
    id        INTEGER PRIMARY KEY AUTOINCREMENT
                      NOT NULL,
    name      TEXT    NOT NULL,
    full_name TEXT
);

-- table: vk_zvk
CREATE TABLE vk_zvk (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, id_vid_probi INTEGER REFERENCES vk_vid_probi (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0), id_product INTEGER REFERENCES vk_product (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0), id_prod_item INTEGER REFERENCES vk_prod_item (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0), id_shipment INTEGER DEFAULT (0) REFERENCES vk_shipment (id) ON DELETE SET DEFAULT ON UPDATE CASCADE, id_lab INTEGER REFERENCES labs (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0), id_gost INTEGER REFERENCES vk_gost (id) ON DELETE SET DEFAULT ON UPDATE CASCADE DEFAULT (0), creator TEXT DEFAULT ('System'), user TEXT DEFAULT ('System'), ts_crt INTEGER, ts_opn INTEGER, ts_upd INTEGER, ts_cls INTEGER, dtc TEXT DEFAULT (datetime('now', 'localtime')), dtlu TEXT, status INTEGER REFERENCES zv_status (id_pk), info TEXT);

-- table: zv_status
CREATE TABLE zv_status (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);

-- ***** ИНДЕКСЫ (4) *****

-- index: idx_name
CREATE INDEX idx_name ON customtable (name);

-- index: idx_records_dnts
CREATE INDEX idx_records_dnts ON records (dn, ts);

-- index: idx_records_start
CREATE INDEX idx_records_start ON timeline (start);

-- index: idx_strrecords_dnts
CREATE INDEX idx_strrecords_dnts ON strrecords (dn, ts);

-- ***** ТРИГГЕРЫ (6) *****

-- trigger: trg_pk_auto_dtlu
CREATE TRIGGER trg_pk_auto_dtlu AFTER UPDATE OF number, name ON pk_auto FOR EACH ROW WHEN OLD.number IS NOT NEW.number OR OLD.name IS NOT NEW.name BEGIN UPDATE pk_auto SET dtlu = datetime('now', 'localtime') WHERE id = NEW.id; END;

-- trigger: trg_vk_auto_dtlu
CREATE TRIGGER trg_vk_auto_dtlu AFTER UPDATE OF number, name ON vk_auto FOR EACH ROW WHEN OLD.number IS NOT NEW.number OR OLD.name IS NOT NEW.name BEGIN UPDATE vk_auto SET dtlu = datetime('now', 'localtime') WHERE id = NEW.id; END;

-- trigger: trg_vk_doc_kachest_dtlu
CREATE TRIGGER trg_vk_doc_kachest_dtlu AFTER UPDATE OF number, ts_doc, name, full_name, info ON vk_doc_kachest FOR EACH ROW WHEN OLD.number IS NOT NEW.number OR OLD.ts_doc IS NOT NEW.ts_doc OR OLD.name IS NOT NEW.name OR OLD.full_name IS NOT NEW.full_name OR OLD.info IS NOT NEW.info BEGIN UPDATE vk_doc_kachest SET dtlu = datetime('now', 'localtime') WHERE id = NEW.id; END;

-- trigger: trg_vk_prod_item_dtlu
CREATE TRIGGER trg_vk_prod_item_dtlu AFTER UPDATE OF name, id_product, bsu_id, bsu_comp_id, bsu_comp_type_id, bsu_data, bsu_code_asu ON vk_prod_item FOR EACH ROW WHEN OLD.name IS NOT NEW.name OR OLD.id_product IS NOT NEW.id_product OR OLD.bsu_id IS NOT NEW.bsu_id OR OLD.bsu_comp_id IS NOT NEW.bsu_comp_id OR OLD.bsu_comp_type_id IS NOT NEW.bsu_comp_type_id OR OLD.bsu_data IS NOT NEW.bsu_data OR OLD.bsu_code_asu IS NOT NEW.bsu_code_asu BEGIN UPDATE vk_prod_item SET dtlu = datetime('now', 'localtime') WHERE id = NEW.id; END;

-- trigger: trg_vk_provider_dtlu
CREATE TRIGGER trg_vk_provider_dtlu AFTER UPDATE OF name, full_name, id_product, id_prod_item ON vk_provider FOR EACH ROW WHEN OLD.name IS NOT NEW.name OR OLD.full_name IS NOT NEW.full_name OR OLD.id_product IS NOT NEW.id_product OR OLD.id_prod_item IS NOT NEW.id_prod_item BEGIN UPDATE vk_provider SET dtlu = datetime('now', 'localtime') WHERE id = NEW.id; END;

-- trigger: trg_vk_shipment_dtlu
CREATE TRIGGER trg_vk_shipment_dtlu AFTER UPDATE OF number, mass, ts_in, id_part, id_auto, id_provider, id_doc_kachest, id_aw, id_prod_item ON vk_shipment FOR EACH ROW WHEN OLD.number IS NOT NEW.number OR OLD.mass IS NOT NEW.mass OR OLD.ts_in IS NOT NEW.ts_in OR OLD.id_part IS NOT NEW.id_part OR OLD.id_auto IS NOT NEW.id_auto OR OLD.id_provider IS NOT NEW.id_provider OR OLD.id_doc_kachest IS NOT NEW.id_doc_kachest OR OLD.id_aw IS NOT NEW.id_aw OR OLD.id_prod_item IS NOT NEW.id_prod_item BEGIN UPDATE vk_shipment SET dtlu = datetime('now', 'localtime') WHERE id = NEW.id; END;
