---
name: LIMS jbase UI
description: Проектные детали LIMS_v2.0 по интерфейсу jbase — конкретные ID, размеры, адреса админки и примеры этой установки. Дополнение к универсальному скиллу IntraScada UI; в меню не показывается, загружать по ID lims-jbase-ui.
metadata:
  opencode/autoinvoke: false
---

# Интерфейс LIMS в `jbase`

Скилл про слой UI IntraSCADA: JSON-документы и журналы `jbase`, кнопки/действия,
локальные переменные, переключение контейнеров, картинки. Правила работы с
проектом и с SQLite (`db/sqliteDb/hist.db`) — в `AGENTS.md`, здесь их нет.

## 1. Где что лежит

```
PROJECT\jbase\
  layout\layoutNNN.json      экран (сцена)
  container\viscontNNN.json  контейнер (панель/область)
  dialog\diNNNN.json         диалог
  locals.db                  локальные переменные клиента
  layouts.db  visconts.db  dialogs.db  images.db   метаданные (журналы)
PROJECT\images\              файлы картинок (svg, png, ico)
```

Документ экрана/контейнера/диалога — **один JSON без форматирования** (одна
строка). Журналы `jbase/*.db` — **JSONL**: по одному JSON на строку, только
дописывание, для каждого `_id` действует **последняя** запись. Приложение
периодически уплотняет журналы.

Чтение журнала:

```js
const fs = require('fs');
const rows = fs.readFileSync('jbase/visconts.db', 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const map = new Map(rows.map(r => [r._id, r]));   // последняя запись побеждает
```

## 2. Права на файлы

- `jbase/*.db` обычно **только для чтения** обычному пользователю. Запись —
  через отдельный node-скрипт, запущенный с повышением прав:

```powershell
$node = (Get-Command node).Source
$p = Start-Process -FilePath $node -ArgumentList ('"' + $script + '"') `
     -WorkingDirectory (Get-Location).Path -Verb RunAs -WindowStyle Hidden -Wait -PassThru
"exit=$($p.ExitCode)"
```

  Скрипт обязан быть идемпотентным (не дописывать запись, если `_id` уже есть) и
  печатать, что именно добавлено; код возврата проверять.
- `jbase\layout\*.json`, `jbase\container\*.json`, `jbase\dialog\*.json`,
  `images\*` — обычные файлы, пишутся без повышения прав.

## 3. Структура документа

Верхний уровень: `settings`, `list`, `elements`, `selects`, `selectContainer`,
`selectType`, `selectOne`, `propertyType`.

`settings` — размеры и фон сцены/контейнера, например
`{w:{value:1920}, h:{value:1080}, backgroundColor:{type:"fill", value:"rgba(255,255,255,1)", ...}}`.

`list` — порядок отрисовки; `elements` — объект `id → элемент`.

Обязательные поля элемента: `type`, `x`, `y`, `w`, `h`, `w2`, `h2`, `zIndex`,
`opacity`, `visible`, `boxShadow`, `animation`, `overflow`, у не-контейнеров ещё
`backgroundColor`.

- `backgroundColor` — не строка, а объект заливки:
  `{type:"fill", value, fill:value, angle:90, shape:"circle", positionX:50, positionY:50, extent:"closest-side", palette:[{offset:"0.00",color:"#4A90E2",opacity:1},{offset:"1.00",color:"#9013FE",opacity:1}]}`;
  `value` и `fill` дублировать одинаково.
- У элементов `type:"container"` поля `backgroundColor` нет — **это норма**,
  не «исправлять».
- `opacity` — 0…100 и действует на элемент целиком (включая текст).
  Если нужна полупрозрачность **только фона** — писать `rgba(r,g,b,0.43)` в
  `backgroundColor` и оставлять `opacity:100` (предпочтение заказчика).
- Видимость — `visible:{value:true}`; для совместимости дублировать
  `visable:{value:true}`.
- Типовые `type`: `rectangle`, `text`, `button`, `container`, `template`, `group`.

Текст: `text:{value}`, `textSize`, `textBold`, `textItalic`, `textFontFamily`
(`{id:"Arial",title:"Arial"}`), `textAlignH`/`textAlignV` (`{id:"center",title:"Center"}`),
`textRotate`, `textColor`, `lineHeight:{value:100}`.

## 4. Кнопка

Поля: `text`, `textSize`, `textBold`, `textItalic`, `textFontFamily`, `textAlignH`,
`textAlignV`, `textRotate`, `textColor`; блок картинки — **всегда целиком**:
`img:{value:"file.svg", folder:"img066"}`, `imgColor`, `imgSize`, `imgRotate`,
`imgPosition:{value:{id:"left",title:"Слева"}}`, `imgRatio`; `borderSize`,
`borderRadius`, `borderStyle:{value:{id:"solid",title:"Solid"}}`, `borderColor`,
`backgroundColor`, `colorRipple`, `colorHover`, `zIndex`, `opacity`.

Действия: `actions.left` — первый элемент рабочий, дальше пустые заглушки
(`doubleClickLeft`, `longClickLeft`, `mouseDownLeft`, `mouseUpLeft`),
`actions.right` — `singleClickRight`.

Команды рантайма: `fullscreen`, `refresh`, `main`, `back`, `exit`, `close`,
`initdialog`, `screenshot`, `screenshot_dialog`, `print`, `print_dialog`,
`closealldialogs`, `setval`, `setval_any`, `device`, `dialog`, `dialog_any`,
`visscript`, `layout`.

Запись локальной переменной из кнопки (основной способ переключения UI):

```json
{"did":"local006","prop":"main_container","title":"locals.main_container",
 "func":"return 'viscont004';","local":true,"command":"setval_any","action":"singleClickLeft"}
