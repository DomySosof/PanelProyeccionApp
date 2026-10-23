// Genera build/icon.ico (256x256) sin dependencias externas.
import { deflateSync } from "node:zlib";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const SIZE = 256;
const SS = 4; // supersampling para bordes suaves
const W = SIZE * SS;

const px = new Uint8Array(W * W * 4);

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

function blend(x, y, [r, g, b], a = 1) {
  if (x < 0 || y < 0 || x >= W || y >= W) return;
  const i = (y * W + x) * 4;
  px[i] = px[i] * (1 - a) + r * a;
  px[i + 1] = px[i + 1] * (1 - a) + g * a;
  px[i + 2] = px[i + 2] * (1 - a) + b * a;
  px[i + 3] = Math.min(255, px[i + 3] + 255 * a);
}

// Rectángulo redondeado con relleno por color plano o degradado vertical.
function roundRect(x0, y0, w, h, radius, colorTop, colorBottom = colorTop) {
  const c1 = hex(colorTop);
  const c2 = hex(colorBottom);
  for (let y = Math.round(y0); y < Math.round(y0 + h); y++) {
    const t = h > 1 ? (y - y0) / h : 0;
    const col = [
      c1[0] + (c2[0] - c1[0]) * t,
      c1[1] + (c2[1] - c1[1]) * t,
      c1[2] + (c2[2] - c1[2]) * t,
    ];
    for (let x = Math.round(x0); x < Math.round(x0 + w); x++) {
      const dx = Math.max(x0 + radius - x, x - (x0 + w - radius), 0);
      const dy = Math.max(y0 + radius - y, y - (y0 + h - radius), 0);
      if (dx * dx + dy * dy <= radius * radius) blend(x, y, col);
    }
  }
}

const s = (v) => v * SS;

// Fondo
roundRect(s(6), s(6), s(244), s(244), s(52), "#1b2130", "#0b0e13");

// Barras ascendentes
const bars = [
  [s(48), s(150), s(40), s(62), "#1d4ed8"],
  [s(108), s(112), s(40), s(100), "#3b82f6"],
  [s(168), s(74), s(40), s(138), "#60a5fa"],
];
for (const [x, y, w, h, c] of bars) roundRect(x, y, w, h, s(10), c);

// Línea de tendencia con puntos
const pts = [
  [s(52), s(126)],
  [s(128), s(94)],
  [s(204), s(52)],
];
for (let i = 0; i < pts.length - 1; i++) {
  const [x1, y1] = pts[i];
  const [x2, y2] = pts[i + 1];
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
  for (let k = 0; k <= steps; k++) {
    const x = x1 + ((x2 - x1) * k) / steps;
    const y = y1 + ((y2 - y1) * k) / steps;
    for (let oy = -s(4.5); oy <= s(4.5); oy++) {
      for (let ox = -s(4.5); ox <= s(4.5); ox++) {
        if (ox * ox + oy * oy <= s(4.5) ** 2) blend(Math.round(x + ox), Math.round(y + oy), hex("#e6edf7"));
      }
    }
  }
}
for (const [cx, cy] of pts) {
  for (let oy = -s(9); oy <= s(9); oy++) {
    for (let ox = -s(9); ox <= s(9); ox++) {
      const d = Math.hypot(ox, oy);
      if (d <= s(9)) blend(Math.round(cx + ox), Math.round(cy + oy), hex("#0b0e13"), 1);
      if (d <= s(6.5)) blend(Math.round(cx + ox), Math.round(cy + oy), hex("#e6edf7"), 1);
    }
  }
}

// Downsample (box filter)
const out = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const i = ((y * SS + sy) * W + (x * SS + sx)) * 4;
        r += px[i]; g += px[i + 1]; b += px[i + 2]; a += px[i + 3];
      }
    }
    const n = SS * SS;
    const o = (y * SIZE + x) * 4;
    out[o] = Math.round(r / n);
    out[o + 1] = Math.round(g / n);
    out[o + 2] = Math.round(b / n);
    out[o + 3] = Math.round(a / n);
  }
}

// --- PNG ---
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  out.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

// --- ICO (PNG embebido, 256x256) ---
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
const entry = Buffer.alloc(16);
entry[0] = 0; // 256 px
entry[1] = 0; // 256 px
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12);

const dir = path.resolve(import.meta.dirname, "..", "build");
await writeFile(path.join(dir, "icon.png"), png);
await writeFile(path.join(dir, "icon.ico"), Buffer.concat([header, entry, png]));
console.log("icon.png / icon.ico generados:", png.length, "bytes");
