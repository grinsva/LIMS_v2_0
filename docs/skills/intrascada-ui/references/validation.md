# Проверка раскладки и превью

## Что проверять

1. **JSON валиден** и читается как UTF-8, без BOM.
2. **`list` ↔ `elements`**: каждый элемент из `list` существует, лишних
   ключей нет, дублей в `list` нет.
3. **Геометрия**: `x, y, w, h` — числа; элемент не выходит за
   `settings.w/h`. Выход за границы — предупреждение: в живых проектах
   встречается намеренная обрезка (аналоговые плитки `vc096` стоят с `x = -17`).
4. **Наложения плиток**: пересечения только между `template` (и при
   необходимости `button`/`action`). Текст и подложки могут лежать под
   плитками — это не ошибка.
5. **Устройства**: каждый `masterLink.id` встречается один раз (если задача —
   «по одной плитке на устройство»); все id существуют в `devices.db`.
6. **Клики**: `actions…targetFrameTable[0].lval == masterLink.id`.
7. **Сохранность**: старые элементы и их привязки не изменились (diff по
   `_label` и `masterLink.id`).
8. **Визуально**: превью 1:1 помещается в полотно, заголовки не перекрывают
   плитки, длинные имена не выходят за границы.

## Скрипт проверки

```bash
node scripts/validate-container.js "<файл>.json" --project "<проект>"
node scripts/validate-container.js "<файл>.json" --project "<проект>" --strict
```

- Код возврата `1` — есть структурные ошибки (битый JSON, рассинхрон
  `list`/`elements`, нечисловая геометрия) либо предупреждения при `--strict`.
- Наложения, выход за границы, дубли устройств и расхождения `lval` —
  предупреждения; при `--strict` они становятся ошибками.
- `--ignore "<текст>"` (можно повторять) исключает известные старые дефекты
  из строгой проверки:

```bash
node scripts/validate-container.js "...\vc096.patched.json" --project "<проект>" \
  --strict --ignore "text_2:" --ignore "template_26:" --ignore "template_27:"
```

- `--json` — машиночитаемый отчёт.

Типичный вывод для готовой раскладки:

```text
container: vc096.patched-dg172-20261118.json
size:      1740x1000
elements:  171 (text 12, rectangle 5, template 154)
tiles:     154 (vt105 135, vt104 19)
devices:   154 unique

ERRORS: 0
WARNINGS: 0
```

## Как считается геометрия

```js
const inside = e =>
  e.x >= -1 && e.y >= -1 &&
  e.x + e.w <= W + 1 && e.y + e.h <= H + 1;

const overlap = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w &&
  a.y < b.y + b.h && b.y < a.y + a.h;
```

Для 150–200 элементов двойной цикл O(n²) — это ~20 тыс. сравнений, мгновенно.

Наложения ищутся только среди плиток: заголовки, подложки, разделители
специально лежат «слоями».

## Превью

```bash
node scripts/container-preview.js "<файл>.json" --project "<проект>" --out preview.html
```

Скрипт собирает HTML с абсолютным позиционированием: подложки, тексты,
плитки с именами устройств, индикаторы. Имена берутся из `devices.db`
(не из `masterLink.title`) — так превью совпадает с тем, что покажет клиент.

Снимок 1:1 через headless Edge:

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
  --headless=new --disable-gpu --hide-scrollbars `
  --user-data-dir="$env:TEMP\edge-shot-profile" `
  --window-size=1740,1000 `
  --screenshot="$env:TEMP\vc096-preview.png" `
  "file:///C:/Users/<user>/AppData/Local/Temp/preview.html"
```

Проверить на картинке:

- всё помещается, нет обрезанных блоков справа/снизу;
- заголовки групп стоят над своими плитками;
- плитки не наезжают друг на друга;
- длинные имена не залезают на индикатор.

## Сравнение версий

Перед выдачей полезно программно сравнить старый и новый файл:

```js
const oldIds = new Set(Object.values(oldVc.elements)
  .filter(e => e.type === 'template').map(e => e.masterLink.id));
