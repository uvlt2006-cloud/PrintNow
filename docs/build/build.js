// Сборка проектной работы: HTML → PDF через установленный Chrome. Сторонних пакетов нет.
// Запуск: node build.js
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { execFileSync } = require("node:child_process");
const { launch, sleep } = require("./cdp");
const diagrams = require("./diagrams");

const ROOT = path.resolve(__dirname, "../..");
const OUT_PDF = path.resolve(ROOT, "..", "PrintNow_Проектная_работа.pdf");
const FILL = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/fill.json"), "utf8"));
const missing = new Set();
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Расчёты: единственный источник чисел
const calc = JSON.parse(execFileSync("python3", ["-I", path.join(__dirname, "calc.py")], { encoding: "utf8" }));
const n = (x) => Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const m1 = (x) => (Math.round(x / 100000) / 10).toFixed(1).replace(".", ",");
const sg = (x) => (x < 0 ? "−" : "+") + n(Math.abs(x));
const U = calc.unit, O = calc.old, Y = calc.years, T3 = calc.total3, Sc = calc.scen, ScO = calc.scen_old;
const pay = (v) => (v == null ? "не за 10 лет" : v + "-й месяц");
const C = {
  old_t: n(O.t.rev), old_l: n(O.l.rev), old_h: n(O.h.rev), new_t: n(U.t.rev), new_l: n(U.l.rev), new_h: n(U.h.rev),
  newc_t: n(U.t.contrib), newc_l: n(U.l.contrib), newc_h: n(U.h.contrib), oldc_t: n(O.t.contrib), oldc_l: n(O.l.contrib), oldc_h: n(O.h.contrib),
  var_t: n(U.t.var), var_l: n(U.l.var), var_h: n(U.h.var), tax_t: n(U.t.tax), tax_l: n(U.l.tax), tax_h: n(U.h.tax),
  turn_t: n(U.t.turnover), turn_l: n(U.l.turnover), turn_h: n(U.h.turnover),
  share_t: U.t.share.toFixed(1).replace(".", ","), share_l: U.l.share.toFixed(1).replace(".", ","), share_h: U.h.share.toFixed(1).replace(".", ","),
  be: calc.be, be_old: calc.be_old, be_t_sum: n(calc.be.t * U.t.contrib), be_l_sum: n(calc.be.l * U.l.contrib), be_h_sum: n(calc.be.h * U.h.contrib),
  rev_div: (calc.fixed1 / U.t.rev).toFixed(1).replace(".", ","),
  cross_w: Math.round(calc.cross_week), fixed1: n(calc.fixed1), fixed22: n(calc.fixed22), support: n(calc.support_step),
  capex: n(calc.capex_a), capex_b: n(calc.capex_b), capex_m: m1(calc.capex_a), wait_val: n(calc.wait_val),
  pm_t: calc.point_min_t.toFixed(1).replace(".", ","), pm_l: calc.point_min_l.toFixed(1).replace(".", ","),
  cum36: n(-Sc.base.cum36), cum36_m: m1(-Sc.base.cum36), rev36: n(T3.rev), rev36_m: m1(T3.rev), all_m: m1(calc.bridge.all), orders_36: n(T3.orders),
  pay: pay(Sc.base.payback), pay_l: pay(Sc.low.payback), pay_h: pay(Sc.half.payback), pay_s: pay(Sc.slow.payback), first: Sc.base.first_profit,
  tco_a: n(calc.tco_a_sum), tco_b: n(calc.tco_b_sum), tco_b_exit: n(calc.tco_b_exit), tco_diff: n(calc.tco_a_sum - calc.tco_b_sum),
  tco_a_m: m1(calc.tco_a_sum), tco_a_usd: n(calc.tco_a_usd), tco_b_usd: n(calc.tco_b_usd),
  a: Object.fromEntries(Object.entries(calc.tco_a).map(([k, v]) => [k, n(v)])),
  b: Object.fromEntries(Object.entries(calc.tco_b).map(([k, v]) => [k, n(v)])),
  br: Object.fromEntries(Object.entries(calc.bridge).map(([k, v]) => [k, n(v)])),
  y: Y.map((y) => ({ points: y.points, new: y.new, orders: n(y.orders), sub: n(y.sub), fee: n(y.fee), rev: n(y.rev), fixed: n(y.fixed), var: n(y.sms + y.prov), tax: n(y.tax), acq: n(y.acq), cost: n(y.cost), net: sg(y.net), cum: sg(y.cum) })),
  t3: { orders: n(T3.orders), sub: n(T3.sub), fee: n(T3.fee), rev: n(T3.rev), fixed: n(T3.fixed), var: n(T3.sms + T3.prov), tax: n(T3.tax), acq: n(T3.acq), cost: n(T3.cost), net: sg(T3.net), new: Y.reduce((a, y) => a + y.new, 0) },
  scen: Object.fromEntries(Object.keys(Sc).map((k) => [k, { p: Sc[k].points36, cum: sg(Sc[k].cum36), first: Sc[k].first_profit ?? "—", pay: pay(Sc[k].payback), old: pay(ScO[k].payback), oldcum: sg(ScO[k].cum36) }])),
};
// Контроль чисел, прописанных в тексте словами
const must = [[calc.be.t, 9], [calc.be.l, 11], [calc.be.h, 12], [calc.be_old.t, 12], [calc.be_old.l, 26], [calc.be_old.h, 59], [Sc.base.payback, 57], [Sc.low.payback, 79], [Sc.half.payback, 117], [Sc.slow.payback, null], [ScO.base.payback, null], [calc.orders, 433], [calc.low, 303], [calc.half, 216], [calc.spr_a, 5], [calc.spr_b, 6], [Sc.base.first_profit, 20]];
must.forEach(([a, b]) => { if (a !== b) throw new Error(`Текст расходится с расчётом: ${a} ≠ ${b}`); });

