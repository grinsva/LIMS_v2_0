# AGENT-NOTES — как агенту работать с базой

Служебная памятка для ИИ-агента. Человеку полезнее `DB-WORKFLOW.txt`; правила,
обязательные к исполнению, лежат в `AGENTS.md` (раздел 2), здесь — «как именно».

**Читать перед любой работой с `db/sqliteDb/hist.db`**: чтением структуры,
диагностикой, резервной копией, правкой, накатом миграций.

Дата последней ревизии: 17.11.2026 (по итогам работы над `vk_shipment.id_product`).

## 1. Чем работать

| Инструмент | Путь / запуск | Для чего |
|---|---|---|
| Python 3 (sqlite3 3.43.2) | `C:\Program Files\Inkscape\bin\python.exe` | разовые задачи: осмотр, выборки, копии, накат миграций, сверка двух баз |
| Node.js 22 (`node:sqlite` 3.47.2) | `node` | всё, что остаётся в репозитории: `dump-schema.cjs`, `verify-migrations.cjs`, будущие проверки |
| SQLiteStudio CLI | `C:\Program Files\SQLiteStudio\sqlitestudiocli.exe -e файл.sql база.db` | только перекрёстная проверка файла миграции «в чужом клиенте» |

`sqlite3.exe` в системе **не установлен**.

Замеры на этой базе (чтение `sqlite_master` + `pragma table_info` по всем
таблицам + `count(*)`, 3 прогона):

| Инструмент | Запуск | Поведение при ошибке SQL |
|---|---|---|
| Python | 47–69 мс | код 1, traceback |
| Node.js | 48–68 мс | код 1, `Error: no such table: ...` |
| SQLiteStudio CLI | 64 мс (первый ~350 мс) | **код 0**, текст ошибки в выводе |

Скорость запуска у Python и Node одинаковая, поэтому «быстрее» — это про время
на написание и отладку команды, а не про рантайм.

**Выводы:**

- Python — по умолчанию для разовой работы: пишется файл целиком, без
  экранирования кавычек PowerShell, легко совмещать SQL с логикой (сверка,
  JSON, циклы).
- Node — для повторяемых проверок в репозитории: тот же рантайм, что у проекта,
  ничего ставить не нужно; русский текст в консоли выводится нормально.
- SQLiteStudio CLI — **не автоматизировать**: на ошибке SQL возвращает код 0,
  поэтому в проверках на него опираться нельзя. Годится, чтобы вручную
  убедиться, что файл миграции работает вне нашего кода.
- GUI SQLiteStudio держит файл открытым и кэширует состояние: правки извне в нём
  не видны до обновления, а запись может получить `database is locked`.

Кириллица: Python через PowerShell по умолчанию пишет в cp866 и превращает
русский текст в `�����`. Либо `chcp 65001` перед запуском, либо вывод в
файл/JSON и чтение файла. Node такой проблемы не имеет.

## 2. Правила, появившиеся из реальных ошибок

1. **Скрипт — в файл, а не однострочник.** `python -c "..."` и `node -e "..."`
   через PowerShell требуют многослойного экранирования, и в них легко
   перепутать порядок аргументов. Именно так 17.11.2026 живая база была
   обнулена (см. раздел 4).
2. **Резервная копия — только через backup API, и направление проверять.**
   `Connection.backup(target)` копирует **из себя в target**. Копировать файл
   через `Copy-Item` нельзя: в режиме WAL часть изменений лежит в `hist.db-wal`.
   После копии — убедиться, что в копии есть таблицы (см. шаблон ниже).
3. **После правки — `PRAGMA wal_checkpoint(TRUNCATE)`.** Иначе изменения
   останутся в `hist.db-wal`, сам `hist.db` не изменится, и `git status` не
   покажет ничего: правка «исчезнет» из диффа и не попадёт в коммит.
4. **Результат проверять скриптами проекта**, а не своим кодом:
   `node db/schema/dump-schema.cjs --check` и
   `node db/schema/verify-migrations.cjs`. «У меня работает» и «проверка
   проходит» должны означать одно и то же.
5. **`PRAGMA integrity_check` на этой базе не запускать.** Он читает все
   страницы всех таблиц, включая защищённые (`records`, `timeline`,
   `customtable`) — это нарушает правило 2 из `AGENTS.md`, и всё равно падает
   с `database disk image is malformed` (повреждение было до внедрения
   миграций). Для проверки результата достаточно `dump-schema --check` и
   `verify-migrations`.
