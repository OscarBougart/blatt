import { Readability } from '@mozilla/readability';
import { locate } from '@app/lib/segment';
import { cleanBlocks, fallbackTitle } from './lib/blocks';
import { wordKey, type CapturedWord } from './lib/bundle';

/**
 * The part that runs inside the page: hand the article back to the popup, and
 * let a double-click save a word.
 *
 * Injected on demand via `activeTab` rather than declared for every site. A
 * content script on `<all_urls>` reads every page you open, and a capture tool
 * has no business doing that.
 */

interface Extracted {
  ok: true;
  title: string;
  url: string;
  paragraphs: string[];
  /** Text sampled for language detection. */
  sample: string;
}

interface Failed {
  ok: false;
  reason: 'no-article';
  /** The whole page, offered as the messy fallback. */
  paragraphs: string[];
  title: string;
  url: string;
  sample: string;
}

const BLOCKS = 'p, li, blockquote, h2, h3';

function blocksFrom(root: ParentNode): string[] {
  return [...root.querySelectorAll(BLOCKS)].map((el) => el.textContent ?? '');
}

/**
 * Pull the article out with Readability, the engine behind Firefox Reader Mode.
 *
 * Inline markup is discarded on purpose: translating a paragraph in fragments
 * so a link keeps its anchor gives each fragment no surrounding sentence, and
 * Blatt renders plain paragraphs anyway.
 */
function extract(): Extracted | Failed {
  const url = location.href;
  const pageTitle = document.title || fallbackTitle(url);

  // Readability mutates the document it is given, so it gets a copy.
  const article = new Readability(document.cloneNode(true) as Document).parse();

  if (article?.content) {
    const holder = document.createElement('div');
    holder.innerHTML = article.content;
    const paragraphs = cleanBlocks(blocksFrom(holder));

    if (paragraphs.length > 0) {
      return {
        ok: true,
        title: (article.title || pageTitle).trim(),
        url,
        paragraphs,
        sample: paragraphs.slice(0, 5).join(' ').slice(0, 1200),
      };
    }
  }

  const whole = cleanBlocks(blocksFrom(document.body));
  return {
    ok: false,
    reason: 'no-article',
    title: pageTitle,
    url,
    paragraphs: whole,
    sample: whole.slice(0, 5).join(' ').slice(0, 1200),
  };
}

/* -------------------------------------------------------------------------- */

const MARK_CLASS = 'blatt-saved-word';
const STORE = 'capturedWords';

/** Trim the punctuation a double-click drags in at either end. */
function bareWord(text: string): string {
  return text.trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
}

/** The block of prose a node sits in, for the sentence around a word. */
function blockOf(node: Node): HTMLElement | null {
  let el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
  while (el && !/^(P|LI|BLOCKQUOTE|H1|H2|H3|H4|TD|DD|DIV|ARTICLE|SECTION)$/.test(el.tagName)) {
    el = el.parentElement;
  }
  return el;
}

function markSelection(range: Range, key: string) {
  const mark = document.createElement('span');
  mark.className = MARK_CLASS;
  mark.dataset.blattKey = key;
  mark.title = 'Saved for Blatt — click to remove';
  // A 1px graphite rule under the baseline, the same mark the app draws.
  mark.style.cssText =
    'border-bottom:1px solid #6b6862;background:transparent;cursor:pointer';
  try {
    range.surroundContents(mark);
  } catch {
    // The selection crossed an element boundary. Not worth forcing.
  }
}

/** Take a mark back out, leaving the text exactly as it was found. */
function unwrap(mark: HTMLElement) {
  const parent = mark.parentNode;
  if (!parent) return;
  while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
  parent.removeChild(mark);
  // Rejoin the split text nodes, or the next offset measured here is wrong.
  (parent as Element).normalize?.();
}

async function readStore(): Promise<CapturedWord[]> {
  const stored = await chrome.storage.local.get(STORE);
  return (stored[STORE] as CapturedWord[]) ?? [];
}

/**
 * A range covering [start, end) of a block's text, counted across its text
 * nodes. Used to draw a mark back onto a word saved in an earlier visit.
 */
