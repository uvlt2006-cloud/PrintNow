"""Проверка собранной работы по требованиям задания. Запуск: python3 check_work.py"""
import html
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
raw = (ROOT / "work.html").read_text(encoding="utf8")
raw = raw.replace(" ", " ")
body = re.sub(r"<style.*?</style>", "", raw, flags=re.S)
body = re.sub(r'src="data:[^"]+"', "", body)
body = re.sub(r"<svg.*?</svg>", " ", body, flags=re.S)
main = body[body.index('id="ch1"'):]
text = html.unescape(re.sub(r"<[^>]+>", " ", main))
problems = []

# 1. Подписи и ссылки
tcaps = re.findall(r"Таблица ([0-9А-ИС]+\.\d+) —", text)
fcaps = re.findall(r"Рисунок (\d+\.\d+) —", text)
print(f"таблиц: {len(tcaps)}, рисунков: {len(fcaps)}")
for kind, caps in (("таблиц", tcaps), ("рисун", fcaps)):
    if len(caps) != len(set(caps)):
        problems.append(f"повтор номера: {kind} {[c for c in caps if caps.count(c) > 1]}")
wo = re.sub(r"(Таблица|Рисунок) [0-9А-ИС]+\.\d+ —", "", text)
refs_t = set(re.findall(r"[Тт]аблиц[аеуыи]+ ([0-9А-И]+\.\d+)", wo))
for m in re.finditer(r"[Тт]аблиц[а-я]* ([0-9А-И]+\.\d+) и ([0-9А-И]+\.\d+)", wo):
    refs_t.update(m.groups())
refs_f = set(re.findall(r"[Рр]исун[а-я]* (\d+\.\d+)", wo))
for m in re.finditer(r"[Рр]исунк[а-я]* (\d+)\.(\d+)–\d+\.(\d+)", wo):
    refs_f.update(f"{m[1]}.{i}" for i in range(int(m[2]), int(m[3]) + 1))
for m in re.finditer(r"[Тт]аблиц[а-я]* (\d+)\.(\d+)–\d+\.(\d+)", wo):
    refs_t.update(f"{m[1]}.{i}" for i in range(int(m[2]), int(m[3]) + 1))
for c in tcaps:
    if c not in refs_t and not c.startswith("С"):
        problems.append(f"на таблицу {c} нет ссылки в тексте")
for c in fcaps:
    if c not in refs_f:
        problems.append(f"на рисунок {c} нет ссылки в тексте")
for r in refs_t - set(tcaps):
    problems.append(f"ссылка на несуществующую таблицу {r}")
for r in refs_f - set(fcaps):
    problems.append(f"ссылка на несуществующий рисунок {r}")

# 2. Запрещённые слова и фразы
ch2 = main[main.index('id="ch2"'):main.index('id="ch3"')]
ch2_t = html.unescape(re.sub(r"<[^>]+>", " ", ch2))
for w in ("быстро", "удобно", "надёжно", "надежно", "по возможности"):
    for m in re.finditer(w, ch2_t, flags=re.I):
        problems.append(f"глава 2: «{w}»: …{ch2_t[max(0, m.start() - 50):m.end() + 40]}…")
for w in ("как видно из таблицы", "рынок растёт", "цифровизаци", "стандартное решение", "пользователям это удобно", "роль ИТ"):
    if re.search(w, text, flags=re.I):
        problems.append(f"запрещённая фраза: {w}")
for wrong in ("доставщик", "печатник,", "Оператор точки", "заказчик печати"):
    if wrong in text:
        problems.append(f"разнобой в ролях: {wrong}")

# 3. Обязательные блоки
need = ["Обоснование выбора идеи", "Разбор юнит-экономики", "Обоснование модели жизненного цикла", "Результаты исследования",
        "Обоснование приоритетов MoSCoW", "Разбор нефункциональных требований", "Разбор изменений процесса",
        "Обоснование архитектурного стиля", "Разбор схемы данных", "Итоги проверки прототипа", "Сравнение вариантов и расчёт",
        "Выводы по главе 1", "Выводы по главе 2", "Выводы по главе 3"]
for n in need:
    if n not in text:
        problems.append(f"нет блока: {n}")
for a in "АБВГДЕЖЗИ":
    if f"Приложение {a}." not in text:
        problems.append(f"нет приложения {a}")
    if not re.search(rf"(приложени[а-я]+ {a}\b|таблиц[а-я]* {a}\.\d)", text.split("Список источников")[0]):
        problems.append(f"приложение {a} не упомянуто в главах")

# 4. Идентификаторы
for prefix, count in (("FR", 18), ("US", 18), ("TC", 22), ("UC", 11)):
    width = 3 if prefix == "TC" else 2
    for i in range(1, count + 1):
        if f"{prefix}-{i:0{width}d}" not in text:
            problems.append(f"не встречается {prefix}-{i:0{width}d}")
matrix = main[main.index("Таблица 2.11"):]
matrix = matrix[:matrix.index("</table>")]
rows = re.findall(r"<tr>(.*?)</tr>", matrix, flags=re.S)
print(f"строк в матрице: {len(rows) - 1}")

# 5. Правило трёх абзацев: перед объектом абзац, после объекта есть разбор и вывод
parts = re.split(r'(<p class="cap t">.*?</table>|<figure>.*?</figure>)', main, flags=re.S)
in_app = main.index('id="sources"')
pos = 0
for i, p in enumerate(parts):
    is_obj = p.startswith('<p class="cap t">') or p.startswith("<figure>")
    if is_obj and pos < in_app:
        name = re.sub(r"<[^>]+>", "", re.search(r"(Таблица|Рисунок) [^<]+", p)[0])[:30]
        prev = parts[i - 1]
        after = "".join(parts[i + 1:i + 7])
        if "<p>" not in prev and not (prev.strip() == "" and i >= 2):
            problems.append(f"нет подводки: {name}")
        if CONCL_ := ("Вывод." not in after):
            problems.append(f"нет вывода рядом: {name}")
    pos += len(p)

# 6. Объём собственного текста (без таблиц, схем и приложений)
chapters = main[:in_app]
prose = re.sub(r'<p class="cap t">.*?</table>|<figure>.*?</figure>', " ", chapters, flags=re.S)
paras = re.findall(r"<p>(.*?)</p>", prose, flags=re.S)
words = sum(len(re.sub(r"<[^>]+>", " ", p).split()) for p in paras)
print(f"абзацев: {len(paras)}, слов собственного текста: {words}, примерно страниц: {words / 340:.1f}")
if words < 3400:
    problems.append("меньше 10 страниц собственного текста")

print("Незаполненных мест в тексте:", text.count("[заполнить:"))
print("\nЗамечаний:", len(problems))
for p in problems:
    print(" -", p)
