# Контейнеры (`jbase\container\vcXXX.json`)

Контейнер — это экран или его фрагмент: набор абсолютно позиционированных
элементов. Раскладка (`layout`) ссылается на контейнеры через фреймы.

> Значения и ID в примерах — из проекта-образца. Структура полей устойчива,
> конкретные элементы, шаблоны и координаты в другом проекте будут свои.

## Верхний уровень

```json
{
  "settings":  { "x": {"value":265}, "y": {"value":215}, "w": {"value":1740}, "h": {"value":1000},
                 "scale": {"value":0.64}, "grid": {"value":1}, "backgroundColor": {"value":"transparent"},
                 "fitW": {"value":true}, "fitH": {"value":true}, "scrollX": {"value":false}, "scrollY": {"value":false} },
  "list":      ["rectangle_1", "text_2", "template_19"],
  "elements":  { "rectangle_1": { ... }, "text_2": { ... }, "template_19": { ... } },
  "selects":   { "template_4": true },
  "selectContainer": { "x": {"value":125}, "y": {"value":120}, "w": {"value":310}, "h": {"value":90}, "zIndex": {"value":100} },
  "selectType": "one",
  "selectOne": "template_4",
  "propertyType": "link",
  "historyIndex": 0,
  "history": [],
  "historyInitLost": false
}
```

| Ключ | Смысл |
|---|---|
| `settings.w/h` | размер полотна контейнера в пикселях |
| `settings.fitW/fitH` | растягивать по ширине/высоте родительского фрейма |
| `settings.scrollX/scrollY` | разрешить прокрутку |
| `settings.backgroundColor` | объект заливки; значимо поле `value` |
| `list` | порядок элементов (строки), совпадает с ключами `elements` |
| `elements` | словарь `имя → элемент` |
| `selects`, `selectOne`, `selectType`, `selectContainer` | состояние редактора (выделение), на отрисовку не влияет |
| `history*` | история правок, можно оставлять как есть |

## Общие поля элемента

Почти все размеры и координаты — объекты `{"value": число}`:

```json
"x": {"value": 578}, "y": {"value": 84},
"w": {"value": 280}, "h": {"value": 28},
"zIndex": {"value": 100},
"opacity": {"value": 100},
"visible": {"value": true}
```

- `x/y` — левый верхний угол относительно контейнера.
- `w2/h2` — остатки старого формата, бывают не равны `w/h` (например, `w2:1015`
  при `w:310`) и **на отрисовку не влияют**. Можно синхронизировать, но не
  обязательно.
- `zIndex` по умолчанию 100; подложки обычно 99, кнопки/оверлеи — 10000.
- `opacity` — проценты 0…100 (не 0…1).
- `visible.value` встречается как `true/false`, `1/0` и `"0"` — все варианты
  рабочие.
- `borderRadius`, `borderSize`, `borderColor`, `borderStyle` — оформление.
- `backgroundColor` — объект заливки: значимо `value` (`#RRGGBB`,
  `rgba(...)`, `transparent`); остальные поля (`fill`, `angle`, `palette`)
  можно копировать из образца.

## Типы элементов

| `type` | Назначение | Обязательные поля |
|---|---|---|
| `template` | экземпляр шаблона (плитка устройства) | `templateId`, `masterLink`, обычно `actions` |
| `text` | статический/привязанный текст | `text.value`, `textSize`, `textColor`, выравнивания |
| `rectangle` | подложка/разделитель | `backgroundColor` |
| `circle` | индикатор | `backgroundColor`, `borderSize` |
| `image` | иконка | `img.folder`, `img.value` |
| `button` | кнопка | `actions.left[]`, `text.value` |
| `action` | невидимая кликабельная область | `singleClickLeft.value`, `w/h`, `zIndex:10000` |
| `container` | вложенный фрейм (виджет) | `widget:true`, `widgetlinks.link.id` |
| `checkbox`, `group` | формы и группировка в диалогах | — |
| `tree`, `input_modern`, `chart_*` | специализированные виджеты | `widget:true`, `widgetlinks` |

В контейнерах экранов чаще всего встречаются первые восемь.

## Плитка устройства (`template`)

