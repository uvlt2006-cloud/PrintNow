# PrintNow

Проектная работа команды Core3 по курсу «Программная инженерия», Университет Пучон в городе Ташкенте.
Сервис заказа печати: цена и оплата онлайн, получение по коду без очереди.

Рабочий код сервиса в курсе не пишется, поэтому здесь лежат прототип, схема базы данных и исходники работы.

Прототип онлайн: https://claude.ai/artifact/QmKvXUdyqH7wCZmZKMk1Tn (страница Claude, нужен вход в аккаунт). Его можно открыть и без интернета: файл `prototype/index.html` двойным щелчком.

## Что где лежит

| Путь | Что это |
|---|---|
| `prototype/index.html` | Кликабельный прототип: один файл, открывается в браузере. Оплата и файлы имитируются |
| `db/schema.sql` | Схема базы данных PostgreSQL |
| `db/check_schema.py` | Проверка схемы на тестовых и заведомо ошибочных данных |
| `docs/build/calc.py` | Единый расчёт юнит-экономики и стоимости владения |
| `docs/build/ch1.js`, `ch2.js`, `ch3.js`, `app.js` | Текст глав и приложений |
| `docs/build/diagrams.js` | Все схемы |
| `docs/fill.json` | Данные, которые вносит команда: ссылки, даты, результаты гипотетической проверки. Приглашение на доску Trello сюда не выложено |
| `docs/screens/`, `docs/deck/assets/` | Снимки экранов прототипа и схемы для работы и презентации |

## Команды

Нужны только Python 3, Node.js и Google Chrome.

```bash
python3 db/check_schema.py
```

```bash
node docs/build/test_prototype.js
```

```bash
node docs/build/build.js
```

```bash
python3 docs/build/check_work.py
```

Готовые PDF и Word с работой в репозиторий не входят: они собираются командой `node docs/build/build.js` и `python3 docs/build/build_docx.py`.
