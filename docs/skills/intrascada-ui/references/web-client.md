# Веб-клиент IntraSCADA

## Адреса

```text
http://localhost:8088/l<layout-id>     экран, например /l003, /l010
http://localhost:8088/admin/           веб-админка (редактор проекта)
```

Порт может отличаться в другой установке — проверять ярлык/конфигурацию.
Клиент — SPA: переходы внутри приложения не меняют URL так, как ожидается,
а сессия живёт в памяти вкладки.

## Вход

Форма авторизации: поля `input[name=username]` и `input[name=password]`,
кнопка с текстом «ВХОД». Пароль спрашивать у владельца, не хранить.

```js
const set = (el, v) => {
  const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  d.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
};
set(document.querySelector('input[name=username]'), 'admin');
set(document.querySelector('input[name=password]'), '<пароль>');
[...document.querySelectorAll('button')].find(b => /ВХОД/i.test(b.innerText)).click();
```

После входа подождать 5–10 секунд: стартует движок и подгружаются контейнеры.

## API движка

| Метод | URL | Назначение |
|---|---|---|
| `POST` | `/api/engine/layout_prescript?id=l003` | prescript экрана |
| `GET` | `/api/engine/layout?id=l003` | JSON раскладки |
| `GET` | `/api/engine/containers?id=vc007,vc006,vc010` | контейнеры (список через запятую) |
| `GET` | `/api/engine/templates?id=vt105,vt104` | шаблоны |
| `POST` | `/api/engine/locals_flat` | значения локальных переменных |

Ответы кэшируются: браузер получает `304`, а сервер отдаёт контейнеры из
памяти процесса. `Cache-Control: no-cache` и `?cb=...` помогают только от
кэша браузера — не от памяти службы.

## `ERRAUTH` при запросах из консоли

Прямой `fetch('/api/engine/containers?id=vc096')` из страницы возвращает:

```json
{"response":0,"error":"ERRAUTH","message":"Сеанс устарел, требуется аутентификация!"}
```

Причина: приложение ходит в API через свою обёртку (`fs.fetch`), которая
добавляет заголовок авторизации. Обычный `fetch` его не добавляет.

Что делать:

- не считать `ERRAUTH` ошибкой сервера;
- читать данные через сетевой лог браузера (запросы самой страницы) или
  через UI;
- для проверки «что реально отдаётся» открыть экран и посмотреть ответ
  `GET /api/engine/containers?...` в панели Network.

## Автоматизация UI

Интерфейс рендерится абсолютно позиционированными `div` без `id`. Надёжный
подход — искать по тексту, брать прямоугольник и кликать по координатам.

Поиск по тексту:

```js
const nodes = [...document.querySelectorAll('div')]
  .filter(e => (e.innerText || '').trim() === 'ГПУ-1');
const rect = nodes[nodes.length - 1].getBoundingClientRect();
```

Клик (полная последовательность событий, иначе React не реагирует):

```js
const fire = (x, y) => {
  const el = document.elementFromPoint(x, y);
  const o = { bubbles: true, cancelable: true, clientX: x, clientY: y,
              button: 0, buttons: 1, view: window };
  el.dispatchEvent(new PointerEvent('pointerdown',
      Object.assign({ pointerId: 1, isPrimary: true, pointerType: 'mouse' }, o)));
  el.dispatchEvent(new MouseEvent('mousedown', o));
  el.dispatchEvent(new PointerEvent('pointerup',
      Object.assign({ pointerId: 1, isPrimary: true, pointerType: 'mouse' }, o)));
  el.dispatchEvent(new MouseEvent('mouseup', o));
  el.dispatchEvent(new MouseEvent('click', o));
};
```

Проверки перед кликом:

- `document.elementFromPoint(x, y)` может вернуть пустой `div`-слой поверх
  плитки. Это нормально, если клик всё равно доходит; если нет — искать
  родителя/соседа с классом `button noselect`.
