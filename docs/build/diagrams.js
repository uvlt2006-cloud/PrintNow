// Все схемы работы: чистый SVG без внешних инструментов.
const INK = "#1F2A30", MUTED = "#596469", LINE = "#8A8F8C", ACC = "#C8622F", SOFT = "#FBEDE4", BAND = "#F2EEE6", OK = "#E5F1EA";
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
let uid = 0;

class D {
  constructor(w, h, title) { this.w = w; this.h = h; this.o = []; this.id = "m" + (++uid); this.title = title; }
  rect(x, y, w, h, { fill = "#fff", stroke = INK, r = 6, sw = 1.2, dash } = {}) { this.o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`); return this; }
  text(x, y, t, { size = 13, weight = 400, anchor = "middle", fill = INK, lh = 1.2, rotate, italic } = {}) {
    const lines = String(t).split("\n"); const dy = size * lh;
    const y0 = y - ((lines.length - 1) * dy) / 2;
    const tr = rotate ? ` transform="rotate(${rotate} ${x} ${y})"` : "";
    this.o.push(`<text x="${x}" y="${y0}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}" dominant-baseline="middle"${italic ? ' font-style="italic"' : ""}${tr}>${lines.map((l, i) => `<tspan x="${x}" dy="${i ? dy : 0}">${esc(l)}</tspan>`).join("")}</text>`);
    return this;
  }
  box(x, y, w, h, t, o = {}) { this.rect(x, y, w, h, o); this.text(x + w / 2, y + h / 2, t, { size: o.size || 13, weight: o.weight || 400, fill: o.color || INK }); return this; }
  line(pts, { arrow = true, dash, color = INK, open, sw = 1.2, start, end: endm } = {}) {
    const d = pts.map((p) => p.join(",")).join(" ");
    const end = arrow ? ` marker-end="url(#${this.id}${endm || (open ? "o" : "f")})"` : "";
    const st = start ? ` marker-start="url(#${this.id}${start})"` : "";
    this.o.push(`<polyline points="${d}" fill="none" stroke="${color}" stroke-width="${sw}"${dash ? ' stroke-dasharray="5 4"' : ""}${end}${st}/>`);
    return this;
  }
  label(x, y, t, o = {}) {
    const size = o.size || 12; const lines = String(t).split("\n");
    const w = Math.max(...lines.map((l) => l.length)) * size * 0.56 + 6, h = lines.length * size * 1.2 + 2;
    if (o.bg !== false) this.o.push(`<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" fill="${o.bgc || "#fff"}"/>`);
    return this.text(x, y, t, { size, fill: o.fill || MUTED, weight: o.weight || 400, italic: o.italic });
  }
  circle(cx, cy, r, { fill = "#fff", stroke = INK, sw = 1.4 } = {}) { this.o.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`); return this; }
  diamond(cx, cy, r, t) { this.o.push(`<polygon points="${cx},${cy - r} ${cx + r * 1.25},${cy} ${cx},${cy + r} ${cx - r * 1.25},${cy}" fill="${SOFT}" stroke="${ACC}" stroke-width="1.3"/>`); if (t) this.text(cx, cy, t, { size: 12 }); return this; }
  lane(x, y, w, h, t) { this.rect(x, y, w, h, { fill: "#fff", stroke: LINE, r: 0, sw: 1 }); this.o.push(`<rect x="${x}" y="${y}" width="26" height="${h}" fill="${BAND}" stroke="${LINE}"/>`); const ls = String(t).split("\n"); ls.forEach((l, i) => this.text(x + 13 + (i - (ls.length - 1) / 2) * 12.5, y + h / 2, l, { size: 11.5, weight: 700, rotate: -90 })); return this; }
  ellipse(cx, cy, rx, ry, t, o = {}) { this.o.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${o.fill || "#fff"}" stroke="${INK}" stroke-width="1.2"/>`); this.text(cx, cy, t, { size: o.size || 12.5 }); return this; }
  actor(cx, y, t) {
    this.circle(cx, y + 9, 9);
    this.o.push(`<path d="M${cx} ${y + 18} v22 M${cx - 15} ${y + 26} h30 M${cx} ${y + 40} l-13 18 M${cx} ${y + 40} l13 18" fill="none" stroke="${INK}" stroke-width="1.4"/>`);
    return this.text(cx, y + 74, t, { size: 12.5, weight: 700 });
  }
  cls(x, y, w, name, attrs = [], { fill = "#fff", head = BAND, methods = [], size = 12 } = {}) {
    const lh = size + 3.5, hh = 24; const h = hh + attrs.length * lh + 8 + (methods.length ? methods.length * lh + 6 : 0);
    this.rect(x, y, w, h, { fill, r: 3 });
    this.o.push(`<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${head}" stroke="${INK}" stroke-width="1.2" rx="3"/>`);
    this.text(x + w / 2, y + hh / 2, name, { size: 12.5, weight: 700 });
    attrs.forEach((a, i) => this.text(x + 7, y + hh + 11 + i * lh, a, { size, anchor: "start" }));
    if (methods.length) {
      const my = y + hh + attrs.length * lh + 7;
      this.o.push(`<line x1="${x}" y1="${my}" x2="${x + w}" y2="${my}" stroke="${INK}"/>`);
      methods.forEach((a, i) => this.text(x + 7, my + 10 + i * lh, a, { size, anchor: "start" }));
    }
    return h;
  }
  svg() {
    const defs = `<defs>
<marker id="${this.id}f" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${INK}"/></marker>
<marker id="${this.id}o" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10" fill="none" stroke="${INK}" stroke-width="1.2"/></marker>
<marker id="${this.id}t" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto-start-reverse"><path d="M0 0L11 6L0 12z" fill="#fff" stroke="${INK}" stroke-width="1.1"/></marker>
<marker id="${this.id}c" viewBox="0 0 14 10" refX="13" refY="5" markerWidth="12" markerHeight="9" orient="auto-start-reverse"><path d="M1 5L7 1L13 5L7 9z" fill="${INK}"/></marker>
</defs>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" role="img" aria-label="${esc(this.title)}" font-family="Arial, Helvetica, sans-serif">${defs}${this.o.join("")}</svg>`;
  }
}

