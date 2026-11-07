// Рендер схем в PNG для презентации.
const fs = require("node:fs"), path = require("node:path");
const d = require("../build/diagrams"); const { launch, sleep } = require("../build/cdp");
const out = path.join(__dirname, "assets");
(async () => {
  const all = { as_is: d.asIs(), to_be: d.toBe(), use_case: d.useCase(), states: d.states(), er: d.er(), arch: d.arch() };
  const c = await launch();
  for (const [k, v] of Object.entries(all)) {
    const f = path.join(process.env.TMPDIR || "/tmp", `pn_${k}.html`);
    fs.writeFileSync(f, `<!doctype html><meta charset=utf-8><body style="margin:0;background:#fff;width:800px">${v}</body>`);
    const h = +v.match(/viewBox="0 0 \d+ (\d+)"/)[1];
    await c.size(800, h, false, 3); await c.open("file://" + f); await sleep(120);
    await c.shot(path.join(out, k + ".png"));
    console.log(k, 800 * 3, h * 3);
  }
  await c.close();
})();