const newTiles = Object.values(newVc.elements).filter(e => e.type === 'template');
const added = newTiles.filter(e => !oldIds.has(e.masterLink.id));
const removed = [...oldIds].filter(id =>
  !newTiles.some(e => e.masterLink.id === id));
```

Ожидания:

- `removed.length === 0` — ничего не потеряно;
- `added.length` совпадает с числом устройств в задаче;
- у старых плиток не изменились `_label`, координаты и `actions` (если это не
  входило в задачу).

## Проверка привязок и новых сущностей

### Сущность = файл + запись в журнале

Новый контейнер, раскладка, шаблон или диалог видны проекту только если есть
оба: файл `jbase\<тип>\<id>.json` и запись `<id>` в парном журнале
(`visconts.db`, `layouts.db`, `vistemplates.db`, `dialogs.db`). Проверять оба
места, а не только файл:

```js
const fs = require('fs');
const read = f => fs.readFileSync(f, 'utf8').split(/\r?\n/)
  .filter(Boolean).flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } });

const idx = new Map(read('jbase/visconts.db').map(r => [r._id, r])); // последняя запись побеждает
for (const id of ['vc001', 'vc005']) {
  console.log(id, 'file:', fs.existsSync(`jbase/container/${id}.json`),
                  'record:', idx.has(id), idx.get(id)?.parent);
}
```

Группа из `parent` тоже должна существовать в том же журнале (`folder: 1`).

### Привязки элемента

| Поле | На что должно указывать |
|---|---|
| `widgetlinks.link.id` | существующий контейнер (файл + запись `visconts.db`) |
| `templateId` | существующий шаблон (файл + `vistemplates.db`) |
| `did` | `localNNN` из `locals.db` (или `dNNNN` из `devices.db`, или `__device` внутри шаблона) |
| `prop` | поле этой переменной/устройства: `main_container`, `state`, `clr`, … |
| `lvar.id` в `targetFrameTable` | существующая локальная переменная целевого экрана |
| `lval` в действии плитки | `masterLink.id` этой же плитки |
| `img.value` | файл в `images\` (проверить `Content-Type` по URL) |

Особенно часто ломается `did`/`prop`: клик по кнопке молча ничего не делает,
ошибок в консоли нет. Для кнопки-переключателя контейнера обязательны
`enabled: true` и непустой `value.func` у `widgetlinks.link` — без них
`link.id` не пересчитывается.

### Обязательные поля элементов

- Кнопка: полный набор текстовых, `img*`, `border*`, `backgroundColor`,
  `actions`, `zIndex`, `opacity`, `visible` (см. `controls-locals.md`).
  Отсутствие блока `img*` — типичная причина «пустой» кнопки.
- Действие: `action`, `command`, `value`; для `setval_any` с локальной
  переменной — `did`, `prop`, `local: true`, `func`.
- Плитка шаблона: `type: "template"`, `templateId`, `masterLink.id`,
  `actions.type: "multi"` → `action_1.left[0].value…targetFrameTable[0].lval`.

### Чек-лист новой сущности

- [ ] Файл создан, JSON валиден, одна строка, UTF-8 без BOM.
- [ ] `_id` в журнале совпадает с именем файла и с `link.id`/`templateId`
      в документах, которые на неё ссылаются.
- [ ] `parent` существует и это группа, `order` не конфликтует с соседями.
- [ ] Все `did`/`prop`/`lvar.id` существуют.
- [ ] Для кнопок и плиток прогнан `validate-container.js`.
- [ ] Пользователю сказано, что до перезапуска проекта служба отдаёт старую
      версию из памяти.

## Критерии приёмки

- 0 ошибок валидатора;
- все устройства задачи присутствуют ровно один раз;
- раскладка в границах полотна, без наложений плиток;
- превью просмотрено, файл откатa и SHA256 приложены;
- отдельно перечислены предупреждения, которые остались осознанно.