function asIs() {
  const d = new D(800, 300, "Процесс как есть");
  d.lane(4, 4, 792, 146, "Клиент"); d.lane(4, 150, 792, 146, "Оператор печати");
  const Y1 = 42, Y2 = 188, H = 70, W = 80, col = (i) => 62 + i * 89;
  d.circle(44, Y1 + H / 2, 9, { sw: 1.4 });
  const t = (i, y, s, o) => d.box(col(i), y, W, H, s, { size: 12, ...o });
  t(0, Y1, "Подготовить\nфайл");
  t(1, Y1, "Прийти\nна точку");
  t(2, Y1, "Стоять\nв очереди\n12–25 мин", { fill: SOFT, stroke: ACC });
  t(3, Y1, "Назвать\nпараметры\nустно");
  t(4, Y2, "Рассчитать\nцену\nвручную", { fill: SOFT, stroke: ACC });
  t(5, Y1, "Узнать цену,\nоплатить\nна месте", { fill: SOFT, stroke: ACC });
  t(6, Y2, "Напечатать\nзаказ");
  t(7, Y1, "Ждать\nу точки,\nзабрать", { fill: SOFT, stroke: ACC });
  const my = Y1 + H / 2, my2 = Y2 + H / 2;
  d.line([[53, my], [col(0), my]]);
  for (let i = 0; i < 3; i++) d.line([[col(i) + W, my], [col(i + 1), my]]);
  d.line([[col(3) + W, my], [col(4) + W / 2, my], [col(4) + W / 2, Y2]]);
  d.line([[col(4) + W, my2], [col(5) + W / 2, my2], [col(5) + W / 2, Y1 + H]]);
  d.line([[col(5) + W, my], [col(6) + W / 2, my], [col(6) + W / 2, Y2]]);
  d.line([[col(6) + W, my2], [col(7) + W / 2, my2], [col(7) + W / 2, Y1 + H]]);
  d.line([[col(7) + W / 2, Y1], [col(7) + W / 2, 24], [col(7) + W / 2 - 40, 24]]);
  d.circle(col(7) + W / 2 - 49, 24, 9, { sw: 3 });
  d.text(40, 22, "Выделены шаги, где теряются время и точность (таблица Б.1)", { size: 11.5, anchor: "start", fill: MUTED });
  return d.svg();
}

