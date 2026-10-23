import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([typeBuf, data]);
  const crc = crc32(typeAndData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([lenBuf, typeAndData, crcBuf]);
}

function generatePngBuffer(width, height) {
  const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // Deflate
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // No interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  // Line segment distance helper
  function distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter byte 0 (None)

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      const nx = x / width;
      const ny = y / height;

      // Base background: #09090b
      let r = 9;
      let g = 9;
      let b = 11;
      let a = 255;

      // Inner card container (rounded rect from 0.1 to 0.9)
      const cx = nx - 0.5;
      const cy = ny - 0.5;
      const distFromCenter = Math.hypot(cx, cy);

      // Subtle gradient radial glow
      if (distFromCenter < 0.46) {
        const glow = 1 - distFromCenter / 0.46;
        r = Math.min(255, Math.round(r + 20 * glow));
        g = Math.min(255, Math.round(g + 20 * glow));
        b = Math.min(255, Math.round(b + 35 * glow));
      }

      // Draw Hanger Emblem
      // Hook: arc centered at (0.5, 0.38), radius ~0.06
      const hookDist = Math.abs(Math.hypot(nx - 0.5, ny - 0.37) - 0.055);
      const isHookAngle = ny < 0.40 && (nx >= 0.45 || ny < 0.37);

      // Hanger triangle:
      // Left shoulder: (0.22, 0.58) -> (0.5, 0.42)
      const dShoulderL = distToSegment(nx, ny, 0.22, 0.58, 0.5, 0.42);
      // Right shoulder: (0.5, 0.42) -> (0.78, 0.58)
      const dShoulderR = distToSegment(nx, ny, 0.5, 0.42, 0.78, 0.58);
      // Bottom horizontal bar: (0.22, 0.58) -> (0.78, 0.58)
      const dBottomBar = distToSegment(nx, ny, 0.22, 0.58, 0.78, 0.58);

      const stroke = 0.022; // Normalized stroke thickness

      const onHanger =
        (isHookAngle && hookDist < stroke) ||
        dShoulderL < stroke ||
        dShoulderR < stroke ||
        dBottomBar < stroke;

      // Sparkle star at (0.74, 0.34)
      const dSparkleX = Math.abs(nx - 0.74);
      const dSparkleY = Math.abs(ny - 0.34);
      const onSparkle =
        (dSparkleX < 0.01 && dSparkleY < 0.05) ||
        (dSparkleY < 0.01 && dSparkleX < 0.05) ||
        Math.hypot(dSparkleX, dSparkleY) < 0.015;

      if (onHanger || onSparkle) {
        // Sky Blue #38bdf8
        r = 56;
        g = 189;
        b = 248;
      }

      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([PNG_SIGNATURE, ihdrChunk, idatChunk, iendChunk]);
}

const icons = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'pwa-192x192.png', size: 192 },
  { file: 'pwa-512x512.png', size: 512 },
];

for (const { file, size } of icons) {
  const filePath = path.join(publicDir, file);
  const buf = generatePngBuffer(size, size);
  fs.writeFileSync(filePath, buf);
  console.log(`Generated ${file} (${size}x${size}) - ${buf.length} bytes`);
}
