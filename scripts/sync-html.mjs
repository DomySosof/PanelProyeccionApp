// Copia el HTML original a app/index.html y le cambia los CDN por las
// librerías locales (para que la app funcione sin internet).
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const parent = path.resolve(root, "..");

const vendors = [
  ["xlsx.full.min.js", "xlsx.full.min.js"],
  ["chart.umd.min.js", "chart.umd.min.js"],
  ["chartjs-plugin-datalabels", "chartjs-plugin-datalabels.min.js"],
  ["chartjs-plugin-annotation", "chartjs-plugin-annotation.min.js"],
];

const CSP =
  "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' data: blob:; object-src 'none'";

// Busca el HTML fuente: el .html más reciente en la carpeta padre o en la raíz del proyecto.
const candidates = [];
for (const dir of [parent, root]) {
  for (const name of await readdir(dir)) {
    if (name.toLowerCase().endsWith(".html") && !name.startsWith("index.")) {
      candidates.push(path.join(dir, name));
    }
  }
}
if (process.argv[2]) candidates.push(path.resolve(process.argv[2]));
if (!candidates.length) throw new Error("No se encontró ningún archivo .html de origen.");

const stats = await Promise.all(
  candidates.map(async (p) => ({ p, mtime: (await stat(p)).mtimeMs })),
);
stats.sort((a, b) => b.mtime - a.mtime);
const source = stats[0].p;

let html = await readFile(source, "utf8");

// Fuente Inter local
html = html.replace(/<link[^>]*preconnect[^>]*googleapis[^>]*>\s*/gi, "");
html = html.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, '<link rel="stylesheet" href="vendor/inter.css">');

// Scripts de CDN -> vendor local
html = html.replace(/<script([^>]*?)src="(https?:\/\/[^"]+)"([^>]*)>/gi, (tag, pre, url, post) => {
  const hit = vendors.find(([key]) => url.includes(key));
  return hit ? `<script${pre}src="vendor/${hit[1]}"${post}>` : tag;
});

// CSP (evita el aviso de seguridad de Electron y bloquea contenido remoto)
if (!/Content-Security-Policy/i.test(html)) {
  html = html.replace(
    /<meta charset="UTF-8">/i,
    `<meta charset="UTF-8">\n<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
  );
}

await writeFile(path.join(root, "app", "index.html"), html, "utf8");

const leftovers = [...html.matchAll(/https?:\/\/(?:cdn|fonts|unpkg)[^"']+/gi)].map((m) => m[0]);
console.log("Sincronizado:", source);
console.log("Tamaño:", (Buffer.byteLength(html) / 1024).toFixed(0), "KB");
if (leftovers.length) console.warn("Aviso: aún hay referencias remotas:", leftovers.join(", "));
