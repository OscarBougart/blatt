# Blatt — epics

A record of the work, one epic per session. Epics 0–8 are described only by
their commits; this file starts where the written briefs start.

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

## EPIC 10 — not yet written

Referenced by 9.4: a leech, once suspended, gets "a proper fix" — rebuilding
the card from a different sentence. The brief for this epic has not been
supplied.
