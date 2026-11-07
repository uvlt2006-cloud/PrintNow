// Снимает все рисунки работы в PNG для Word: ширина страницы 165 мм = 624 px.
const fs = require("node:fs"), path = require("node:path");
const { launch, sleep } = require("./cdp");
const work = path.resolve(__dirname, "../work.html");
const out = path.resolve(__dirname, "../docx_figures");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const c = await launch();
  await c.size(624, 1000, false, 2.5);
  await c.open("file://" + encodeURI(work)); await sleep(800);
  const rects = await c.ev(`[...document.querySelectorAll('figure')].map(f=>{const e=f.firstElementChild;const r=e.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,w:r.width,h:r.height,cap:f.querySelector('figcaption').textContent}})`);
  const meta = [];
  for (const [i, r] of rects.entries()) {
    const d = await c.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } });
    const f = `fig${i + 1}.png`;
    fs.writeFileSync(path.join(out, f), Buffer.from(d.data, "base64"));
    meta.push({ file: f, w: r.w, h: r.h, cap: r.cap });
  }
  fs.writeFileSync(path.join(out, "meta.json"), JSON.stringify(meta, null, 1));
  await c.close();
  console.log(meta.map((m) => `${m.file} ${Math.round(m.w)}×${Math.round(m.h)}`).join("\n"));
})();
