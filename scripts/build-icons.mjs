/**
 * Generate the PWA icon set from the same mark as favicon.svg.
 *
 * Written by hand rather than pulled from an image library: the mark is four
 * analytic shapes on a rounded square, and rasterising it here keeps the icons
 * regenerable with `npm run icons` and adds no build dependency.
 *
 * Usage: node scripts/build-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const INK = [0x1a, 0x17, 0x14];
const PAPER = [0xfa, 0xf8, 0xf4];

/** Anti-aliasing: samples per pixel, per axis. */
const SS = 4;

/** The favicon mark, in its own 32-unit box: two bars with rounded right ends. */
function inMark(x, y) {
  const bar = (top, bottom, right, cx) =>
    (x >= 9 && x <= cx && y >= top && y <= bottom) ||
    (x >= cx && (x - cx) ** 2 + (y - (top + bottom) / 2) ** 2 <= right ** 2);

  return bar(8, 16, 4, 20) || bar(16, 24, 4, 21);
}

function inRoundedSquare(x, y, size, radius) {
  const dx = Math.max(radius - x, x - (size - radius), 0);
  const dy = Math.max(radius - y, y - (size - radius), 0);
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * @param size    pixel dimension
 * @param inset   share of the icon left empty around the mark. Maskable icons
 *                get a wide margin because the launcher may crop to a circle.
 * @param rounded false for a full-bleed square, which is what maskable needs.
 */
function render(size, inset, rounded) {
  const pixels = Buffer.alloc(size * size * 4);
  const markScale = size * (1 - 2 * inset) / 32;
  const markOrigin = size * inset;
  const radius = size * 0.22;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let ground = 0;
      let mark = 0;

      // Supersample: the mark is all curves, and a hard-edged 192px icon looks
      // broken next to every other icon on the home screen.
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          if (!rounded || inRoundedSquare(x, y, size, radius)) ground++;
          if (inMark((x - markOrigin) / markScale, (y - markOrigin) / markScale)) mark++;
        }
      }

      const total = SS * SS;
      const alpha = ground / total;
      const paper = mark / total;
      const at = (py * size + px) * 4;

      for (let c = 0; c < 3; c++) {
        pixels[at + c] = Math.round(INK[c] * (1 - paper) + PAPER[c] * paper);
      }
      pixels[at + 3] = Math.round(255 * alpha);
    }
  }

  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // truecolour with alpha

  // Every scanline gets filter byte 0. The images are small and flat; a
  // cleverer filter would save bytes nobody is counting.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const ICONS = [
  { file: 'public/icon-192.png', size: 192, inset: 0, rounded: true },
  { file: 'public/icon-512.png', size: 512, inset: 0, rounded: true },
  // iOS applies its own mask and shows no transparency: full bleed, small inset.
  { file: 'public/apple-touch-icon.png', size: 180, inset: 0.08, rounded: false },
  // Android may crop to a circle: keep the mark inside the safe zone.
  { file: 'public/icon-maskable-512.png', size: 512, inset: 0.18, rounded: false },
];

for (const { file, size, inset, rounded } of ICONS) {
  writeFileSync(file, png(size, render(size, inset, rounded)));
  console.log(`${file}  ${size}x${size}`);
}
