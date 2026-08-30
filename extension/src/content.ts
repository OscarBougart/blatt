import { Readability } from '@mozilla/readability';
import { locate } from '@app/lib/segment';
import { cleanBlocks, fallbackTitle } from './lib/blocks';

/**
 * The part that runs inside the page.
 *
 * Two jobs: hand the article back to the popup, and let a double-click save a
 * word. Injected on demand with `activeTab` rather than declared for every
 * site — a capture tool has no business reading every page you open, and a
 * content script on `<all_urls>` is exactly that.
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
 * Pull the article out with Readability — the engine behind Firefox Reader
 * Mode, and a solved problem not worth re-solving with heuristics.
 *
 * Inline markup is discarded on purpose. Translating a paragraph in fragments
 * so that a link keeps its anchor produces worse German-to-English output,
 * because each fragment arrives without the sentence around it, and Blatt
 * renders plain paragraphs anyway.
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

function markSelection(range: Range) {
  const mark = document.createElement('span');
  mark.className = MARK_CLASS;
  // A 1px graphite rule under the baseline, the same mark the app draws.
  mark.style.cssText =
    'border-bottom:1px solid #6b6862;background:transparent;cursor:pointer';
  try {
    range.surroundContents(mark);
  } catch {
    // The selection crossed an element boundary. Not worth forcing.
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

  const record = {
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

  const stored = await chrome.storage.local.get(STORE);
  const words = (stored[STORE] as unknown[]) ?? [];
  await chrome.storage.local.set({ [STORE]: [...words, record] });

  if (range) markSelection(range);
  selection?.removeAllRanges();
}

/** Where the selection starts within its block, in characters. */
function indexOfRange(range: Range | undefined, block: HTMLElement | null): number {
  if (!range || !block) return 0;
  const before = range.cloneRange();
  before.selectNodeContents(block);
  before.setEnd(range.startContainer, range.startOffset);
  return before.toString().length;
}

function onDoubleClick() {
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
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === 'extract') respond(extract());
    return true;
  });
}
