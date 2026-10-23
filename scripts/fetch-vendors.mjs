// Descarga las dependencias externas para que la app funcione sin internet.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const out = path.resolve(import.meta.dirname, "..", "app", "vendor");
await mkdir(path.join(out, "fonts"), { recursive: true });

const files = [
  ["https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", "xlsx.full.min.js"],
  ["https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js", "chart.umd.min.js"],
  ["https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js", "chartjs-plugin-datalabels.min.js"],
  ["https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.1.0/dist/chartjs-plugin-annotation.min.js", "chartjs-plugin-annotation.min.js"],
];

for (const [url, name] of files) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path.join(out, name), buf);
  console.log("OK", name, (buf.length / 1024).toFixed(0) + " KB");
}

// Fuente Inter: pedimos el CSS con UA de Chrome para recibir woff2 (subset latin).
const cssUrl = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap";
const cssRes = await fetch(cssUrl, {
  headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" },
});
if (!cssRes.ok) throw new Error(`fonts css -> ${cssRes.status}`);
let css = await cssRes.text();

const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/g)].map((m) => m[1]);
const unique = [...new Set(urls)];
const map = new Map();
for (const [i, u] of unique.entries()) {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${u} -> ${r.status}`);
  const fname = `fonts/inter-${i}.woff2`;
  await writeFile(path.join(out, fname), Buffer.from(await r.arrayBuffer()));
  map.set(u, fname);
  console.log("OK", fname);
}
for (const [u, f] of map) css = css.split(u).join(f);
css = css.replace(/\/\*[^*]*latin-ext[^*]*\*\//g, "");
await writeFile(path.join(out, "inter.css"), css);
console.log("OK inter.css", unique.length, "archivos de fuente");
