// Сквозная проверка прототипа и снимки экранов для раздела 3.5.
const path = require("node:path");
const fs = require("node:fs");
const { launch, sleep } = require("./cdp");
const ROOT = path.resolve(__dirname, "../..");
const URL_ = "file://" + encodeURI(path.join(ROOT, "prototype/index.html"));
const OUT = path.join(ROOT, "docs/screens");
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "ok   " : "ОШИБКА"} ${name}${extra ? " → " + extra : ""}`); if (!ok) fails++; };

(async () => {
  const c = await launch();
  const go = async (h) => { await c.ev(`location.hash=${JSON.stringify(h)}`); await sleep(120); };
  const text = () => c.ev(`document.getElementById("app").innerText`);
  const click = (sel) => c.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) throw new Error("нет "+${JSON.stringify(sel)}); e.click();})()`);
  const type = (sel, v) => c.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); e.value=${JSON.stringify(v)}; e.dispatchEvent(new Event("input",{bubbles:true})); e.dispatchEvent(new Event("change",{bubbles:true}));})()`);
  const radio = (name, v) => c.ev(`(()=>{const e=document.querySelector('input[name=${name}][value=${v}]'); e.checked=true; e.dispatchEvent(new Event("change",{bubbles:true}));})()`);
  const submit = (sel) => c.ev(`document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))`);
  const shot = async (n) => { await sleep(100); await c.shot(path.join(OUT, n + ".png")); };

  // Снимки делаем в рабочие часы точки (Print Media: будни 09:00–19:00), логика времени не меняется.
  const t=new Date(); const off=new Date(t.getFullYear(),t.getMonth(),t.getDate(),14,30).getTime()-t.getTime();
  await c.send("Page.addScriptToEvaluateOnNewDocument",{source:`(()=>{const D=Date,o=${off};class X extends D{constructor(...a){a.length?super(...a):super(D.now()+o)} static now(){return D.now()+o}};window.Date=X})()`});
  await c.size(420, 900);
  await c.open(URL_);
  await c.ev(`localStorage.clear(); location.reload()`); await sleep(400);

  // Э-00 Вход
  check("без входа открывается Э-00", (await text()).includes("Вход или регистрация"));
  check("шаг 1 из 5", (await text()).includes("Шаг 1 из 5"));
  await type("#ph", "+998 90 123 45 67"); await type("#pw", "123"); await submit("#f"); await sleep(60);
  check("короткий пароль отклонён (NFR-03)", (await text()).includes("не меньше 8"));
  await shot("e00_login_error");
  await type("#ph", "+998 90 123 45 67"); await type("#pw", "testpass1"); await submit("#f"); await sleep(120);

  // Э-01 Загрузка
  check("Э-01 шаг 2", (await text()).includes("Шаг 2 из 5"));
  check("кнопка «Дальше» неактивна без файла", await c.ev(`document.getElementById("next").disabled`));
  await click("#demo"); await sleep(60);
  check("файл добавлен", (await text()).includes("Курсовая.pdf"));
  await shot("e01_upload");
  await click("#next"); await sleep(120);

  // Э-02 Параметры и цена
  const p1 = await text();
  check("Э-02 шаг 3", p1.includes("Шаг 3 из 5"));
  check("цена 24 × 500 + сбор", p1.includes("12 000 сум") && p1.includes("13 000 сум"));
  await radio("binding", "spring"); await sleep(40);
  check("цена пересчитана при переплёте", (await text()).includes("21 000 сум"));
  await radio("color", "color"); await sleep(40);
  check("цена пересчитана при цвете", (await text()).includes("57 000 сум"));
  await radio("color", "bw"); await sleep(40);
  await shot("e02_params");
  await click("#next"); await sleep(120);

  // Э-03 Оплата
  const p2 = await text();
  check("Э-03 шаг 4", p2.includes("Шаг 4 из 5"));
  check("сумма к оплате равна цене на Э-02 (US-03, критерий 3)", p2.includes("Оплатить 21 000 сум"));
  await type("#pr", "ошибка"); await click("#apply"); await sleep(40);
  check("неверный промокод", (await text()).includes("Такого промокода нет"));
  await type("#pr", ""); await click("#apply"); await sleep(40);
  await shot("e03_pay");
  await click("#payb"); await sleep(150);

  // Э-04 Статус
  const p3 = await text();
  check("Э-04 шаг 5", p3.includes("Шаг 5 из 5") && p3.includes("принят"));
  const id = await c.ev(`location.hash.split("/")[2]`);
  const code = await c.ev(`document.querySelector(".code").textContent`);
  check("выдан код из 4 цифр (FR-07)", /^\d{4}$/.test(code), code);
  await shot("e04_status");

  // Э-06 Очередь
  await c.size(1040, 620);
  await go("#/op/queue");
  const q = await text();
  check("новый заказ в очереди оператора (FR-08)", q.includes(id) && q.includes("Курсовая.pdf"));
  check("параметры видны оператору (FR-13)", q.includes("24 стр., A4, чёрно-белая, 1 коп., пружина"));
  const ids = await c.ev(`[...document.querySelectorAll("tbody tr td:first-child")].map(t=>+t.innerText)`);
  check("очередь по времени оплаты, новый заказ последний", ids[ids.length - 1] === +id, ids.join(","));
  await shot("e06_queue");
  await click(`[data-to="${id}:в печати"]`); await sleep(60);
  await click(`[data-to="${id}:готов"]`); await sleep(60);
  check("оператор отметил готовность (FR-09)", (await text()).includes(`№${id} готов`));

  // Э-07 Выдача
  await go("#/op/issue");
  await type("#cd", "0000"); await submit("#f"); await sleep(60);
  check("неверный код отклонён", (await text()).includes("не найден"));
  await type("#cd", code); await submit("#f"); await sleep(60);
  check("заказ найден по коду", (await text()).includes(`№${id}`));
  await shot("e07_issue");

  // Э-04 у клиента после готовности
  await c.size(420, 900);
  await go(`#/status/${id}`);
  check("клиент видит уведомление о готовности (FR-06)", (await text()).includes("Уведомление отправлено"));
  await c.size(1040, 620);
  await go("#/op/issue");
  await type("#cd", code); await submit("#f"); await sleep(60);
  await click("#give"); await sleep(60);
  check("заказ выдан", (await text()).includes(`№${id} выдан`));

  // Э-05 Мои заказы
  await c.size(420, 900);
  await go("#/orders");
  await click(`[data-rate="${id}:5"]`); await sleep(60);
  check("оценка сохранена (FR-16)", (await text()).includes("Спасибо за оценку"));
  await shot("e05_orders");
  await click(`[data-again="${id}"]`); await sleep(120);
  check("повтор подставил параметры (FR-12)", (await text()).includes("21 000 сум"));

  // Э-08 Цены: новая цена влияет на новый заказ и не меняет оплаченный
  await c.size(1040, 700);
  await go("#/admin/prices");
  await shot("e08_prices");
  await type("#A4bw", "700"); await submit("#f"); await sleep(60);
  check("цена сохранена (FR-10)", (await text()).includes("Цены сохранены"));
  const paid = await c.ev(`JSON.parse(localStorage.getItem("printnow.proto.v1")).orders.find(o=>o.id===${id}).total`);
  check("цена оплаченного заказа не изменилась", paid === 21000, String(paid));
  await go("#/params"); await sleep(60);
  check("новый заказ считается по новой цене", (await text()).includes("25 800 сум") || (await text()).includes("26 800 сум") || (await text()).includes("26 000 сум"), (await text()).match(/Итого\s+([\d ]+)/)?.[1]);
  await type("#cp", "1");
  await go("#/admin/prices"); await type("#A4bw", "500"); await submit("#f"); await sleep(60);

  // Э-09 Выручка
  await go("#/admin/revenue");
  const rev = await text();
  check("выручка без сервисного сбора (FR-11)", rev.includes("сервисный сбор PrintNow сюда не входит"));
  await shot("e09_revenue");

  check("ошибок JavaScript нет", c.errors.length === 0, c.errors.join(" | "));
  await c.close();
  console.log(fails ? `Провалов: ${fails}` : "Все проверки прошли");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
