// Минимальная обёртка над Chrome DevTools Protocol: только встроенные возможности Node.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), "pn-chrome-"));
  const proc = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${dir}`, "about:blank"], { stdio: "ignore" });
  let port;
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100);
    try { port = fs.readFileSync(path.join(dir, "DevToolsActivePort"), "utf8").split("\n")[0]; } catch {}
  }
  if (!port) throw new Error("Chrome не запустился");
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0; const waiting = new Map(); const errors = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && waiting.has(d.id)) { const { res, rej } = waiting.get(d.id); waiting.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
    if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push(d.params.args.map((a) => a.value).join(" "));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; waiting.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
  await send("Page.enable"); await send("Runtime.enable");
  const api = {
    send, errors,
    async open(url) { await send("Page.navigate", { url }); await sleep(500); },
    async ev(expr) {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async size(width, height, mobile = false, scale = 2) { await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile }); },
    async shot(file, full = false) {
      const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full });
      fs.writeFileSync(file, Buffer.from(r.data, "base64"));
    },
    async pdf(file, opts) {
      const r = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true, transferMode: "ReturnAsBase64", ...opts });
      fs.writeFileSync(file, Buffer.from(r.data, "base64"));
    },
    async close() { try { await send("Browser.close"); } catch {} ws.close(); proc.kill(); await sleep(200); fs.rmSync(dir, { recursive: true, force: true }); },
  };
  return api;
}
module.exports = { launch, sleep };