function rangeAt(block: HTMLElement, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let seen = 0;
  let opened = false;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (!opened && seen + length >= start) {
      range.setStart(node, start - seen);
      opened = true;
    }
    if (opened && seen + length >= end) {
      range.setEnd(node, end - seen);
      return range;
    }
    seen += length;
  }
  return null;
}

/**
 * Re-draw the marks for words already saved on this page.
 *
 * The marks live in the DOM and the records live in storage, so a reload
 * leaves the reader looking at a page with no sign of the work they did on
 * it — and clicking the same word again, which is what the dedupe in
 * saveSelection is for.
 */
async function restoreMarks() {
  const here = (await readStore()).filter((word) => word.url === location.href);
  if (here.length === 0) return;

  const blocks = [...document.querySelectorAll<HTMLElement>(BLOCKS)];

  for (const word of here) {
    const block = blocks.find((el) => (el.textContent ?? '').includes(word.sentence));
    if (!block) continue;

    const base = (block.textContent ?? '').indexOf(word.sentence);
    if (base < 0) continue;

    const start = base + word.charOffset;
    const range = rangeAt(block, start, start + word.surface.length);
    // Only if the text there is still the word that was saved: pages change.
    if (range && range.toString() === word.surface) markSelection(range, wordKey(word));
  }
}

async function saveSelection() {
  const selection = window.getSelection();
  const text = selection?.toString() ?? '';
  const surface = bareWord(text);
  if (!surface || /\s/.test(surface)) return;

  const range = selection?.getRangeAt(0);
  const block = range ? blockOf(range.startContainer) : null;
  const paragraph = block?.textContent ?? surface;

  // The offset of this occurrence within the block, so the saved sentence
  // marks the word that was actually clicked rather than the first one.
  const offset = Math.max(0, paragraph.indexOf(surface, Math.max(0, indexOfRange(range, block))));
  const { sentence, charOffset } = locate(paragraph, offset);

  const record: CapturedWord = {
    surface,
    // Lemmatised in the popup, where the cascade and the network live.
    lemma: '',
    definition: '',
    sentence,
    charOffset,
    url: location.href,
    title: document.title,
    createdAt: Date.now(),
  };

  const key = wordKey(record);
  const words = await readStore();
  // The same word in the same place is one word, however many times it is
  // double-clicked.
  if (!words.some((word) => wordKey(word) === key)) {
    await chrome.storage.local.set({ [STORE]: [...words, record] });
  }

  if (range) markSelection(range, key);
  selection?.removeAllRanges();
}

/** Undo a save: the mark comes off and the record goes with it. */
async function unsave(mark: HTMLElement) {
  const key = mark.dataset.blattKey;
  unwrap(mark);
  if (!key) return;

  const words = await readStore();
  await chrome.storage.local.set({ [STORE]: words.filter((word) => wordKey(word) !== key) });
}

/** Where the selection starts within its block, in characters. */
function indexOfRange(range: Range | undefined, block: HTMLElement | null): number {
  if (!range || !block) return 0;
  const before = range.cloneRange();
  before.selectNodeContents(block);
  before.setEnd(range.startContainer, range.startOffset);
  return before.toString().length;
}

/*
 * Click and double-click on the same text are the same first event, so a
 * click on a mark is held briefly and dropped if a double-click follows.
 * Without that, double-clicking a word that is already saved would unsave it
 * and save it again.
 */
let pendingUnsave: number | undefined;

function onClick(event: MouseEvent) {
  const mark = (event.target as HTMLElement | null)?.closest?.(`.${MARK_CLASS}`);
  if (!(mark instanceof HTMLElement)) return;

  window.clearTimeout(pendingUnsave);
  pendingUnsave = window.setTimeout(() => void unsave(mark), 250);
}

function onDoubleClick() {
  window.clearTimeout(pendingUnsave);
  void saveSelection();
}

/* -------------------------------------------------------------------------- */

// Guarded because the popup injects this every time it opens, and a second
// copy would save every word twice.
declare global {
  interface Window {
    __blattCaptureReady?: boolean;
  }
}

if (!window.__blattCaptureReady) {
  window.__blattCaptureReady = true;
  document.addEventListener('dblclick', onDoubleClick);
  document.addEventListener('click', onClick);
  void restoreMarks();
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === 'extract') respond(extract());
    return true;
  });
}
