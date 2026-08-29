# Project: Blatt

## What this is
A local-first progressive web app for reading German texts with a hidden English
translation, plus built-in SRS flashcards. Single user (B2 German learner),
mobile-first, one-handed phone use. Also a public portfolio piece.

The name is the German for a sheet or leaf of paper. *Blättern* — to leaf
through — is the interaction the whole app is built around.

## The governing rule
German is the default. English costs a deliberate gesture. The user must never
be able to drift into reading English by accident. German and English are NEVER
on screen at the same time.

Every design decision defers to this rule. If a feature makes English easier to
reach, it is wrong, even if it is more convenient.

## Stack (do not add to this without asking)
- React 18 + TypeScript + Vite
- Tailwind CSS
- Dexie (IndexedDB) — all persistence
- vite-plugin-pwa — service worker + manifest
- React Context for state. No Redux, Zustand, Jotai, or similar.
- No backend. No accounts. No network calls except the dictionary API.

## Code principles
- Readable over clever. The user must be able to read this codebase in a year.
- Pure functions for anything testable: lemmatizer, aligner, SM-2 scheduler.
  These three contain no React and are unit tested.
- No premature abstraction. Ship, then earn complexity.
- Every file under 300 lines. If it grows past that, it is doing two jobs.
- Stop at the end of each epic. Do not continue into the next one.

## Key architectural decision: lemmatize at import, not at tap
Every document is fully lemmatized once, when it is imported. The resulting
surface→lemma map is stored alongside the document. Tapping a word is then a
map lookup, not a morphological analysis.

This means the lemma dataset is an import-time dependency only. It is never
loaded during reading and never part of the initial bundle. Expected corpus is
short stories and articles — a few hundred to a couple of thousand unique tokens
per document — so the import pass takes seconds.

## Data model (Dexie)

```ts
interface Doc {
  id: string;
  title: string;
  theme: string;                            // free-text tag
  pairs: { de: string; en: string }[];
  lemmaMap: Record<string, LemmaCandidate[]>;  // populated at import (Epic 3)
  lastParagraphIndex: number;
  createdAt: number;
}

interface LemmaCandidate {
  lemma: string;
  confidence: number;                       // 0–1
  method: 'exact' | 'wiktionary' | 'suffix' | 'separable' | 'table' | 'manual';
}

interface SavedWord {
  id: string;
  surface: string;            // as it appeared in the text
  lemma: string;
  definition: string;         // empty until the lookup resolves
  note?: string;              // user's own definition, used when lookup failed
  sentence: string;           // full source sentence
  charOffset: number;         // offset of the tapped occurrence within `sentence`
  docId: string;
  paragraphIndex: number;
  lookupFailed?: boolean;     // retry once when connectivity returns
  createdAt: number;
  // SM-2
  ease: number;               // starts 2.5
  interval: number;           // days
  repetitions: number;
  dueAt: number;              // epoch ms
  lapses: number;
}

interface DictEntry {         // permanent lookup cache, never evicted
  lemma: string;              // primary key
  definitions: string[];
  fetchedAt: number;
  source: 'wiktionary' | 'manual';
}

interface Session {
  id: string;
  docId: string;
  startedAt: number;
  endedAt?: number;
  paragraphsViewed: number;   // German paragraphs that met the dwell threshold
  paragraphsFlipped: number;  // unique paragraph indices read in English
}
```

## Design: ink and graphite

Two layers, nothing else. German is ink — printed, full contrast. English is
graphite — the same voice written fainter, like a pencil gloss in a margin.

Type: **Newsreader** throughout. Contemporary bookish, not a facsimile of an old
book. German 19px / line-height 1.65 / letter-spacing -0.006em. English in the
reader takes exactly the same metrics, so the flip changes the voice and not
the shape of the column — only the colour separates them. English elsewhere in
the app is chrome, not prose: 17px / line-height 1.55 / letter-spacing 0.01em.

```
paper       #FAF8F4
ink         #141210
graphite    #6B6862
rule        #E3DFD7
lamp        #1A1714    (dark ground)
lamp-ink    #EDE9E1
lamp-gph    #8B857B
signal      #B0472C    (flip rate only — the one coloured thing in the app)
```

No paper grain, no noise, no shadows, no gradients. The restraint is the
aesthetic. `signal` appears exactly once in the entire product.

German needs `lang="de"` and `hyphens: auto`, or long compounds tear rivers of
whitespace through a phone-width column.

## Reading view
- Contains text and nothing else. No toolbars, no progress bar, no chrome of any
  kind while reading.
- Dark mode is warm (`lamp`), never pure black.
- Font size control in settings: 16 / 19 / 22px. Needed because
  `touch-action: manipulation` disables pinch-zoom on the reading view.

## Non-goals (do not build these)
- Streaks, XP, badges, levels, achievements, any gamification.
  One honest statistic only: flip rate.
- Cloud sync, sharing, social features, user accounts.
- Text-to-speech.
- Grammar explanations or conjugation tables.