const LINKS = {
  survey1: "https://docs.google.com/spreadsheets/d/1T7Z8MbMVaxqwSyz8NMiH3g7zdB4Sy0m476NWMhuBlFo/edit?usp=sharing",
  drive: "https://drive.google.com/drive/folders/1n5OGwnIeE9FHsX3sQWBQvkgkZgd0Og84?usp=sharing",
  trello: FILL.trello_link || "",  // приглашение на доску хранится только в docs/fill.json
};

const toc = [];
const H = (lvl, id, t) => { toc.push({ lvl, id, t }); return `<h${lvl} id="${id}">${t}</h${lvl}>`; };
const S = (t) => `<h3>${t}</h3>`;
const CONCL = "<b>Вывод.</b>";
const F = (key, hint) => {
  const v = FILL[key];
  if (v !== undefined && v !== "") return esc(v);
  missing.add(key);
  return `<span class="fill">[заполнить: ${esc(hint)}]</span>`;
};
const T = (num, title, head, rows, o = {}) => {
  const w = o.w ? `<colgroup>${o.w.map((x) => `<col style="width:${x}%">`).join("")}</colgroup>` : "";
  const cell = (c, i, tag) => `<${tag}${(o.num || []).includes(i) ? ' class="r"' : ""}>${c}</${tag}>`;
  return `<p class="cap t">Таблица ${num} — ${title}</p><table class="${o.small ? "small" : ""}">${w}<thead><tr>${head.map((h, i) => cell(h, i, "th")).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => cell(c, i, "td")).join("")}</tr>`).join("")}</tbody></table>`;
};
const Fig = (num, title, body) => `<figure>${typeof body === "function" ? body() : body}<figcaption>Рисунок ${num} — ${title}</figcaption></figure>`;
const shotDir = path.join(ROOT, "docs/screens");
const SHOT = (names, cls) => `<div class="shots ${cls}">${names.map((x) => `<img alt="Экран прототипа ${x}" src="data:image/png;base64,${fs.readFileSync(path.join(shotDir, x + ".png")).toString("base64")}">`).join("")}</div>`;
const ctx = { T, Fig, F, H, S, CONCL, C, D: diagrams, SHOT, ROOT, LINKS, esc, FILL };

const body = [require("./ch1")(ctx), require("./ch2")(ctx), require("./ch3")(ctx), require("./app")(ctx)].join("\n");

const css = `
@page { size: A4; margin: 22mm 15mm 20mm 30mm; }
@page:first { margin: 0; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.32; color: #1F2A30; margin: 0; }
p { margin: 0 0 7pt; text-align: justify; hyphens: auto; orphans: 2; widows: 2; }
h1, h2, h3, .cap, table, figcaption, .toc, .title { font-family: Arial, Helvetica, sans-serif; }
h1 { font-size: 18pt; line-height: 1.2; margin: 0 0 12pt; break-before: page; break-after: avoid; }
h2 { font-size: 14pt; margin: 16pt 0 8pt; break-after: avoid; }
h3 { font-size: 12pt; margin: 12pt 0 6pt; break-after: avoid; }
.cap.t { font-size: 10pt; font-weight: 700; margin: 10pt 0 4pt; text-align: left; hyphens: none; break-after: avoid; }
table { width: 100%; border-collapse: collapse; font-size: 9.5pt; line-height: 1.25; margin: 0 0 11pt; table-layout: fixed; hyphens: auto; }
table.small { font-size: 8.8pt; }
th { background: #F2EEE6; text-align: left; font-weight: 700; border: 0.6pt solid #8A8F8C; padding: 3pt 4pt; vertical-align: top; }
td { border: 0.6pt solid #8A8F8C; padding: 3pt 4pt; vertical-align: top; overflow-wrap: break-word; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
.r { text-align: right; }
figure { margin: 8pt 0 11pt; break-inside: avoid; }
figure svg { width: 100%; height: auto; display: block; }
figcaption { font-size: 10pt; font-weight: 700; text-align: center; margin-top: 5pt; }
.fill { background: #FFE98A; font-family: Arial, sans-serif; font-size: .82em; padding: 0 2pt; }
.shots { display: grid; gap: 6pt; align-items: start; }
.shots img { width: 100%; border: 0.6pt solid #C5C3BE; display: block; }
.phones4 { grid-template-columns: repeat(4, 1fr); }
.phones2 { grid-template-columns: repeat(2, 55mm); justify-content: center; }
.wide2 { grid-template-columns: 1fr; }
.bmc { display: grid; grid-template-columns: repeat(5, 1fr); grid-template-rows: auto auto auto; gap: 0; font: 8.8pt/1.25 Arial, sans-serif; border: 0.8pt solid #1F2A30; }
.bmc .c { border: 0.5pt solid #8A8F8C; padding: 5pt; }
.bmc b { display: block; margin-bottom: 3pt; color: #C8622F; }
.bmc .a { grid-area: 1/1/3/2; } .bmc .b { grid-area: 1/2/2/3; } .bmc .c1 { grid-area: 2/2/3/3; }
.bmc .d { grid-area: 1/3/3/4; background: #FBEDE4; } .bmc .e { grid-area: 1/4/2/5; } .bmc .f { grid-area: 2/4/3/5; }
.bmc .g { grid-area: 1/5/3/6; } .bmc .h { grid-area: 3/1/4/3; } .bmc .i { grid-area: 3/3/4/6; }
pre.code { font: 7.6pt/1.22 Menlo, Consolas, monospace; white-space: pre-wrap; background: #FAF9F6; border: 0.5pt solid #C5C3BE; padding: 6pt; }
ol.sources { padding-left: 18pt; font-size: 11.5pt; }
ol.sources li { margin-bottom: 4pt; overflow-wrap: anywhere; }
a { color: #8E4217; }
.title { height: 297mm; padding: 26mm 18mm 20mm 30mm; display: flex; flex-direction: column; break-after: page; }
.title .u { text-align: center; font-size: 12pt; line-height: 1.4; }
.title .m { margin-top: 55mm; text-align: center; }
.title .kind { font-size: 13pt; letter-spacing: .3pt; }
.title h0 { display: block; font-size: 40pt; font-weight: 700; margin: 10pt 0 4pt; }
.title .sub { font-size: 13pt; }
.title .ch { font-size: 12pt; margin-top: 12pt; color: #596469; }
.title .who { margin-top: auto; font-size: 11.5pt; line-height: 1.5; }
.title .city { text-align: center; margin-top: 24mm; font-size: 11.5pt; }
.toc h1 { break-before: auto; }
.toc .row { display: flex; align-items: baseline; font-size: 11pt; line-height: 1.5; }
.toc .row.l1 { font-weight: 700; margin-top: 5pt; }
.toc .row.l2 { padding-left: 12pt; font-size: 10.5pt; }
.toc .row a { color: inherit; text-decoration: none; }
.toc .dots { flex: 1; border-bottom: 0.7pt dotted #8A8F8C; margin: 0 4pt; transform: translateY(-3pt); }
`;

const nbText = (h) => h
  .replace(/(\d) (\d{3})(?=\D)/g, "$1 $2").replace(/(\d) (\d{3})(?=\D)/g, "$1 $2")
  .replace(/(\d) (сум|млн|%|мин|минут|секунд|часа|часов|SP|МБ|ГБ|точ|заказ|символ|ставки|спринт)/g, "$1 $2")
  .replace(/ (—) /g, " $1 ")
  .replace(/(таблиц[аеуы]|рисун[ко][кае]?|рисунках|разделе?) (\d|[А-И]\.)/g, "$1 $2");

// Неразрывные пробелы ставим только в тексте: в атрибутах SVG (viewBox, points) пробелы значимы.
const nb = (h) => {
  const parts = h.split(/(<style[\s\S]*?<\/style>|<[^>]+>)/);
  return parts.map((p, i) => (i % 2 ? p : nbText(p))).join("");
};

function page(numbers) {
  const tocHtml = toc.map((e) => {
    const label = e.t.replace(/<[^>]+>/g, "");
    return `<div class="row l${e.lvl}"><a href="#${e.id}">${label}</a><span class="dots"></span><span>${numbers?.[e.id] ?? "00"}</span></div>`;
  }).join("");
  const title = `<section class="title">
  <div class="u">УНИВЕРСИТЕТ ПУЧОН В ГОРОДЕ ТАШКЕНТЕ<br>Кафедра e-Business<br>ПРОГРАММНАЯ ИНЖЕНЕРИЯ</div>
  <div class="m"><div class="kind">ПРОЕКТНАЯ РАБОТА</div><h0>PrintNow</h0><div class="sub">Заказ печати, копирования и переплёта:<br>оплатил онлайн, забрал без очереди</div><div class="ch">Главы 1–3 · промежуточный контроль · этапы 1–3</div></div>
  <div class="who">Команда Core3:<br>A · У Виолетта (капитан)<br>B · Ли Светлана<br>C · Шарипова Лиана<br><br>3 курс · 5 семестр · направление e-Business<br>Преподаватель: Ботиров С. Р.</div>
  <div class="city">Ташкент — 2026</div></section>`;
  return nb(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>PrintNow — проектная работа. Команда Core3</title><style>${css}</style></head><body>${title}<section class="toc"><h1 style="break-before:auto">Содержание</h1>${tocHtml}</section>${body}</body></html>`);
}

// Разбор PDF: на какой странице стоит каждая внутренняя ссылка
function destPages(file) {
  const buf = fs.readFileSync(file); const src = buf.toString("latin1");
  const objs = new Map();
  for (const m of src.matchAll(/(\d+) 0 obj\s*([\s\S]*?)endobj/g)) objs.set(+m[1], m[2]);
  for (const [, o] of [...objs]) {
    if (!/\/Type\s*\/ObjStm/.test(o)) continue;
    const st = o.indexOf("stream"); const h = o.slice(0, st);
    const N = +h.match(/\/N (\d+)/)[1], First = +h.match(/\/First (\d+)/)[1];
    const from = src.indexOf(o) + st + 6; const start = src[from] === "\r" ? from + 2 : from + 1;
    const end = src.indexOf("endstream", start);
    let txt; try { txt = zlib.inflateSync(buf.subarray(start, end)).toString("latin1"); } catch { continue; }
    const idx = txt.slice(0, First).trim().split(/\s+/).map(Number);
    for (let i = 0; i < N; i++) objs.set(idx[2 * i], txt.slice(First + idx[2 * i + 1], i + 1 < N ? First + idx[2 * i + 3] : undefined));
  }
  let pagesRoot; for (const [, o] of objs) { if (/\/Type\s*\/Catalog/.test(o)) pagesRoot = +o.match(/\/Pages (\d+) 0 R/)[1]; }
  const order = []; const walk = (id) => { const o = objs.get(id); if (/\/Type\s*\/Pages/.test(o)) { const kids = o.match(/\/Kids\s*\[([^\]]*)\]/)[1]; for (const k of kids.matchAll(/(\d+) 0 R/g)) walk(+k[1]); } else order.push(id); };
  walk(pagesRoot);
  const pos = new Map(order.map((id, i) => [id, i + 1]));
  const res = {};
  for (const [, o] of objs) for (const m of o.matchAll(/\/([A-Za-z0-9_]+)\s*\[\s*(\d+) 0 R\s*\/XYZ/g)) if (pos.has(+m[2])) res[m[1]] = pos.get(+m[2]);
  for (const [, o] of objs) for (const m of o.matchAll(/\(([A-Za-z0-9_]+)\)\s*\[\s*(\d+) 0 R\s*\/XYZ/g)) if (pos.has(+m[2])) res[m[1]] = pos.get(+m[2]);
  return { res, pages: order.length };
}

(async () => {
  const c = await launch();
  const tmp = path.join(process.env.TMPDIR || "/tmp", "printnow_work.html");
  const footer = `<div style="width:100%;font:9pt Arial,sans-serif;color:#596469;padding:0 15mm 0 30mm;display:flex;justify-content:space-between"><span>PrintNow · команда Core3</span><span class="pageNumber"></span></div>`;
  const opts = { displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: footer, generateDocumentOutline: true, generateTaggedPDF: true };
  let numbers = null, info;
  for (let pass = 0; pass < 3; pass++) {
    fs.writeFileSync(tmp, page(numbers));
    await c.open("file://" + tmp); await sleep(700);
    await c.ev(`document.fonts.ready.then(()=>1)`);
    await c.pdf(OUT_PDF, opts);
    info = destPages(OUT_PDF);
    const same = numbers && toc.every((e) => numbers[e.id] === info.res[e.id]);
    numbers = info.res;
    if (same) break;
  }
  const lost = toc.filter((e) => !numbers[e.id]).map((e) => e.id);
  await c.close();
  fs.writeFileSync(path.join(ROOT, "docs/work.html"), page(numbers));
  console.log(`Страниц: ${info.pages}; PDF: ${OUT_PDF}`);
  if (lost.length) console.log("Нет номера страницы:", lost.join(", "));
  console.log(`Незаполненных мест: ${missing.size}: ${[...missing].join(", ")}`);
})().catch((e) => { console.error(e); process.exit(1); });
