#!/usr/bin/env node
/**
 * Phase 8 — generate the three PWA icon variants required by PRD F-PWA-1
 * (192, 512, maskable) without pulling a heavyweight image dep into devDeps.
 *
 * The icons are intentionally simple: a solid-fill rounded square in the
 * MUI primary blue with a centred white "C" glyph. The `maskable` variant
 * has the safe-zone padded out so the OS can mask it to its preferred shape
 * (per https://web.dev/maskable-icon/).
 *
 * Re-run with `node scripts/generate-icons.mjs` if the brand colour changes.
 */
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const OUT_DIR = path.resolve(process.cwd(), "public/icons");
const BRAND = { r: 0x19, g: 0x76, b: 0xd2 }; // #1976d2 — matches lib/theme.ts
const GLYPH = { r: 0xff, g: 0xff, b: 0xff };

/**
 * Render an icon image as a flat RGBA buffer.
 * @param {number} size
 * @param {{maskable: boolean}} opts
 */
function renderIcon(size, { maskable }) {
  const buf = Buffer.alloc(size * size * 4);
  // padding for maskable safe-zone: keep glyph inside the inner 80% per W3C spec
  const padPx = maskable ? Math.round(size * 0.1) : 0;
  const inner = size - padPx * 2;
  const radius = maskable ? 0 : Math.round(size * 0.18); // maskable is full-bleed

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      const insideMask = maskable
        ? true
        : insideRoundedRect(x, y, 0, 0, size, size, radius);
      if (insideMask) {
        r = BRAND.r;
        g = BRAND.g;
        b = BRAND.b;
        a = 255;
      }
      // glyph: a thick-stroked "C" in the centred safe area
      if (drawC(x - padPx, y - padPx, inner)) {
        r = GLYPH.r;
        g = GLYPH.g;
        b = GLYPH.b;
        a = 255;
      }
      const i = (y * size + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = a;
    }
  }
  return buf;
}

function insideRoundedRect(px, py, rx, ry, w, h, r) {
  if (px < rx || py < ry || px >= rx + w || py >= ry + h) return false;
  const dx = Math.min(px - rx, rx + w - 1 - px);
  const dy = Math.min(py - ry, ry + h - 1 - py);
  if (dx >= r || dy >= r) return true;
  const ax = r - dx;
  const ay = r - dy;
  return ax * ax + ay * ay <= r * r;
}

/** A thick "C" glyph occupying the centred safe-area square `[0,size)`. */
function drawC(px, py, size) {
  if (px < 0 || py < 0 || px >= size || py >= size) return false;
  const cx = size / 2;
  const cy = size / 2;
  const outer = size * 0.36;
  const inner = size * 0.22;
  const dx = px - cx;
  const dy = py - cy;
  const r2 = dx * dx + dy * dy;
  if (r2 > outer * outer || r2 < inner * inner) return false;
  // open the right side of the ring (the "C" gap)
  const angle = Math.atan2(dy, dx); // [-π, π]; right = 0
  if (angle > -0.55 && angle < 0.55) return false;
  return true;
}

/* ----------------- PNG encoder (no deps) ----------------- */

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    crc32.table = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  // raw data with one filter byte (0 = None) per scanline
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ----------------- main ----------------- */

await fs.mkdir(OUT_DIR, { recursive: true });

const targets = [
  { name: "icon-192.png", size: 192, maskable: false },
  { name: "icon-512.png", size: 512, maskable: false },
  { name: "icon-512-maskable.png", size: 512, maskable: true },
];

for (const t of targets) {
  const rgba = renderIcon(t.size, { maskable: t.maskable });
  const png = encodePng(t.size, t.size, rgba);
  const outPath = path.join(OUT_DIR, t.name);
  await fs.writeFile(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes)`);
}
