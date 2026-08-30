# Blatt — epics

A record of the work, one epic per session. This file starts where the written
briefs start.

Epics 0–5 have no brief here and are described only by their commits. There is
no Epic 8: the briefs went from 7 to 9, and nothing in the repository or its
history refers to one.

---

## EPIC 9 — Review log, familiarity, sustainable pace

Revisions arising from research into how Anki is actually used for language
learning. Three gaps that only show up after weeks of real use. None are
visible today; all are expensive to retrofit later.

Prerequisite: export a backup via the Epic 7 JSON export, and verify it
restores into a fresh profile, before touching the schema.

### 9.1 — Dexie migration

Bump the schema version and write migration functions. Do not drop and
recreate. Existing `SavedWord` records must survive with their SM-2 state
intact.

New table:

```ts
interface ReviewLog {
  id: string;
  wordId: string;
  reviewedAt: number;       // epoch ms
  grade: 1 | 2 | 3 | 4;     // Again / Hard / Good / Easy
  intervalBefore: number;   // days, as scheduled when the card was shown
  easeBefore: number;
  elapsedDays: number;      // actual days since last review, may differ
  durationMs: number;       // time from card shown to grade pressed
}
```

Write one row on every grade press, without exception. This log is the reason
the epic exists.

Two things depend on it. First, FSRS — the algorithm that replaced SM-2 as
Anki's default — trains on review history, so if Blatt ever migrates
schedulers this log is the difference between keeping years of data and
starting over. Second, leech detection below. Neither works retroactively.

Also add to `SavedWord`:

```ts
  suspended?: boolean;
  leechFlaggedAt?: number;
  introducedAt?: number;    // when the card first entered review, not when saved
```

Backfill `introducedAt` from `createdAt` for existing records.

### 9.2 — Familiarity model

`src/lib/familiarity.ts`. Pure, tested. This underpins Epic 10, so build it
carefully and expose it as a clean function:

```ts
isFamiliar(lemma: string): boolean
```

A lemma is familiar if either:

1. It has a `SavedWord` with `repetitions >= 2` and no lapse in the last 30
   days.
2. It has appeared in at least 3 paragraphs that met the 1.5s dwell threshold
   and has never been saved. The reasoning: if you read past a word three times
   without tapping it, you know it.

The second rule needs a new lightweight table recording lemma sightings:

```ts
interface Sighting {
  lemma: string;            // primary key
  count: number;
  lastSeenAt: number;
}
```

Increment on the same dwell event that already drives `paragraphsViewed`. Do it
in a single batched write per paragraph, not per word — this fires constantly
while reading and must not touch the render path.

Backfill from existing documents on migration: for every document, count each
lemma once. Rough, but better than starting at zero.

### 9.3 — New-card limit

Blatt removed the friction from saving words, which means it has removed the
natural brake that keeps Anki users from over-carding. Community consensus is
that people quit when the review pile grows unmanageable, and the standard
advice is a hard limit of 5–10 new cards per day. Blatt needs this more than
Anki does, not less — you can save eighty words in one evening and drown a
fortnight later.

- Setting, default 8 new cards per day. Range 3–20.
- Saved words wait in a queue until introduced. A word is not a card until its
  `introducedAt` is set.
- The review session composes: all due cards, then up to the daily limit of new
  ones, total capped at 20 as before.
- Queue depth is visible in settings as a plain number. Not a warning, not a
  badge, not red. If 400 words are waiting, that is information, not a failure.

### 9.4 — Leech detection

The received wisdom on repeatedly-failed cards is that the card is the problem,
not the memory — the sentence is too complex or the context too ambiguous — and
that the fix is to suspend it and rebuild it from a different sentence.

- Flag a word as a leech at 6 lapses. Set `leechFlaggedAt`.
- On flagging, suspend it and surface it in the word list under the existing
  "needs attention" filter.
- Do not brute-force it back into the queue. Epic 10 gives it a proper fix.

### 9.5 — Stats additions

The stats screen keeps its rule: flip rate is the only headline number and the
only place `signal` appears. But the review log now permits two honest
diagnostics, shown small and in graphite:

- Reviews per day over the last 30 days, so you can see the pile coming.
- Median grading time. If it climbs, cards are getting too hard.