```json
{
  "type": "template",
  "_label": "template_19",
  "x": {"value":125}, "y": {"value":90},
  "w": {"value":310}, "h": {"value":30},
  "zIndex": {"value":100},
  "templateId": "vt105",
  "templateTitle": "DI_gray_green_longnamed",
  "masterLink": {
    "id": "d0172",
    "title": "M1_DI_EnginRun ▪︎ Состояние двигателя Работа",
    "title2": "M1_DI_EnginRun",
    "value": {}
  },
  "actions": {
    "type": "multi",
    "action_1": {
      "left": [
        {
          "action": "singleClickLeft",
          "id": "di0039",
          "title": "DI. Настройки датчика",
          "command": "dialog_any",
          "value": {
            "active": true,
            "targetFrameTable": [
              {
                "id": "__fkXjsoPK_",
                "lvar": {"id":"local063", "title":"DI_id", "prop":"DI_id"},
                "lval": "d0172",
                "freeze": false
              }
            ]
          }
        },
        { "action": "longClickLeft", "value": {} }
      ],
      "right": []
    }
  }
}
```

- `templateId` — файл `jbase\template\<id>.json`; `templateTitle` — подпись
  шаблона, на отрисовку не влияет.
- `masterLink.id` — устройство, данные которого показывает плитка.
- `actions.action_1.left[0]` — клик: `command: "dialog_any"` открывает диалог
  `id`, передавая ему `targetFrameTable`.
- `lval` — **id устройства**; для DI обычно `local063.DI_id`, для AI —
  `local002.ai_id`. Должен совпадать с `masterLink.id`.
- `id` внутри `targetFrameTable[0]` (`__fkXjsoPK_`) — служебный идентификатор
  цели, его можно оставить из образца.
- `actions` может быть и плоским (`{"left":[...],"right":[]}`) у `button`.

## Текст

```json
{
  "type": "text",
  "x": {"value":0}, "y": {"value":0}, "w": {"value":1690}, "h": {"value":46},
  "text": {"value": "Параметры ГПУ-1"},
  "textSize": {"value": 30},
  "textBold": {"value": 0},
  "textColor": {"value": "rgba(68,68,68,1)"},
  "textAlignH": {"value": {"id":"center", "title":"Центр"}},
  "textAlignV": {"value": {"id":"center", "title":"Центр"}},
  "backgroundColor": {"value": "rgba(0,0,0,0.06)"},
  "borderRadius": {"value": 10},
  "zIndex": {"value": 100}
}
```

Выравнивание: `id` из `flex-start | center | flex-end` (в старых файлах также
`left/right`), `title` — человекочитаемая подпись, `lang` может отсутствовать.

## Кнопка и контейнер-фрейм

Кнопка:

```json
{
  "type": "button",
  "text": {"value": "Обновить"},
  "actions": {
    "left": [
      { "action": "singleClickLeft", "id": "vs0021", "title": "Trends Refresh",
        "command": "visscript", "value": {"active": true, "targetFrameTable": []} }
    ],
    "right": []
  }
}
```

Фрейм (внутри раскладки или контейнера):

```json
{
  "type": "container",
  "widget": true,
  "widgetlinks": { "link": { "id": "vc074", "title": "Э_Параметры контейнер", "title2": "Э_Параметры контейнер" } },
  "x": {"value":110}, "y": {"value":54}, "w": {"value":1810}, "h": {"value":1025},
  "fitW": {"value":true}, "fitH": {"value":0},
  "alignW": {"value":{"id":"flex-start"}}, "alignH": {"value":{"id":"flex-start"}},
  "scrollY": {"value":1}
}
```

## Клонирование элемента

В JSON всё — обычные объекты, поэтому плитки удобно размножать кодом:

```js
const base = container.elements.template_19;
const clone = JSON.parse(JSON.stringify(base));

clone._label = 'alarm_' + device._id;
clone.x.value = x;
clone.y.value = y;
clone.masterLink.id = device._id;
clone.masterLink.title = device.dn + ' \u25AA\uFE0E ' + device.name;
clone.masterLink.title2 = device.dn;
clone.actions.action_1.left[0].value.targetFrameTable[0].lval = device._id;

container.elements[clone._label] = clone;
container.list.push(clone._label);
```

Правила:

- имя элемента (`_label` и ключ в `elements`) — уникальное;
- `masterLink.value` оставлять `{}`;
- `zIndex` и оформление копировать из образца;
- после генерации — `JSON.stringify(container)` без отступов (одна строка).

## Частые ловушки

1. `w2/h2` не равны `w/h` — это нормально, не признак ошибки.
2. `visible` бывает строкой `"0"`; сравнение с `false` даст неверный результат.
3. `opacity` в процентах, `rgba(...,0.06)` — это альфа в CSS-цвете, не opacity.
4. Элементы `text`/`rectangle` могут лежать «под» плитками — при проверке
   наложений учитывать только `template`/`button`/`action`.
5. Координаты могут быть дробными (`-2.38`) — допуск при проверке границ 1 px.
6. Имя на плитке берётся из устройства; переименование устройства меняет
   подпись без правки контейнера.
