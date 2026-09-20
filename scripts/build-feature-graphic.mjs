/**
 * Render the Play Store feature graphic (1024x500) from HTML, via headless
 * Chrome. Not part of any build: run it by hand when the copy or the palette
 * changes, then upload docs/play/feature-graphic.png to the Console.
 *
 * Chrome rather than an image library because the graphic is typography, and
 * the type is the argument. Newsreader is loaded from node_modules so the
 * render needs no network.
 *
 * Usage: node scripts/build-feature-graphic.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);

if (!CHROME) throw new Error('Chrome not found; edit CHROME in this script.');

// The mark, emitted by build-icons.mjs from the same constants as the app
// icons. Run `npm run icons` first if it is missing.
const mark = pathToFileURL(path.resolve('docs/play/mark.svg')).href;

const font = pathToFileURL(
  path.resolve('node_modules/@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2'),
).href;

// The flip, shown as the one thing a still image can show of it: the same
// sentence twice, ink then graphite. Side by side on a store page is not the
// reading view — nothing here is the app's screen, and the rule that keeps
// them apart governs the reader, not the poster.
const html = `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Newsreader';
    src: url('${font}') format('woff2');
    font-weight: 200 800;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1024px; height: 500px; }
  body {
    background: #FAF8F4;
    font-family: 'Newsreader', serif;
    color: #141210;
    display: flex;
    align-items: center;
    padding: 0 76px;
    -webkit-font-smoothing: antialiased;
  }
  /* The composition is centred as one block; the two columns inside it hang
     from a shared first baseline, so the wordmark and the German start on the
     same line rather than each floating in its own half. */
  .sheet {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: baseline;
    gap: 56px;
    width: 100%;
  }
  /* The mark floats inside its own viewBox, so it is pulled left by that
     inset (plus the B's side bearing) to sit flush with the wordmark. */
  .leaf { width: 104px; height: 104px; display: block; margin: 0 0 22px -30px; }
  .mark { font-size: 86px; letter-spacing: -0.02em; line-height: 1; }
  .rule { width: 56px; height: 1px; background: #E3DFD7; margin: 30px 0; }
  .tag {
    font-size: 25px; line-height: 1.45; letter-spacing: -0.006em;
    color: #6B6862; max-width: 20ch;
  }
  .lines { font-size: 25px; line-height: 1.65; letter-spacing: -0.006em; }
  .de { color: #141210; }
  .en { color: #6B6862; margin-top: 26px; }
</style>
<body>
  <div class="sheet">
  <div>
    <img class="leaf" src="${mark}" alt="">
    <div class="mark">Blatt</div>
    <div class="rule"></div>
    <div class="tag">Read German. Peek at English only when you mean to.</div>
  </div>
  <div class="lines">
    <div class="de" lang="de">Es war einmal ein kleines M&auml;dchen, das hatte
      alle lieb, die es nur ansahen.</div>
    <div class="en">There was once a little girl who was loved by everyone who
      looked at her.</div>
  </div>
  </div>
</body>`;

const dir = mkdtempSync(path.join(tmpdir(), 'blatt-fg-'));
const page = path.join(dir, 'feature.html');
writeFileSync(page, html);

execFileSync(CHROME, [
  '--headless',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--window-size=1024,500',
  '--default-background-color=FAF8F4',
  `--screenshot=${path.join(dir, 'out.png')}`,
  pathToFileURL(page).href,
], { stdio: 'ignore' });

copyFileSync(path.join(dir, 'out.png'), 'docs/play/feature-graphic.png');
console.log('docs/play/feature-graphic.png  1024x500');
