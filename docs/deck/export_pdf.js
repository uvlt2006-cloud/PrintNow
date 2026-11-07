// Локальная PDF-копия презентации из файлов слайдов.
const fs = require("node:fs"), path = require("node:path");
const { launch, sleep } = require("../build/cdp.js");
const DECK = __dirname;
const OUT = path.resolve(DECK, "../../..", "PrintNow_Презентация.pdf");
const gen = fs.readFileSync(path.join(DECK, "gen.js"), "utf8");
const names = { as_is: "as_is", to_be: "to_be", use_case: "use_case", states: "states", er: "er", arch: "arch", e02: "e02_params", e03: "e03_pay", e04: "e04_status", e06: "e06_queue" };
const map = {};
for (const [k, f] of Object.entries(names)) { const m = gen.match(new RegExp(k + ': "(/_blob/[0-9a-f]+)"')); map[m[1]] = "file://" + encodeURI(path.join(DECK, "assets", f + ".png")); }
const deck = JSON.parse(fs.readFileSync(path.join(DECK, "project/deck.json"), "utf8"));
let body = deck.order.map((id) => fs.readFileSync(path.join(DECK, `project/slides/${id}.html`), "utf8")).join("\n");
for (const [b, f] of Object.entries(map)) body = body.split(b).join(f);
const css = `@page{size:1920px 1080px;margin:0}*{box-sizing:border-box;margin:0}html,body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
section{width:1920px;height:1080px;position:relative;overflow:hidden;break-after:page}section:last-of-type{break-after:auto}aside{display:none}img{display:block}h1,h2,h3{font-weight:600}p{font-size:32px;line-height:1.4}
table{border-collapse:collapse}th,td{padding:.35em .6em;border:1px solid #bbb;vertical-align:top;text-align:left;line-height:1.25}x-shape{display:block}
x-shape[kind=arrow-right]{clip-path:polygon(0 30%,60% 30%,60% 0,100% 50%,60% 100%,60% 70%,0 70%)}`;
(async () => {
  const f = path.join(process.env.TMPDIR || "/tmp", "pn_deck_all.html");
  fs.writeFileSync(f, `<!doctype html><html lang="ru"><meta charset="utf-8"><title>${deck.title}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@400..800&family=IBM+Plex+Sans:wght@400;600;700&display=swap"><style>${css}</style>${body}</html>`);
  const c = await launch();
  await c.open("file://" + f); await sleep(1500);
  await c.ev("document.fonts.ready.then(()=>1)");
  const r = await c.ev(`({rubik:document.fonts.check('600 40px Rubik','Привет'),plex:document.fonts.check('400 28px "IBM Plex Sans"','Привет'),broken:[...document.images].filter(i=>!i.naturalWidth).length,sections:document.querySelectorAll('section').length})`);
  console.log(JSON.stringify(r));
  await c.pdf(OUT, {});
  await c.close();
  console.log(OUT, fs.statSync(OUT).size);
})();
