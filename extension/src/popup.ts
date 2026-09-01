import './popup.css';
import { analyse, resolveWords } from './lib/capture';
import { buildBundle, bundleFilename, type CapturedWord } from './lib/bundle';
import { fallbackTitle } from './lib/blocks';
import {
  detectLanguage,
  hasTranslator,
  startTranslator,
  translateEach,
  translatorAvailability,
} from './lib/translate';

/**
 * The whole interface: what was found, and a button. No options, no settings —
 * this captures, and the reading happens in Blatt on the phone.
 */

const root = document.getElementById('root')!;
const STORE = 'capturedWords';

interface Article {
  ok: boolean;
  title: string;
  url: string;
  paragraphs: string[];
  sample: string;
}

let article: Article | null = null;
let language: string | null = null;
let busy = false;
let savedHere = 0;

function el(html: string): HTMLElement {
  const holder = document.createElement('div');
  holder.innerHTML = html.trim();
  return holder.firstElementChild as HTMLElement;
}

function say(status: string, progress?: number) {
  const line = root.querySelector('#status');
  if (line) line.textContent = status;
  const bar = root.querySelector<HTMLElement>('#bar > span');
  if (bar) bar.style.width = `${Math.round((progress ?? 0) * 100)}%`;
}

/** The active tab, and the content script inside it. */
async function inject(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith('http')) return null;

  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  return tab.id;
}

async function readPage(tabId: number): Promise<Article | null> {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'extract' });
  } catch {
    return null;
  }
}

/** How many words are already banked on this page. */
async function countSaved(url: string): Promise<number> {
  const stored = await chrome.storage.local.get(STORE);
  return ((stored[STORE] as CapturedWord[]) ?? []).filter((word) => word.url === url).length;
}

function render() {
  const paragraphs = article?.paragraphs.length ?? 0;
  const wrongLanguage = language !== null && language !== 'de';

  const nodes = [
    el(`<h1>${article ? escapeHtml(article.title) : 'Blatt Capture'}</h1>`),
    el(`<p class="muted">${
      article
        ? `${paragraphs} paragraph${paragraphs === 1 ? '' : 's'}${
            language ? ` · detected ${language}` : ''
          }`
        : 'Open a German article and press the icon again.'
    }</p>`),
  ];

  // The gesture is only worth naming on a page that can actually be captured;
  // anywhere else it is an instruction for something the reader cannot do.
  if (paragraphs > 0 && !wrongLanguage) {
    nodes.push(
      el(`<p class="muted gesture">${
        savedHere === 0
          ? 'Double-click a word in the page to save it.'
          : `${savedHere} word${savedHere === 1 ? '' : 's'} saved here · click one in the page to remove it.`
      }</p>`),
    );
  }

  nodes.push(
    el('<div class="bar" id="bar"><span style="width:0"></span></div>'),
    el('<p class="muted problem" id="status"></p>'),
  );
  root.replaceChildren(...nodes);

  if (!article || paragraphs === 0) {
    say('Nothing readable on this page.');
    return;
  }

  if (!hasTranslator()) {
    say(
      'This needs Chrome 138 or later on desktop — the built-in translator does not exist here.',
    );
    return;
  }

  if (wrongLanguage) {
    say(`This page looks like ${language}, not German. Nothing to capture.`);
    return;
  }

  if (!article.ok) {
    say('No article found. Capturing the whole page instead, which will be untidy.');
  }

  if (article.ok) say('');

  const button = el('<button class="primary">Capture for Blatt</button>') as HTMLButtonElement;
  // Not `await`ed anywhere before the translator is requested — see capture().
  button.addEventListener('click', () => void capture(button));
  root.append(button);
}

function escapeHtml(text: string): string {
  return text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!);
}

/**
 * The capture itself.
 *
 * The translator is requested as the very first statement, before any `await`:
 * Chrome will not start a model download without a user gesture behind it, and
 * the gesture is spent the moment this function suspends. See startTranslator.
 */
async function capture(button: HTMLButtonElement) {
  if (busy || !article) return;
  busy = true;
  button.disabled = true;

  const pending = startTranslator((fraction) =>
    say(`Downloading the German language pack…`, fraction),
  );

  try {
    const translator = await pending;

    const german = article.paragraphs;
    say('Translating…', 0);
    const english = await translateEach(translator, german, (done, total) =>
      say(`Translating paragraph ${done} of ${total}…`, (done / total) * 0.5),
    );

    const { lemmaMap, definitions } = await analyse(german, ({ phase, done, total }) => {
      const share = phase === 'lemmas' ? 0.5 + (done / total) * 0.3 : 0.8 + (done / total) * 0.2;
      say(phase === 'lemmas' ? `Reading words ${done} of ${total}…` : `Definitions ${done} of ${total}…`, share);
    });

    const stored = await chrome.storage.local.get(STORE);
    const saved = ((stored[STORE] as CapturedWord[]) ?? []).filter(
      (word) => word.url === article!.url,
    );
    const words = await resolveWords(saved, lemmaMap, definitions);

    const now = Date.now();
    const bundle = buildBundle({
      title: article.title || fallbackTitle(article.url),
      theme: new URL(article.url).hostname.replace(/^www\./, ''),
      pairs: german.map((de, i) => ({ de, en: english[i] ?? '' })),
      lemmaMap,
      definitions,
      words,
      now,
    });

    const url = URL.createObjectURL(
      new Blob([JSON.stringify(bundle)], { type: 'application/json' }),
    );
    await chrome.downloads.download({ url, filename: bundleFilename(bundle.docs[0].title, now) });
    URL.revokeObjectURL(url);

    // Saved words leave with the file, so they cannot arrive twice.
    const remaining = ((stored[STORE] as CapturedWord[]) ?? []).filter(
      (word) => word.url !== article!.url,
    );
    await chrome.storage.local.set({ [STORE]: remaining });

    say(
      `Saved. ${german.length} paragraphs, ${definitions.length} definitions${
        words.length ? `, ${words.length} words` : ''
      }. Import it in Blatt.`,
      1,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    say(
      /NotAllowedError/.test(message)
        ? 'Chrome would not start the download without a click. Press the button again.'
        : `Capture failed: ${message}`,
    );
    button.disabled = false;
  } finally {
    busy = false;
  }
}

async function main() {
  render();
  say('Reading the page…');

  const tabId = await inject();
  if (tabId === null) {
    say('This page cannot be captured.');
    return;
  }

  article = await readPage(tabId);
  if (article) {
    savedHere = await countSaved(article.url);
    language = await detectLanguage(article.sample);
    if (hasTranslator() && (await translatorAvailability()) === 'unavailable') {
      render();
      say('Chrome cannot translate German to English on this machine.');
      return;
    }
  }
  render();
}

void main();
