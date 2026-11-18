---
name: IntraScada UI
description: Работа с интерфейсом IntraSCADA в любом проекте — документы jbase (layout/container/dialog), журналы jbase/*.db, элементы и стили, кнопки и действия, локальные переменные клиента, привязка контейнеров, картинки, проверка и диагностика клиента. Загружать при правке или отладке UI.
---

# Интерфейс IntraSCADA (`jbase`)

Универсальная памятка: подходит для любого проекта IntraSCADA. Проектные ID,
размеры и имена групп здесь намеренно не зашиты — их берём из файлов проекта.

## 1. Данные проекта

```
<jproject>\jbase\
  layout\<id>.json        экран (сцена)
  container\<id>.json     контейнер (панель, область, окно)
  dialog\<id>.json        диалог
  locals.db               локальные переменные клиента
  layouts.db  visconts.db  dialogs.db  images.db  templates.db   метаданные
<jproject>\images\         файлы картинок (svg, png, ico)
```

Документ — **один JSON без форматирования** (одна строка). Журналы `*.db` —
**JSONL**: по одному JSON на строку, только дописывание, для каждого `_id`
действует **последняя** запись. Приложение само уплотняет журналы при сохранении.

Чтение журнала:

```js
const fs = require('fs');
const rows = fs.readFileSync('jbase/visconts.db', 'utf8')
  .split(/\r?\n/).filter(Boolean).map(JSON.parse);
const map = new Map(rows.map(r => [r._id, r]));  // последняя запись побеждает
```

Ссылки между объектами — по `_id`: проект видит объект только если есть и файл
`<тип>\<id>.json`, и запись `<id>` в парном журнале (`layouts.db`, `visconts.db`,
`dialogs.db`).

## 2. Права на файлы

Журналы `jbase/*.db` на рабочих стендах часто доступны только на чтение.
Запись — отдельным node-скриптом с повышением прав, скрипт должен быть
идемпотентным (не дописывать запись, если `_id` уже есть) и печатать результат:

```powershell
$node = (Get-Command node).Source
$p = Start-Process -FilePath $node -ArgumentList ('"' + $script + '"') `
     -WorkingDirectory (Get-Location).Path -Verb RunAs -WindowStyle Hidden -Wait -PassThru
"exit=$($p.ExitCode)"
```

Документы `jbase\layout|container|dialog\*.json` и `images\*` — обычные файлы,
пишутся без повышения прав. Если запись не применилась молча — проверять ACL.

## 3. Документ экрана/контейнера/диалога

Верхний уровень: `settings`, `list`, `elements`, `selects`, `selectContainer`,
`selectType`, `selectOne`, `propertyType`.

- `settings` — размеры и фон сцены: `{w:{value:1920}, h:{value:1080}, ...}`.
  Размеры областей берутся отсюда, а не из головы.
- `list` — порядок отрисовки, `elements` — объект `id → элемент`.

Обязательные поля элемента: `type`, `x`, `y`, `w`, `h`, `w2`, `h2`, `zIndex`,
`opacity`, `visible`, `boxShadow`, `animation`, `overflow`; у всех типов, кроме
`container`, ещё `backgroundColor`. `w2`/`h2` дублируют `w`/`h`.

- `backgroundColor` — не строка, а объект заливки:
  `{type:"fill", value:"rgba(255,255,255,1)", fill:<то же>, angle:90, shape:"circle",
    positionX:50, positionY:50, extent:"closest-side", palette:[{offset:"0.00",color:"#4A90E2",opacity:1},{offset:"1.00",color:"#9013FE",opacity:1}]}`.
  `value` и `fill` держать одинаковыми.
- У элемента `type:"container"` поля `backgroundColor` нет — **это норма**.
- `opacity` — 0…100, действует на элемент целиком, включая текст. Если нужна
  полупрозрачность **только фона** — писать `rgba(r,g,b,0.4)` в `backgroundColor`,
  а `opacity` оставить `100`.
- Видимость — `visible:{value:true}`; для совместимости дублировать
  `visable:{value:true}` (встречается в старых документах).
- Типовые `type`: `rectangle`, `text`, `button`, `container`, `template`, `group`.

Текст: `text:{value}`, `textSize`, `textBold`, `textItalic`,
`textFontFamily:{value:{id:"Arial",title:"Arial"}}`,
`textAlignH`/`textAlignV` (`{id:"center",title:"Center"}`), `textRotate`,
`textColor`, `lineHeight:{value:100}`.

## 4. Кнопка и действия

Поля: `text`, `textSize`, `textBold`, `textItalic`, `textFontFamily`,
`textAlignH`, `textAlignV`, `textRotate`, `textColor`; блок картинки — **всегда
целиком**: `img:{value:"file.svg", folder:"<папка>"}`, `imgColor`, `imgSize`,
`imgRotate`, `imgPosition:{value:{id:"left",title:"Слева"}}`, `imgRatio`;
`borderSize`, `borderRadius`, `borderStyle:{value:{id:"solid",title:"Solid"}}`,
`borderColor`, `backgroundColor`, `colorRipple`, `colorHover`, `zIndex`,
`opacity`, `visible`.

Структура действий: `actions.left` — первый элемент рабочий, далее пустые
заглушки `doubleClickLeft`/`longClickLeft`/`mouseDownLeft`/`mouseUpLeft`;
`actions.right` — `singleClickRight`.

Команды рантайма: `fullscreen`, `refresh`, `main`, `back`, `exit`,
`changepassword`, `close`, `initdialog`, `screenshot`, `screenshot_dialog`,
`print`, `print_dialog`, `closealldialogs`, `setval`, `setval_any`, `device`,
`dialog`, `dialog_any`, `visscript`, `layout`.

Запись локальной переменной из кнопки — основной способ управлять UI:

```json
{"did":"localNNN","prop":"имя_переменной","title":"locals.имя_переменной",
 "func":"return 'нужное_значение';","local":true,
 "command":"setval_any","action":"singleClickLeft"}
```

Переход на другой экран: `command:"layout"` + `value.targetFrameTable`
(массив `{lvar:{id,prop}, lval}`). Команда `dialog` открывает диалог по `id`.

## 5. Локальные переменные (`locals.db`)

`{_id:"localNNN", order, parent:"<группа>", name, dn, defval:"...", txt}`.

- `defval` — **строка**, даже если значение числовое.
- Начальные значения приходят с сервера при загрузке макета; клиент дублирует
  их в `sessionStorage["local"]`.
- На переменную можно привязать любое поле элемента (см. §6), а не только
  контейнер.

## 6. Привязка элемента к переменной

Любое поле элемента можно сделать динамическим: у поля появляются `enabled`,
`did`, `prop`, `func`:

```json
"textColor": {"value":"#333","enabled":true,"did":"localNNN","prop":"clr",
              "func":"return inData ? inData : '#333';","title":"locals.clr"}
```

`func` получает текущее значение первым аргументом (`inData`), возвращает новое.
Для контейнера привязывается `widgetlinks.link`:

```json
"widgetlinks": {"link": {
  "id": "viscontНАЧАЛЬНЫЙ", "title": "Основной контейнер", "title2": "Основной контейнер",
  "enabled": true, "did": "localNNN", "prop": "main_container",
  "value": {"func": "return inData;"}
}}
```

Как это работает в рантайме (проверено по коду клиента):

1. При загрузке макета клиент копирует `did`/`prop`/`value.func` из `link` в
   `widgetlinks` и вычисляет `link.id = func(значение локальной переменной)`.
   Пока значения нет — используется `link.id` из документа.
2. `setval_any` с `local:true` обновляет значения макета и запускает
   `updateElementsAll`; редьюсер пересчитывает `link.id` через `func`.
3. Компонент контейнера видит новый `link.id`, запрашивает `GET_CONTAINER` и
   рисует другой контейнер.

Требования: у `link` есть `enabled:true` и `value.func`, а целевой контейнер
существует файлом **и** записью в `visconts.db`.

## 7. Метаданные

```json
{"_id":"layout001","parent":"<группа>","order":1000,"name":"Экран"}
{"_id":"viscont001","parent":"<группа>","order":1000,"name":"Контейнер"}
{"_id":"di0001","parent":"<группа>","order":1000,"name":"Диалог"}
{"_id":"file.svg","title":"file.svg","name":"file.svg","order":1000,"parent":"<папка картинок>"}
```

`parent` — группа-папка соответствующего дерева (`layoutgroup`, `viscontgroup`,
`localgroup`, папка картинок); `folder:1` — признак папки.

## 8. Картинки

- В кнопке: `img:{value:"имя.svg", folder:"<папка>"}`; файл лежит в `images\`,
  запись — в `images.db` (`_id` = имя файла, `parent` = папка).
- SVG перекрашивается через `imgColor`: рантайм использует его как маску.
  `transparent` — цвет не менять.
- `.ico` может содержать PNG: чтобы узнать цвет/размер, вырезать PNG (смещение
  22 байта) и читать через `System.Drawing.Bitmap::FromFile` — `New-Object Bitmap`
  на `.ico` падает.

## 9. Проверка после правки

1. `JSON.parse` всех изменённых документов; проверить обязательные поля
   элементов (см. §3).
2. Каждая новая запись журнала есть ровно один раз и стоит последней для своего `_id`.
3. Документ существует **и** запись в парном журнале добавлена.
4. Ссылки: `did`/`prop` переменной существуют, `link.id` указывает на реальный
   контейнер.
5. Приложение читает журналы при загрузке — без обновления клиента (F5,
   иногда перезапуск) изменения не видны.

## 10. Диагностика клиента

- Сборка клиента: `http://<host>:<port>/static/js/main.<hash>.chunk.js`, вендор —
  `2.<hash>.chunk.js`; актуальные хэши — в HTML корневой страницы. Админская
  сборка — `main.chunk.js`.
- Поиск по строкам `widgetlinks.link`, `updateElementsAll`, `setval_any`,
  `GET_CONTAINER`, `command`, `handleRender` и чтение окружения найденного места
  даёт фактическое поведение, а не догадки.
- Ошибка в консоли браузера обычно означает отсутствующее поле элемента,
  отсутствующий документ или запись метаданных.

## 11. Админ-страницы (шаблон)

```
/admin/vis/layout/layoutroot/<группа>/tabLayoutTable      список экранов
/admin/vis/layout/layoutview/<id>/tabLayoutEditor         редактор экрана
/admin/vis/viscont/viscontroot/<группа>/tabViscontTable   контейнеры
/admin/vis/dialog/dialogroot/<группа>/tabDialogTable      диалоги
/admin/vis/dialog/dialogview/<id>/tabDialogEditor         редактор диалога
```

## 12. Грабли, уже случавшиеся

- Кнопка без полного блока `img*` ломает отрисовку — заполнять всегда.
- `visible:false` без `visable:false` — элемент остаётся видимым в части мест.
- `opacity` вместо `rgba(...)` делает полупрозрачным и текст.
- Переключение контейнера не работает без `enabled:true`, `value.func` или при
  отсутствии контейнера в `visconts.db`.
- Правка `jbase/*.db` без нужных прав не применяется (EACCES).
- Новый документ без записи в журнале не появляется в дереве проекта.
- Геометрию и ID соседних элементов не «улучшать»: они связаны привязками.
