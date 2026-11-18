# Кнопки, команды, локальные переменные и привязки

## Локальные переменные (`jbase\locals.db`)

```json
{"_id":"local006","order":5000,"parent":"localgroup","name":"main_container",
 "dn":"main_container","defval":"vc001","txt":"ID контейнера основной области"}
```

| Поле | Смысл |
|---|---|
| `_id` | `localNNN`, на него ссылаются `did` в привязках и действиях |
| `parent` | группа переменных (`localgroup` или `localgNNN`) |
| `name` | имя переменной; `dn` — техническое обозначение |
| `defval` | начальное значение как JSON-значение: строка для ID/режимов, число для счётчиков (`0`) |
| `txt` | пояснение для человека |

Начальные значения приходят с сервера при загрузке макета; клиент дополнительно
хранит текущие значения в `sessionStorage["local"]` и восстанавливает их при
перезагрузке страницы. Живут они до закрытия вкладки.

## Привязка поля элемента к переменной

Любое поле элемента может быть динамическим: рядом с `value` появляются
`enabled`, `did`, `prop`, `func`, `title`:

```json
"textColor": {"value":"#333","enabled":true,"did":"local017","prop":"clr",
              "title":"locals.clr",
              "func":"return inData ? inData : '#333';"}
```

- `func` получает текущее значение первым аргументом (`inData`), а также
  `(inData, values, undefined, core)`.
- Возвращённое значение подставляется в поле при каждом обновлении макета.
- Для сложных привязок используется `binds` + `list` (шаблоны): в `binds`
  перечислены поля элемента, в `list` — их заголовки; клиент раскладывает
  значения по `did`/`prop`.
- `w2`/`h2` обрабатываются отдельно: при изменении пересчитываются `x`/`y`,
  чтобы элемент «рос» от текущего края.

## Кнопка

Обязательный набор полей (иначе кнопка может не отрисоваться):

```
text, textSize, textBold, textItalic, textFontFamily,
textAlignH, textAlignV, textRotate, textColor,
img {folder, value}, imgColor, imgSize, imgRotate, imgPosition, imgRatio,
borderSize, borderRadius, borderStyle, borderColor, backgroundColor,
colorRipple, colorHover, zIndex, opacity, visible, actions, type, x, y, w, h
```

- Блок `img*` заполняется **всегда**, даже если картинки нет (`img.value: ""`,
  `imgColor: "rgba(0,0,0,0)"`).
- `imgPosition` — `{id:"left"|"right"|"top"|"bottom"|"center", title:...}`;
  `imgRatio` — доля кнопки под картинку (22…45); `imgSize` в рабочих кнопках
  встречается отрицательным (−35…−40) — это нормально.
- `opacity` — 0…100 и действует на элемент целиком, включая текст. Если нужна
  полупрозрачность **только фона** — `backgroundColor: "rgba(33,150,243,0.43)"`,
  а `opacity` оставить `100`.

Действия:

```json
"actions": {
  "left": [
    {"action":"singleClickLeft","command":"...","value":{}},
    {"action":"doubleClickLeft","value":{}},
    {"action":"longClickLeft","value":{}},
    {"action":"mouseDownLeft","value":{}},
    {"action":"mouseUpLeft","value":{}}
  ],
  "right": [{"action":"singleClickRight","value":{}}]
}
```

Пустые заглушки нужны, чтобы редактор не подставлял своё поведение. У плиток
шаблонов действия лежат глубже: `actions.type: "multi"` →
`actions.action_1.left[]`.

## Команды

| Команда | Что делает |
|---|---|
| `fullscreen` | полноэкранный режим |
| `refresh` | перезагрузка данных экрана |
| `main` | возврат на главный экран |
| `back` | назад |
| `exit` | выход из учётной записи |
| `changepassword` | смена пароля |
| `close` | закрыть диалог |
| `closealldialogs` | закрыть все диалоги |
| `initdialog` | открыть стартовый диалог |
| `screenshot`, `screenshot_dialog` | снимок экрана/диалога |
| `print`, `print_dialog` | печать |
| `layout` | переход на другой экран |
| `dialog`, `dialog_any` | открыть диалог (в т. ч. с передачей параметров) |
| `setval`, `setval_any` | записать значение (устройство или локальная переменная) |
| `device` | команда устройству |
| `visscript` | запустить vis-скрипт |

### Записать локальную переменную

```json
{"did":"local006","prop":"main_container","title":"locals.main_container",
 "func":"return 'vc002';","local":true,
 "command":"setval_any","action":"singleClickLeft"}
```

`func` получает текущее значение (`inData`) и возвращает новое. Это основной
способ переключать контейнеры, фильтры, режимы отображения.

### Перейти на другой экран

```json
{"action":"singleClickLeft","command":"layout","id":"l003",
 "value":{"targetFrameTable":[
   {"lvar":{"id":"local004","prop":"var400"},"lval":"Схема энергоцентра"}]}}
```

`targetFrameTable` заполняет локальные переменные целевого экрана до его
открытия; `lvar.id`/`prop` — переменная, `lval` — значение.

### Открыть диалог с параметром

```json
{"action":"singleClickLeft","command":"dialog_any","id":"di0039",
 "value":{"active":true,"targetFrameTable":[
   {"id":"__fkXjsoPK_","lvar":{"id":"local063","prop":"DI_id"},
    "lval":"d0834","freeze":false}]}}
```

`lval` — значение параметра (обычно id устройства), `lvar` — переменная
диалога. `id` внутри `targetFrameTable` — служебный идентификатор цели, можно
оставить из образца.

### Команда устройству

```json
{"action":"singleClickLeft","command":"device","did":"__device","prop":"state",
 "value":{"func":"deviceCommand(inData, 'on')"}}
```

`__device` подставляет устройство, к которому привязана плитка. Команды
управления оборудованием на реальном объекте без разрешения владельца не
выполнять.

## Ловушки

- Кнопка без полного блока `img*` — частая причина «пустой» кнопки.
- `opacity` вместо `rgba(...)` делает полупрозрачным и текст.
- Привязка контейнера не работает без `enabled: true` и `value.func`.
- `did`/`prop` в действии должны указывать на существующую переменную; иначе
  клик молча ничего не делает.
- Значение локальной переменной хранится в `sessionStorage` вкладки: переживает
  F5, но не закрытие вкладки. Постоянное состояние — на устройстве или в БД,
  а не в `localNNN`.