No streaks, no retention percentage, no heatmap.

---

## EPIC 10 — Card redesign

The current card is a cloze: sentence with the word blanked. Research says that
is the wrong default for a reading-focused learner, and that Blatt can build a
better card than Anki can because it owns the corpus.

### 10.1 — Default card is recognition, not production

The standard sentence-mining card is the sentence in the target language with
the target word marked, and the back giving the word's meaning in context plus
a full translation for confirmation. Recognition should carry the bulk of
vocabulary, since it lets you consume more content, with production reserved
for high-frequency words you intend to speak. Blatt is a reading app.

Front: the source sentence in ink, left-aligned, with the target word in ink
and everything else at 85% opacity — emphasis by the rest receding, not by bold
or colour.

Back: the target word and its lemma, the definition, and the aligned English
paragraph in graphite. Confirmation for free.

Left alignment matters; centred multiline text is a known complaint about
Anki's default card. A 100ms fade-in on the front stops the next card arriving
as a jolt.

### 10.2 — Cloze becomes a promotion, not the default

Keep the cloze card as an opt-in per word, via a "drill this actively" control
in the word list and on the card back. Store `cardMode` on `SavedWord` and
migrate every existing word to `'recognition'`.

A cloze card keeps the English gloss in graphite beneath the blanked sentence:
a German sentence with a gap and no cue is often genuinely unanswerable.

### 10.3 — i+1 sentence selection

A good card has exactly one unknown word. Anki users judge this by eye; Blatt
can compute it. `src/lib/sentencePick.ts` scores a sentence as the count of
lemmas that are neither the target nor familiar, with a mild penalty outside
6–18 words. Occurrences are scanned on demand and not indexed persistently.

At save time the sentence the word was tapped in remains the default — it is
the one you actually met — but its score is recorded.

### 10.4 — Reroll: the feature Anki cannot have

"Another sentence" searches the corpus for other sentences containing the lemma,
ranks them by i+1 score, and swaps the card to the best. The English side comes
along because it is already aligned. This is the proper fix for a leech, and is
surfaced directly on any suspended one. If no better sentence exists, say so
plainly and offer to keep it or delete the word.

### 10.5 — Portfolio note

Blatt is a sentence-mining tool where the mining is free. The friction of
building cards by hand is why most people abandon the method, and reroll and
i+1 scoring are only possible because the reader and the review system share
one corpus.

---

## EPIC 8 (revised) — Chrome capture extension

Replaces the original Epic 8 (EPUB/PDF import with Gale–Church alignment),
which is cancelled: translating block by block produces correct paragraph pairs
by construction, so the alignment problem never arises.

Built as `extension/`, a separate package in the same repository, importing the
app's lemma engine rather than copying it.

- **8.1** Translation through Chrome's built-in Translator API, locally, with
  no key and no backend. Chrome 138+, desktop only — the API does not exist on
  mobile.
- **8.2** Article extraction with Mozilla's Readability. Inline markup is
  discarded; blocks under ~40 characters and repeated blocks are dropped as
  furniture. Source language is detected before anything is translated.
- **8.3** Each paragraph translated individually and stored at the same index.
  Never batched: the model may merge or split, and the index correspondence is
  the product.
- **8.4** The shared lemma cascade builds the `lemmaMap`; definitions are
  prefetched four at a time, so the document is readable offline on arrival.
- **8.5** Handoff is a JSON file in exactly the Epic 7 export format, imported
  through the existing path. Different origins cannot share an IndexedDB; the
  proper fix is an offscreen document, not a backend, and not yet.
- **8.6** Double-click a word to save it, marked with the same graphite rule.
  Saved words ride along in the same file.
- **8.7** One icon, one popup: detected language, paragraph count, a button,
  progress. No options page.
- **8.8** Failure states named plainly: no Translator API, model downloading,
  no article found, page not German.

### What the API actually requires

`Translator.create()` throws `NotAllowedError` when the language pack still
has to be downloaded and there is no user gesture behind the call — and the
gesture is spent by the first `await`. The popup therefore requests the
translator as the very first statement of the click handler, before awaiting
anything. Asking for it later works on a machine that already has the pack and
fails on every machine that does not, which is the worst way for a bug to
behave.