6. **Повторять операцию при `database is locked`.** Базу может держать
   SQLiteStudio или приложение; рабочий приём — цикл с паузой 3 секунды и
   ограничением попыток.
7. **Проверять DDL побайтно, когда миграция должна воспроизвести структуру.**
   `verify-migrations.cjs` сравнивает текст DDL из `sqlite_master`, а не
   «смысл»: лишний пробел или `IF NOT EXISTS` дают расхождение. Тексты
   существующих объектов брать из базы (`select sql from sqlite_master`), а не
   набирать руками.

## 3. Шаблоны

### Резервная копия

```python
import sqlite3, datetime

DB  = r"C:\ProgramData\IntraSCADA\intrascada\projects\LIMS_v2_0\db\sqliteDb\hist.db"
BAK = rf"C:\Users\adminNAV\AppData\Local\Temp\opencode\hist-backup-{datetime.datetime.now():%Y%m%d-%H%M%S}.db"

src = sqlite3.connect(DB, timeout=30)   # источник
dst = sqlite3.connect(BAK)              # цель
src.backup(dst)                         # src -> dst, НЕ наоборот
dst.close(); src.close()

c = sqlite3.connect(BAK)                # проверка, что копия не пустая
n = c.execute("select count(*) from sqlite_master where type='table'").fetchone()[0]
assert n > 0, "копия пустая — направление backup() перепутано"
c.close()
```

### Накат миграции

```python
import sqlite3, io, time, sys

DB  = r"...\db\sqliteDb\hist.db"
SQL = r"...\db\schema\000N_имя.sql"
script = io.open(SQL, encoding="utf-8").read()

for attempt in range(1, 21):
    con = sqlite3.connect(DB, timeout=30, isolation_level=None)
    try:
        con.execute("PRAGMA foreign_keys = OFF")   # PRAGMA — до BEGIN
        con.executescript(script)                  # BEGIN/COMMIT уже в файле
        con.close()
        break
    except sqlite3.OperationalError as e:
        con.close()
        if "locked" not in str(e):
            raise
        time.sleep(3)
else:
    sys.exit(1)

con = sqlite3.connect(DB, timeout=30, isolation_level=None)
print(con.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone())  # (0, 0, 0) — ок
con.close()
```

### Осмотр базы (только чтение)

```python
import sqlite3
con = sqlite3.connect(r"...\hist.db", timeout=15)
con.text_factory = bytes          # обход cp866
for r in con.execute("pragma table_info('vk_shipment')"):
    print(tuple(x.decode('utf-8') if isinstance(x, bytes) else x for x in r))
con.close()
```

## 4. Разбор инцидента 17.11.2026

Что произошло: при снятии второй резервной копии был вызван
`d.backup(s)`, где `d` — пустой целевой файл, а `s` — живая база. Вызов читается
как «скопировать d в s», то есть пустая база записалась в живую. `hist.db`
превратился в 4096 байт с нулём таблиц.

Как восстановлено: из копии, снятой за ~30 секунд до этого через
`src.backup(dst)` (147456 байт, вместе с содержимым `-wal`). После восстановления
проверены: число таблиц, объекты схемы, строка `vk_shipment` (id=0), справочники,
сохранность `sqlite_sequence`, затем оба скрипта проверки.

Чему это учит (всё уже в правилах выше):

- однострочник с позиционными аргументами — главный риск, писать в файл;
- у `backup()` направление обратное интуиции: `self` → `target`;
- копию надо проверять сразу после создания, а не когда она понадобится;
- в WAL-режиме «копия файла» и «копия базы» — разные вещи.

## 5. Чек-лист после любой правки базы

1. Копия снята и проверена (в ней есть таблицы).
2. Миграция написана, применена один раз, файл не переписывался после наката.
3. `node db/schema/dump-schema.cjs` — снимок пересобран.
4. `node db/schema/verify-migrations.cjs` — `ok`.
5. `node db/schema/dump-schema.cjs --check` — код 0.
6. `PRAGMA wal_checkpoint(TRUNCATE)` выполнен, `hist.db` изменился и виден в `git status`.
7. Данные контрольных строк на месте (`id=0` «не задано» и т.п.) — проверено
   выборочно, без чтения защищённых таблиц.