function toBe() {
  const d = new D(800, 408, "Процесс как будет");
  const L = [["Клиент", 4], ["Система\nPrintNow", 104], ["Платёжный\nпровайдер", 204], ["Оператор\nпечати", 304]];
  L.forEach(([n, y]) => d.lane(4, y, 792, 100, n));
  const by = (lane) => L[lane][1] + 21, H = 58;
  const B = (x, lane, w, s, o) => d.box(x, by(lane), w, H, s, { size: 12, ...o });
  d.circle(48, by(0) + H / 2, 9);
  B(68, 0, 110, "Загрузить файл,\nвыбрать\nпараметры");
  B(150, 1, 110, "Рассчитать цену\nи срок готовности", { fill: OK });
  B(262, 0, 100, "Подтвердить\nи оплатить");
  B(296, 2, 110, "Провести платёж");
  d.diamond(438, by(1) + H / 2, 25, "Успех?");
  B(392, 0, 100, "Увидеть отказ,\nповторить\nоплату");
  B(488, 1, 96, "Принять заказ,\nвыдать код", { fill: OK });
  B(488, 3, 96, "Скачать файл,\nнапечатать");
  B(600, 3, 80, "Отметить\n«Готов»");
  B(600, 1, 80, "Уведомить\nклиента", { fill: OK });
  B(600, 0, 80, "Прийти,\nназвать код");
  B(694, 3, 76, "Проверить\nкод, выдать", { fill: SOFT, stroke: ACC });
  d.circle(784, by(3) + H / 2, 8, { sw: 3 });
  const m = (l) => by(l) + H / 2;
  d.line([[57, m(0)], [68, m(0)]]);
  d.line([[123, by(0) + H], [123, m(1)], [150, m(1)]]);
  d.line([[260, m(1)], [290, m(1)], [290, by(0) + H]]);
  d.line([[345, by(0) + H], [345, by(2)]]);
  d.line([[406, m(2)], [438, m(2)], [438, m(1) + 25]]);
  d.line([[438, m(1) - 25], [438, by(0) + H]]);
  d.label(459, 92, "нет");
  d.line([[392, m(0)], [362, m(0)]]);
  d.line([[469, m(1)], [488, m(1)]]);
  d.label(476, m(1) - 13, "да", { bg: false });
  d.line([[536, by(1) + H], [536, by(3)]]);
  d.line([[584, m(3)], [600, m(3)]]);
  d.line([[640, by(3)], [640, by(1) + H]]);
  d.line([[640, by(1)], [640, by(0) + H]]);
  d.line([[680, m(0)], [732, m(0)], [732, by(3)]]);
  d.line([[770, m(3)], [776, m(3)]]);
  d.label(732, 312, "BG-2: не более 3 мин", { size: 11.5, fill: ACC, weight: 700 });
  return d.svg();
}