- Модальные окна перекрывают экран элементом `.MuiBackdrop-root`
  (`z-index: 1399`). Пока он видим, клики «съедаются». Проверять
  `getComputedStyle(el).visibility/opacity`.
- После клика ждать 5–10 секунд: загрузка контейнера и диалога асинхронная.
- Сессия сбрасывается при навигации/перезагрузке — после каждого перехода
  проверять, не появилась ли снова форма входа.

## Скриншоты

- Встроенный браузер делает скриншот только видимой и сфокусированной
  вкладки. Если ошибка «Screenshot needs a visible tab» — сфокусировать
  вкладку и держать окно на переднем плане.
- Для локального HTML (превью раскладки) проще headless Edge:

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
  --headless=new --disable-gpu --hide-scrollbars `
  --user-data-dir="$env:TEMP\edge-shot-profile" `
  --window-size=1740,1000 `
  --screenshot="$env:TEMP\preview.png" `
  "file:///C:/path/to/preview.html"
```

Размер окна задавать равным полотну контейнера, иначе получится обрезанное
или масштабированное изображение.

## Админка

`/admin/` — штатный способ менять проект: изменения применяются приложением
без ручного перезапуска. Но в регламенте этого скилла принят другой порядок:
готовый файл в `bak/`, проверка и внедрение владельцем. Использовать админку
только если пользователь прямо об этом попросил.

Прямые ссылки на разделы (SPA, без `#`, отдаёт та же сборка, что и `/admin/`):

```text
/admin/                                              корень админки
/admin/vis/viscont/viscontview/<id>/tabViscontEditor          контейнер
/admin/vis/vistemplate/vistemplateview/<id>/tabVistemplateEditor  шаблон
/admin/resources/images/imageview/<файл>/tabImageView         картинка
```

Первые две строки взяты из кода кнопок «редактировать» в самой сборке;
остальные разделы (раскладки, диалоги, локальные переменные, устройства)
строятся из схемы меню — их надёжнее открывать кликами по меню.

## Поиск по коду клиентской сборки

Когда поведение UI непонятно (когда пересчитывается привязка, что уходит в
`GET_CONTAINER`, как строится URL картинки), быстрее посмотреть саму сборку,
чем гадать.

1. Взять `index.html` и выписать актуальные имена бандлов:

```powershell
$html = (Invoke-WebRequest "http://localhost:8088/" -UseBasicParsing).Content
($html | Select-String 'static/js/[^"]+' -AllMatches).Matches.Value | Sort-Object -Unique
# static/js/2.<hash>.chunk.js       — библиотеки, ~7 МБ
# static/js/main.<hash>.chunk.js    — код приложения, ~2.4 МБ
```

2. Скачать `main.*.chunk.js` во временный файл и искать строки:

```js
const t = require('fs').readFileSync(process.env.TEMP + '/isc-main.js', 'utf8');
const i = t.indexOf('GET_CONTAINER');
console.log(t.slice(i - 200, i + 300));
```

Полезные якоря:

| Что искать | Что показывает |
|---|---|
| `GET_CONTAINER` | как запрашивается контейнер: `elementid` + `containerid` |
| `widgetlinks.link` | как к `link.id` применяется `func` от локальной переменной |
| `updateElementsAll` | как применение локальной переменной обновляет макет |
| `imgColor` | перекраска: CSS-маска вместо картинки |
| `/images/` | как строится URL картинки и фона |
| `route("...")` | реальные пути разделов админки |

Сборка минифицирована: имена функций односимвольные, поэтому искать надо по
строковым литералам (`GET_CONTAINER`, `/images/`, `imgColor`), а не по именам.
Хэши в именах файлов меняются с каждой версией — не сохраняйте их в скилле,
берите из `index.html` текущей установки.

## Ограничения

- Не включать и не выключать опрос устройств, не менять каналы связи.
- Не выполнять команды управления оборудованием (пуск, квитирование) на
  реальном объекте ради проверки интерфейса.
- Не пытаться обойти авторизацию; пароль запрашивать у владельца.