```

`special`: `imgSize` отрицательный (−35…−40) — так сделано в рабочих кнопках
проекта; `imgRatio` — доля кнопки под картинку (22…45).

## 5. Локальные переменные (`locals.db`)

Запись: `{_id:"localNNN", order, parent:"localgroup"|"localgNNN", name, dn, defval:"...", txt}`.

`defval` — **строка**. Начальные значения приходят с сервера (GET_LAYOUT),
клиент дополнительно хранит их в `sessionStorage["local"]`.

## 6. Переключение контейнера по локальной переменной

В экране (`layout/*.json`) у элемента-контейнера:

```json
"widgetlinks": {"link": {
  "id": "viscont003", "title": "Основной контейнер", "title2": "Основной контейнер",
  "enabled": true, "did": "local006", "prop": "main_container",
  "value": {"func": "return inData;"}
}}
```

Как это работает в рантайме (проверено по коду клиента):

1. При загрузке макета `K()` копирует `did`/`prop`/`value.func` из `link` в
   `widgetlinks` и вычисляет `link.id = func(значение локальной переменной)`.
   Пока значения нет — остаётся `link.id` из документа (стартовый контейнер).
2. `setval_any` с `local:true` обновляет `layout.values` и вызывает
   `updateElementsAll`; редьюсер пересчитывает `widgetlinks.link.id` через `func`.
3. Компонент контейнера видит новый `link.id`, делает `GET_CONTAINER` и
   отрисовывает другой контейнер (размеры берутся из документа контейнера).

Требования: документ `jbase/container/<id>.json` существует **и** есть запись
`_id:<id>` в `visconts.db`, иначе получится пустая область.

## 7. Метаданные

```json
{"_id":"layout001","parent":"layoutgroup","order":1000,"name":"Начальный экран"}
{"_id":"viscont004","name":"ЗАЯВКИ","parent":"viscontgroup","order":4000}
{"_id":"TTS-new-logo.ico","title":"TTS-new-logo.ico","name":"TTS-new-logo.ico","order":2000,"parent":"img066"}
```

- `parent` — группа (`layoutgroup`, `viscontgroup`, `localgroup`, папка картинок).
- Картинка: файл кладётся в `PROJECT\images\`, запись — в `images.db`,
  `_id` = имя файла, `parent` = папка (`img066` = «Logo»).

## 8. Картинки

- В кнопке указывается `img:{value:"имя.svg", folder:"img066"}`.
- Рантайм строит `/images/<имя>`; SVG можно перекрашивать через `imgColor`
  (маска), для этого цвет не должен быть `transparent`.
- `.ico` может содержать PNG: цвет/размер достаются вырезанием PNG из ICO
  (смещение 22 байта) и чтением через `System.Drawing.Bitmap::FromFile`
  (`New-Object Bitmap` на ICO падает).

## 9. Проверка после правки

1. Разобрать все изменённые JSON-документы (`JSON.parse`) и проверить
   обязательные поля элементов.
2. Убедиться, что каждая новая запись в журнале есть ровно один раз и стоит
   последней для своего `_id`.
3. Сверить геометрию: экран 1920×1080, строка состояния 50, меню 200,
   основная область 1720×1030; вложенная белая карточка — отступ 5 px,
   рамка 2 px `rgba(204,204,204,1)`.
4. `git -C "PROJECT" status --short` — правки должны быть видны в `PROJECT`.
5. Приложение читает журналы при загрузке: после правки нужен F5 (иногда
   перезапуск), иначе изменения не видны.

## 10. Диагностика рантайма

- Клиентская сборка: `http://localhost:8088/static/js/main.<hash>.chunk.js`
  (хэши взять из HTML `http://localhost:8088/`), вендор — `2.<hash>.chunk.js`.
  Админская сборка — `main.chunk.js` (копия в рабочей temp-папке).
- Искать по строкам `widgetlinks.link`, `updateElementsAll`, `setval_any`,
  `GET_CONTAINER`, `command` и читать окружение найденного места — так
  проверяется фактическое поведение команд и привязок.
- Ошибки в консоли браузера обычно означают отсутствующее поле элемента или
  отсутствующий документ/запись метаданных.

## 11. Админ-страницы

- диалог `di0028`: `http://localhost:8088/admin/vis/dialog/dialogview/di0028/tabDialogEditor`
- все диалоги: `http://localhost:8088/admin/vis/dialog/dialogroot/dialoggroup/tabDialogTable`
- контейнеры: `http://localhost:8088/admin/vis/viscont/viscontroot/viscontgroup/tabViscontTable`
- экраны: `http://localhost:8088/admin/vis/layout/layoutroot/layoutgroup/tabLayoutTable`
- редактор экрана: `http://localhost:8088/admin/vis/layout/layoutview/layout001/tabLayoutEditor`

## 12. Грабли, уже случавшиеся

- Диалог/кнопка без полного блока `img*` ломает отрисовку — заполнять всегда.
- Забыть `visable` при `visible:false` — элемент остаётся видимым в старых местах.
- `opacity:43` на кнопке делает полупрозрачным и текст; для «прозрачного фона»
  нужен `rgba(...,0.43)`.
- Переключение контейнера не работает, если в `link` нет `enabled:true` или
  `value.func`, либо нет записи в `visconts.db`.
- Правка `jbase/*.db` без повышения прав молча не применяется (EACCES).
- Изменения в `jbase` не видны, пока не обновлён клиент (F5/перезапуск).
