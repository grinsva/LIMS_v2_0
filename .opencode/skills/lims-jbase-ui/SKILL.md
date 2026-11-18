---
name: LIMS jbase UI
description: Проектные детали LIMS_v2.0 по интерфейсу jbase — конкретные ID, размеры, адреса админки и примеры этой установки. Дополнение к универсальному скиллу IntraScada UI; в меню не показывается, загружать по ID lims-jbase-ui.
metadata:
  opencode/autoinvoke: false
---

# LIMS: интерфейс `jbase` — проектные детали

Общие форматы, правила правки, проверки и диагностика — в универсальном скилле
**IntraScada UI** (`intrascada-ui`). Здесь только то, что относится к этой
установке. Правила проекта и работа с SQLite — в `AGENTS.md`.

## 1. Файлы

```text
PROJECT\jbase\
  layout\layout001.json      начальный экран (1920×1080)
  container\viscont001.json  строка состояния (1920×50)
  container\viscont002.json  боковое меню (200×1030)
  container\viscont003.json  основная область, стартовый контейнер (1720×1030)
  container\viscont004.json  основная область, «ЗАЯВКИ» (1720×1030)
  dialog\di0028.json         диалог «Приветствие» (420×320)
  locals.db                  локальные переменные клиента
  layouts.db, visconts.db, dialogs.db, images.db   журналы-индексы
PROJECT\images\              файлы картинок (svg, png, ico)
```

## 2. Экран `layout001`

| Фрейм | Контейнер | Геометрия |
|---|---|---|
| `container_1` | `viscont001` строка состояния | `0,0 1920×50` |
| `container_2` | `viscont002` меню | `0,50 200×1030` |
| `container_3` | `viscont003` основная область | `200,50 1720×1030` |

`container_3` — динамический: `widgetlinks.link` привязан к `local006.main_container`
(`enabled: true`, `value.func: "return inData;"`). Кнопка «ЗАЯВКИ» пишет в эту
переменную `viscont004`, кнопка «Назад» возвращает `viscont003`.

Вложенная белая карточка в контейнерах: отступ 5 px, рамка 2 px
`rgba(204,204,204,1)`.

## 3. Локальные переменные

```json
{"_id":"local004","order":3000,"parent":"localg002","name":"vk_prod_item_id","dn":"vk_prod_item_id","defval":0,"txt":"ID позиции продукта для входного контроля"}
{"_id":"local005","order":4000,"parent":"localg002","name":"vk_prod_item_name","dn":"vk_prod_item_name","defval":0,"txt":"Наименование позиции продукта для входного контроля"}
{"_id":"local006","order":5000,"parent":"localgroup","name":"main_container","dn":"main_container","defval":"viscont003","txt":"ID контейнера основной области начального экрана"}
```

`local006` переключает основную область. `local004`/`local005` — параметры
позиции продукта для входного контроля.

## 4. Действия кнопок

Переключить контейнер (кнопка «ЗАЯВКИ»):

```json
{"did":"local006","prop":"main_container","title":"locals.main_container",
 "func":"return 'viscont004';","local":true,
 "command":"setval_any","action":"singleClickLeft"}
```

Вернуть стартовый:

```json
{"did":"local006","prop":"main_container","func":"return 'viscont003';","local":true,
 "command":"setval_any","action":"singleClickLeft"}
```

Требования: `enabled: true` и непустой `value.func` у `widgetlinks.link`, файл
`viscontNNN.json` **и** запись `_id` в `visconts.db`.

## 5. Диалог `di0028` «Приветствие»

- Полотно 420×320, заголовок «Приветствие», текст «Здравствуйте! Добро
  пожаловать в систему LIMS.», кнопка «Начать».
- Кнопка закрытия `button_1` (40×30, `symbol3210.svg`, `imgColor` тёмно-серый),
  команда `close`.
- Открывается стартовым диалогом (`initdialog`) при входе.

## 6. Картинки этой установки

| Файл | Группа | Где используется |
|---|---|---|
| `TTS-new-logo.ico` | `img066` «Logo» | логотип в строке состояния, PNG 256×256 внутри `.ico` |
| `login_door_clr_opt.svg` | `img051` «Окна/Двери» | кнопка выхода, перекрашена в `rgba(82,168,229,1)` |
| `arrow7120.svg` | `img025` «Стрелки» | кнопка «Назад», белая |

Диалог: `symbol3210.svg` (`img033` «Знаки»). Логотип — цветной, `imgColor:
rgba(0,0,0,0)`; остальные SVG перекрашиваются маской.

## 7. Админка (адреса этой установки)

```text
/admin/                                                            корень
/admin/vis/layout/layoutview/layout001/tabLayoutEditor              экран
/admin/vis/viscont/viscontview/viscont003/tabViscontEditor         контейнер
/admin/vis/dialog/dialogview/di0028/tabDialogEditor                диалог
/admin/resources/images/imageview/TTS-new-logo.ico/tabImageView    картинка
/admin/vis/layout/layoutroot/layoutgroup/tabLayoutTable            список экранов
/admin/vis/dialog/dialogroot/dialoggroup/tabDialogTable            список диалогов
```

## 8. Что уже случалось

- Кнопка без полного блока `img*` не отрисовывается — заполнять всегда.
- `opacity` вместо `rgba(...)` делает полупрозрачным и текст; заказчик просил
  именно `rgba(33,150,243,0.43)` при `opacity:100` (кнопка «ЗАЯВКИ»).
- Переключение контейнера не работает без `enabled:true`, `value.func` и записи
  в `visconts.db`.
- После правки `jbase` клиенту нужен F5, а если сущность кэширована службой —
  перезапуск проекта.
- Запись в `jbase/*.db` без повышения прав молча падает (EACCES).