function useCase() {
  const d = new D(800, 476, "Диаграмма вариантов использования");
  d.rect(170, 8, 480, 460, { fill: "#FDFCF9", r: 4 });
  d.text(410, 24, "Система PrintNow", { weight: 700, size: 13 });
  const lx = 280, rx = 540, rxl = 82, ry = 23;
  const R = { uc11: 56, uc01: 124, uc05: 192, uc04: 258, uc03: 326, uc06: 382, uc02: 438 };
  const client = [118, 226], prov = [118, 396], oper = [712, 96], adm = [712, 336];
  [R.uc11, R.uc01, R.uc05, R.uc03, R.uc06, R.uc02].forEach((y) => d.line([client, [lx - rxl, y]], { arrow: false }));
  d.line([client, [352, R.uc04]], { arrow: false });
  d.line([prov, [lx - rxl, R.uc02]], { arrow: false });
  d.line([oper, [636, 40], [340, 40]], { arrow: false });
  d.line([adm, [636, 300], [636, 40]], { arrow: false });
  d.line([oper, [rx + rxl, 72]], { arrow: false });
  d.line([oper, [rx + rxl, 146]], { arrow: false });
  d.line([oper, [468, R.uc04]], { arrow: false });
  d.line([adm, [rx + rxl, 322]], { arrow: false });
  d.line([adm, [rx + rxl, 398]], { arrow: false });
  const U = (x, y, s) => d.ellipse(x, y, rxl, ry, s, { size: 12 });
  U(lx, R.uc11, "UC-11\nВойти в систему");
  U(lx, R.uc01, "UC-01\nОформить заказ");
  U(lx, R.uc05, "UC-05\nПовторить заказ");
  U(lx, R.uc03, "UC-03\nОтслеживать статус");
  U(lx, R.uc06, "UC-06\nОценить заказ");
  U(lx, R.uc02, "UC-02\nОплатить заказ");
  d.ellipse(410, R.uc04, 58, 31, "UC-04\nПолучить заказ\nпо коду", { size: 11.5, fill: SOFT });
  U(rx, 72, "UC-07\nВести очередь заказов");
  U(rx, 146, "UC-08\nОтметить заказ готовым");
  U(rx, 322, "UC-09\nНастроить цены");
  U(rx, 398, "UC-10\nСмотреть выручку");
  d.line([[lx, R.uc01 - ry], [lx, R.uc11 + ry]], { dash: true, open: true });
  d.label(lx + 36, 90, "«include»", { size: 11, bgc: "#FDFCF9" });
  d.line([[lx, R.uc05 - ry], [lx, R.uc01 + ry]], { dash: true, open: true });
  d.label(lx + 34, 158, "«extend»", { size: 11, bgc: "#FDFCF9" });
  d.actor(100, 200, "Клиент");
  d.actor(100, 370, "Платёжный\nпровайдер");
  d.actor(730, 70, "Оператор\nпечати");
  d.actor(730, 310, "Администратор\nточки");
  return d.svg();
}

