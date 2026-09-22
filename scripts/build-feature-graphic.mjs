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

// The whole product, read downwards: the German, the same sentence flipped to
// graphite, and then the word that was tapped, come back as a card with the
// sentence around it. Three beats of one sentence rather than three features.
//
// Side by side on a store page is not the reading view — nothing here is the
// app's screen, and the rule that keeps the languages apart governs the
// reader, not the poster.
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
  /* The two columns are centred against each other rather than hung from a
     shared first baseline. With three beats the right column outgrew the left,
     and a shared baseline then pushed its last line off the bottom of the
     frame: the alignment has to give way to the content, not the other way. */
  .sheet {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
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
  .lines { font-size: 22px; line-height: 1.6; letter-spacing: -0.006em; }
  .de { color: #141210; }
  .en { color: #6B6862; }
  /* The same hairline that separates the wordmark from its tagline, doing the
     same job here: these are beats of one sentence, not three panels. */
  .hair { width: 56px; height: 1px; background: #E3DFD7; margin: 20px 0; }
  /* The card. The blank is the app's own cloze: the word is taken out of the
     sentence it was met in, which is the only place it means anything. */
  .blank {
    display: inline-block; width: 124px;
    border-bottom: 1px solid #141210; margin-bottom: 3px;
  }
  .answer { color: #6B6862; margin-top: 8px; }
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
    <div class="hair"></div>
    <div class="en">There was once a little girl who was loved by everyone who
      looked at her.</div>
    <div class="hair"></div>
    <div class="de" lang="de">&hellip; die es nur <span class="blank"></span></div>
    <div class="answer">ansehen &middot; to look at</div>
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
