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

/**
 * The mark: a leaf whose blade is ruled with lines of text too small to read.
 * Blatt is the German for both a leaf and a sheet of paper, and the mark is
 * the only place the app makes that joke.
 *
 * Geometry, all in a 32-unit box:
 * the blade is a vesica — the overlap of two circles of equal radius whose
 * centres sit either side of the midline. Half-width 6.4 over a half-height
 * of 13 gives a lance shape; much wider and it reads as an egg.
 */
const HW = 6.4;
const HH = 13;
const CX = (HH * HH - HW * HW) / (2 * HW);
const R = CX + HW;

/** Degrees. The leaf hangs off vertical so it does not read as a pod. */
const TILT = -18;

/** Ruled lines of "text": thickness, pitch, and where the first one starts. */
const LINE = 0.85;
const PITCH = 2.15;
const FIRST = 6.2;

/** Ragged right edge. Nothing here should resolve into a word. */
const LENGTHS = [0.55, 0.92, 0.78, 1.0, 0.86, 0.97, 0.71, 0.94, 0.83, 0.48];

/** Share of the box the mark leaves empty around itself. At 1 the tip and
 *  the stem touch the edge and the icon feels stuffed. */
const SCALE = 0.88;

/** Into the leaf's own upright frame, undoing the tilt and the scale. */
function unrotate(x, y) {
  const a = (-TILT * Math.PI) / 180;
  const dx = (x - 16) / SCALE;
  const dy = (y - 16) / SCALE;
  return [16 + dx * Math.cos(a) - dy * Math.sin(a), 16 + dx * Math.sin(a) + dy * Math.cos(a)];
}

function inBlade(x, y) {
  return (
    (x - (16 + CX)) ** 2 + (y - 16) ** 2 <= R * R &&
    (x - (16 - CX)) ** 2 + (y - 16) ** 2 <= R * R
  );
}

/** Half the blade's width at a given height, less the margin the text keeps. */
function textHalf(y) {
  return Math.sqrt(Math.max(0, R * R - (y - 16) ** 2)) - CX - 1;
}

function inText(x, y) {
  const index = Math.floor((y - FIRST) / PITCH);
  if (index < 0 || index >= LENGTHS.length) return false;
  if (y - FIRST - index * PITCH > LINE) return false;

  const half = textHalf(FIRST + index * PITCH + LINE / 2);
  // Where the blade has narrowed to nothing there is no room for a line, and
  // a two-pixel dash by the stem looks like dirt rather than type.
  if (half <= 0.6) return false;

  return x >= 16 - half && x <= 16 - half + half * 2 * LENGTHS[index];
}

function inStem(x, y) {
  // Tapered: a stalk, not the nub a constant width gives.
  const t = (y - HH - 16) / 2.6;
  return Math.abs(x - 16) <= 0.62 - 0.26 * t && y >= 16 + HH - 0.3 && y <= 16 + HH + 2.6;
}

/** The mark, in the colour of paper: blade and stem, less the lines. */
function inMark(x, y) {
  const [a, b] = unrotate(x, y);
  return (inBlade(a, b) && !inText(a, b)) || inStem(a, b);
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
  // The Play Store listing icon. Not served by the app: it is uploaded to the
  // Console by hand. Play masks and rounds the icon itself, so this one is a
  // full-bleed opaque square — baking in corners would round them twice, and
  // Play rejects an icon whose corners are transparent.
  { file: 'docs/play/icon-play-512.png', size: 512, inset: 0.08, rounded: false },
];

for (const { file, size, inset, rounded } of ICONS) {
  writeFileSync(file, png(size, render(size, inset, rounded)));
  console.log(`${file}  ${size}x${size}`);
}

/**
 * The favicon, from the same constants. Emitted here rather than kept by hand
 * so the vector and the rasters cannot drift apart: the mark is defined once,
 * above, and this is a second rendering of it.
 */
function svg({ ground = true, blade = PAPER, lines = INK } = {}) {
  const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  const n = (v) => Number(v.toFixed(3));

  const bladePath =
    `M16,${n(16 - HH)} A${n(R)},${n(R)} 0 0,1 16,${n(16 + HH)}` +
    ` A${n(R)},${n(R)} 0 0,1 16,${n(16 - HH)} Z`;

  const rules = LENGTHS.map((length, index) => {
    const top = FIRST + index * PITCH;
    const half = textHalf(top + LINE / 2);
    if (half <= 0.6) return '';
    return `<rect x="${n(16 - half)}" y="${n(top)}" width="${n(half * 2 * length)}" height="${LINE}"/>`;
  }).join('');

  // The stem, as the taper inStem() describes.
  const y0 = 16 + HH - 0.3;
  const y1 = 16 + HH + 2.6;
  const w0 = 0.62 + 0.26 * 0.3 / 2.6;
  const w1 = 0.62 - 0.26;
  const stem =
    `<path d="M${n(16 - w0)},${n(y0)} L${n(16 + w0)},${n(y0)}` +
    ` L${n(16 + w1)},${n(y1)} L${n(16 - w1)},${n(y1)} Z" fill="${hex(blade)}"/>`;

  const transform = `translate(16,16) scale(${SCALE}) rotate(${TILT}) translate(-16,-16)`;

  const tile = ground ? `
  <rect width="32" height="32" rx="7.04" fill="${hex(INK)}"/>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${tile}
  <g transform="${transform}">
    ${stem}
    <path d="${bladePath}" fill="${hex(blade)}"/>
    <g fill="${hex(lines)}">${rules}</g>
  </g>
</svg>
`;
}

writeFileSync('public/favicon.svg', svg());
console.log('public/favicon.svg  vector');

// The bare mark on no ground, ink on nothing: what the feature graphic sets
// against paper. Same constants, so it cannot drift from the icons.
writeFileSync('docs/play/mark.svg', svg({ ground: false, blade: INK, lines: PAPER }));
console.log('docs/play/mark.svg  vector');