function classes() {
  const d = new D(800, 568, "Диаграмма классов");
  // Наследование ролей
  d.line([[40, 138], [40, 124], [290, 124], [290, 138]], { arrow: false });
  d.line([[147, 124], [147, 138]], { arrow: false });
  d.line([[105, 124], [105, 105]], { open: false, end: "t" });
  // Роли и точка
  d.line([[366, 154], [410, 154], [410, 88]], { arrow: false }); d.label(384, 143, "0..*", { size: 11 }); d.label(422, 99, "1", { size: 11 });
  d.line([[147, 170], [147, 192], [440, 192], [440, 88]], { arrow: false }); d.label(165, 181, "0..*", { size: 11 }); d.label(452, 99, "1", { size: 11 });
  // Заказ
  d.line([[40, 170], [40, 236]], { arrow: false }); d.label(52, 181, "1", { size: 11 }); d.label(56, 226, "0..*", { size: 11 });
  d.line([[500, 88], [500, 214], [190, 214], [190, 236]], { arrow: false }); d.label(512, 99, "1", { size: 11 }); d.label(206, 226, "0..*", { size: 11 });
  d.line([[530, 45], [590, 45]], { arrow: false }); d.label(540, 34, "1", { size: 11 }); d.label(576, 34, "0..*", { size: 11 });
  d.line([[530, 70], [560, 70], [560, 165], [590, 165]], { arrow: false }); d.label(540, 59, "1", { size: 11 }); d.label(576, 154, "0..*", { size: 11 });
  d.line([[230, 310], [300, 310]], { arrow: false, start: "c" }); d.label(252, 299, "1", { size: 11 }); d.label(284, 299, "1..*", { size: 11 });
  d.line([[510, 310], [590, 310]], { arrow: false }); d.label(522, 299, "1", { size: 11 }); d.label(574, 299, "1..*", { size: 11 });
  d.line([[70, 398], [70, 442]], { arrow: false }); d.label(82, 409, "1", { size: 11 }); d.label(86, 432, "0..*", { size: 11 });
  d.line([[160, 398], [160, 420], [315, 420], [315, 442]], { arrow: false }); d.label(172, 409, "1", { size: 11 }); d.label(332, 432, "0..*", { size: 11 });
  d.line([[210, 398], [210, 408], [575, 408], [575, 442]], { arrow: false }); d.label(254, 398, "0..*", { size: 11, bg: false }); d.label(592, 432, "0..1", { size: 11 });
  d.cls(10, 10, 190, "Пользователь", ["телефон: строка", "хешПароля: строка", "роль: Роль"], { methods: ["войти()"] });
  d.cls(10, 138, 66, "Клиент", []);
  d.cls(84, 138, 124, "Оператор печати", []);
  d.cls(216, 138, 150, "Администратор точки", []);
  d.cls(390, 10, 140, "Точка", ["название: строка", "адрес: строка", "активна: логическое"]);
  d.cls(590, 10, 200, "Подписка", ["начало, конец: дата", "сумма: целое", "статус: СтатусПодписки"]);
  d.cls(590, 112, 200, "ЦенаУслуги", ["кодУслуги: строка", "цена: целое", "действуетС, действуетПо"]);
  d.cls(10, 236, 220, "Заказ", ["статус: СтатусЗаказа", "суммаПечати, скидка: целое", "сервисныйСбор, итог: целое", "кодПолучения: строка", "ожидаемаяГотовность: время", "оценка: целое"], { head: SOFT, methods: ["рассчитатьИтог()", "сменитьСтатус()"] });
  d.cls(300, 236, 210, "ПозицияЗаказа", ["страниц, копий: целое", "формат, цвет, переплёт: строка", "ценаЗаСтраницу: целое", "ценаПереплёта: целое", "итогПозиции: целое"], { methods: ["рассчитатьИтог()"] });
  d.cls(590, 262, 200, "Файл", ["имя, тип: строка", "размерБайт: целое", "удалён: время"]);
  d.cls(10, 442, 200, "Платёж", ["провайдер: строка", "идОперации: строка", "сумма: целое", "статус: СтатусПлатежа"]);
  d.cls(230, 442, 170, "Уведомление", ["канал: строка", "отправлено: время", "доставлено: логическое"]);
  d.cls(480, 442, 190, "Промокод", ["код: строка", "скидкаПроцент: целое", "действуетПо: время"]);
  return d.svg();
}

function sequence() {
  const P = [["Клиент", 60], ["Модуль\nзаказов", 210], ["Модуль\nплатежей", 345], ["Платёжный\nпровайдер", 480], ["Модуль\nуведомлений", 610], ["Оператор\nпечати", 738]];
  const d = new D(800, 606, "Диаграмма последовательности");
  P.forEach(([n, x]) => { d.line([[x, 44], [x, 598]], { arrow: false, dash: true, color: LINE }); d.box(x - 54, 6, 108, 38, n, { fill: BAND, size: 12, weight: 700, r: 3 }); });
  const x = { к: 60, з: 210, п: 345, пр: 480, у: 610, о: 738 };
  let y = 68;
  const msg = (a, b, t, ret) => { d.line([[x[a], y], [x[b], y]], { dash: ret, open: ret }); d.label((x[a] + x[b]) / 2, y - 9, t, { size: 11.5, fill: INK }); y += 31; };
  const state = (t) => d.label(278, y - 31 - 1, t, { size: 11.5, fill: ACC, weight: 700 });
  msg("к", "з", "1. отправитьФайлИПараметры()");
  msg("з", "к", "2. цена и ожидаемый срок", true);
  msg("к", "з", "3. подтвердитьЗаказ()"); state("заказ: «создан»");
  msg("з", "п", "4. создатьПлатёж()");
  msg("п", "пр", "5. открытьОплату()");
  msg("к", "пр", "6. ввести данные карты на стороне провайдера");
  msg("пр", "п", "7. результатОплаты()");
  const top = y - 14;
  d.rect(20, top, 770, 200, { fill: "none", stroke: MUTED, r: 2 });
  d.o.push(`<rect x="20" y="${top}" width="42" height="18" fill="${BAND}" stroke="${MUTED}"/>`);
  d.text(41, top + 9, "alt", { size: 12, weight: 700 });
  d.label(130, top + 30, "[оплата успешна]", { size: 11, fill: MUTED, bg: false });
  y += 26;
  msg("п", "з", "8. подтвердитьОплату()");
  d.label(278, y - 8, "заказ: «принят»", { size: 11.5, fill: ACC, weight: 700 });
  y += 8;
  msg("з", "к", "9. код получения", true);
  msg("з", "о", "10. заказ в очереди", true);
  const sep = y - 14;
  d.line([[20, sep], [790, sep]], { arrow: false, dash: true, color: MUTED });
  d.label(110, sep + 13, "[отказ]", { size: 11, fill: MUTED, bg: false });
  y += 12;
  msg("п", "з", "11. сообщитьОбОтказе()");
  msg("з", "к", "12. повторить оплату", true);
  y = top + 200 + 26;
  msg("о", "з", "13. отметитьГотов()");
  msg("з", "у", "14. уведомитьКлиента()");
  msg("у", "к", "15. заказ готов", true);
  return d.svg();
}

function states() {
  const d = new D(800, 270, "Диаграмма состояний заказа");
  const s = (x, y, t, o = {}) => d.box(x, y, 104, 50, t, { r: 16, weight: 700, fill: o.fill || "#fff", stroke: o.stroke || INK });
  d.o.push(`<circle cx="24" cy="85" r="8" fill="${INK}"/>`);
  d.line([[32, 85], [60, 85]]);
  s(60, 60, "создан");
  s(255, 60, "принят", { fill: OK });
  s(440, 60, "в печати", { fill: OK });
  s(625, 60, "готов", { fill: OK });
  s(625, 190, "выдан", { fill: BAND });
  s(160, 190, "отменён", { fill: "#F9E6E6", stroke: "#A32F2F" });
  d.line([[164, 85], [255, 85]]); d.label(210, 62, "оплата\nуспешна", { size: 11.5, bg: false });
  d.line([[359, 85], [440, 85]]); d.label(400, 62, "оператор\nвзял заказ", { size: 11.5, bg: false });
  d.line([[544, 85], [625, 85]]); d.label(585, 62, "оператор:\n«Готов»", { size: 11.5, bg: false });
  d.line([[677, 110], [677, 190]]); d.label(737, 150, "код верный,\nоператор выдал", { size: 11.5, bg: false });
  d.line([[112, 110], [112, 215], [160, 215]]); d.label(56, 165, "нет оплаты\n30 минут", { size: 11.5, bg: false });
  d.line([[307, 110], [307, 215], [264, 215]]); d.label(392, 165, "файл нельзя напечатать:\nвозврат оплаты", { size: 11.5, bg: false });
  d.line([[729, 215], [770, 215]]);
  d.circle(779, 215, 9, { sw: 3 });
  d.line([[212, 240], [212, 258], [120, 258]]);
  d.circle(111, 258, 9, { sw: 3 });
  d.label(677, 40, "уведомление клиенту (FR-06)", { size: 11.5, fill: ACC, bg: false });
  return d.svg();
}

function er() {
  const d = new D(800, 548, "Логическая модель данных");
  const f = { size: 11.5 };
  const rel = (pts, a, b, la, lb) => { d.line(pts, { arrow: false }); d.label(a[0], a[1], la, { size: 11 }); d.label(b[0], b[1], lb, { size: 11 }); };
  rel([[190, 56], [290, 56]], [206, 45], [274, 45], "0..*", "0..1");
  rel([[510, 56], [580, 56]], [522, 45], [564, 45], "1", "0..*");
  rel([[510, 88], [545, 88], [545, 170], [580, 170]], [522, 77], [564, 159], "1", "0..*");
  rel([[100, 132], [100, 222]], [112, 143], [116, 212], "1", "0..*");
  rel([[320, 102], [320, 186], [200, 186], [200, 222]], [332, 113], [216, 212], "1", "0..*");
  rel([[190, 110], [262, 110], [262, 204], [580, 204]], [206, 99], [564, 193], "1", "0..*");
  rel([[240, 320], [300, 320]], [252, 309], [284, 309], "1", "1..*");
  rel([[520, 320], [580, 320]], [532, 309], [564, 309], "1", "1..*");
  rel([[70, 389], [70, 430]], [82, 400], [86, 420], "1", "0..*");
  rel([[170, 389], [170, 410], [315, 410], [315, 430]], [182, 400], [331, 420], "1", "0..*");
  rel([[215, 389], [215, 400], [575, 400], [575, 430]], [262, 391], [592, 420], "0..*", "0..1");
  d.cls(10, 10, 180, "app_user", ["PK user_id", "phone (UNIQUE)", "password_hash", "role", "FK point_id", "created_at"], f);
  d.cls(290, 10, 220, "point", ["PK point_id", "name", "address", "is_active"], f);
  d.cls(580, 10, 210, "subscription", ["PK subscription_id", "FK point_id", "period_start, period_end", "amount, status"], f);
  d.cls(580, 122, 210, "price_item", ["PK price_item_id", "FK point_id, FK changed_by", "service_code, price", "valid_from, valid_to"], f);
  d.cls(10, 222, 230, "print_order", ["PK order_id", "FK client_id, FK point_id", "FK promo_code_id", "status", "print_amount, discount", "service_fee, total_amount", "pickup_code, ready_eta", "created_at, ready_at, issued_at", "rating"], { ...f, head: SOFT });
  d.cls(300, 244, 220, "order_item", ["PK order_item_id", "FK order_id", "page_count, copies", "paper_format, color_mode, binding", "unit_price, binding_price", "line_total"], { ...f, head: SOFT });
  d.cls(580, 262, 210, "order_file", ["PK order_file_id", "FK order_item_id", "file_name, file_type, size_bytes", "storage_key, deleted_at"], f);
  d.cls(10, 430, 190, "payment", ["PK payment_id", "FK order_id", "provider, provider_txn", "amount, status", "created_at, paid_at"], f);
  d.cls(230, 430, 170, "notification", ["PK notification_id", "FK order_id", "channel, sent_at", "delivered"], f);
  d.cls(480, 430, 190, "promo_code", ["PK promo_code_id", "code (UNIQUE)", "discount_pct, valid_to"], f);
  return d.svg();
}

function arch() {
  const d = new D(800, 500, "Архитектура контейнеров");
  const actor = (x, t) => d.box(x, 8, 150, 34, t, { fill: BAND, weight: 700, size: 12.5, r: 16 });
  actor(60, "Клиент"); actor(325, "Оператор печати"); actor(590, "Администратор точки");
  d.box(40, 72, 190, 60, "Клиентское приложение\nPWA в браузере телефона", { size: 12.5, fill: OK });
  d.box(320, 72, 440, 60, "Кабинеты оператора и администратора\nвеб-интерфейс в браузере", { size: 12.5, fill: OK });
  d.line([[135, 42], [135, 72]]); d.line([[400, 42], [400, 72]]); d.line([[665, 42], [665, 72]]);
  d.rect(40, 168, 720, 174, { fill: "#FDFCF9", stroke: ACC, sw: 1.6, r: 6 });
  d.text(400, 184, "Серверное приложение PrintNow: модульный монолит (один процесс, один релиз)", { weight: 700, size: 12.5 });
  const mods = [["Пользователи", "UC-11"], ["Заказы", "UC-01, 03, 04, 05, 06"], ["Цены", "UC-09"], ["Очередь", "UC-07, 08"], ["Платежи", "UC-02"], ["Файлы", "FR-01, FR-13"], ["Уведомления", "FR-06"], ["Отчёты и подписки", "UC-10"]];
  mods.forEach(([n, u], i) => { const x = 56 + (i % 4) * 174, y = 198 + Math.floor(i / 4) * 70; d.rect(x, y, 164, 60, { r: 4 }); d.text(x + 82, y + 22, n, { weight: 700, size: 12.5 }); d.text(x + 82, y + 42, u, { size: 11.5, fill: MUTED }); });
  d.line([[135, 132], [135, 168]]); d.label(190, 150, "HTTPS, JSON", { size: 11.5 });
  d.line([[540, 132], [540, 168]]); d.label(595, 150, "HTTPS, JSON", { size: 11.5 });
  const low = (x, w, t, o) => d.box(x, 400, w, 74, t, { size: 12.5, ...o });
  low(40, 150, "PostgreSQL\nзаказы, цены,\nпользователи", { fill: BAND });
  low(210, 150, "Файловое\nхранилище\nудаление через 7 суток", { fill: BAND });
  low(430, 150, "Платёжный провайдер\nPayme, Click", { stroke: MUTED, dash: "5 4" });
  low(610, 150, "Telegram Bot API,\nSMS-шлюз", { stroke: MUTED, dash: "5 4" });
  d.line([[115, 342], [115, 400]]); d.label(84, 371, "SQL", { size: 11.5 });
  d.line([[285, 342], [285, 400]]); d.label(246, 371, "файлы", { size: 11.5 });
  d.line([[505, 342], [505, 400]]); d.label(555, 371, "API, webhook", { size: 11.5 });
  d.line([[685, 342], [685, 400]]); d.label(735, 371, "API", { size: 11.5 });
  d.line([[505, 400], [505, 342]]);
  d.label(400, 490, "Сплошная рамка: то, что строим. Пунктирная рамка: внешние сервисы.", { size: 11.5, bg: false });
  return d.svg();
}

module.exports = { asIs, toBe, useCase, classes, sequence, states, er, arch };

if (require.main === module) {
  const fs = require("node:fs"), path = require("node:path");
  const out = path.resolve(__dirname, "../diagrams"); fs.mkdirSync(out, { recursive: true });
  const all = { as_is: asIs(), to_be: toBe(), use_case: useCase(), classes: classes(), sequence: sequence(), states: states(), er: er(), arch: arch() };
  for (const [k, v] of Object.entries(all)) fs.writeFileSync(path.join(out, k + ".svg"), v);
  (async () => {
    const { launch, sleep } = require("./cdp");
    const c = await launch();
    await c.size(1100, 800, false, 1.4);
    for (const [k, v] of Object.entries(all)) {
      const html = `<!doctype html><meta charset=utf-8><body style="margin:10px;background:#fff;width:1060px">${v}</body>`;
      const f = path.join(process.env.TMPDIR || "/tmp", `pn_${k}.html`); fs.writeFileSync(f, html);
      await c.open("file://" + f); await sleep(100);
      const h = await c.ev(`Math.ceil(document.querySelector("svg").getBoundingClientRect().height)+20`);
      await c.size(1100, h, false, 1.4); await sleep(60);
      await c.shot(path.join(process.argv[2] || out, k + ".png"));
    }
    await c.close();
    console.log("ok");
  })();
}
