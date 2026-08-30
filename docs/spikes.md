# Epic 0 — Spike findings

Run 2026-08-26. Reproduce with the scripts in `spike/`.

Two assumptions were load-bearing and unverified: that a keyless German→English
dictionary is reachable from the browser, and that lemmatisation needs a bundled
offline dataset. Both were tested against the live network before any product
code was written.

---

## Spike A — Dictionary source

**Endpoint tested:** `https://en.wiktionary.org/api/rest_v1/page/definition/{word}`

### (a) CORS

Confirmed. Response headers for a request carrying `Origin: http://localhost:5173`:

```
HTTP/1.1 200 OK
access-control-allow-origin: *
access-control-allow-methods: GET,HEAD
content-type: application/json; charset=utf-8;
              profile="https://www.mediawiki.org/wiki/Specs/definition/0.8.1"
```

A wildcard ACAO on a `GET` endpoint. No key, no proxy, no server. A static page
on localhost can call this directly.

`User-Agent` and `Api-User-Agent` are both sent, identifying the app and a
contact address, per Wikimedia API etiquette.

### (b) German entries present

Yes. The response is an object keyed by language code; German is `de`. Every one
of the 40 forms in the Spike B sample returned a `de` key.

### (c) Response shape

```ts
{ [langCode: string]: Array<{
    partOfSpeech: string;                 // "Noun" | "Verb" | "Adjective" | …
    language: string;                     // "German"
    definitions: Array<{
      definition: string;                 // HTML
      parsedExamples?: { example: string }[];
    }>;
  }> }
```

| Probe | Shape observed |
|---|---|
| **Noun** `Haus` | 2 blocks — `Noun` (3 definitions, first: "house, building") and `Proper noun` (1). Multiple part-of-speech blocks per word are normal and must be handled. |
| **Verb** `laufen` | 1 block, `Verb`, 7 definitions. First: "to walk; to jog; to run (…)". |
| **Separable-prefix verb** `aufstehen` | 1 block, `Verb`, 4 definitions. First: "to get up (…)". The infinitive resolves normally — separability is not a problem at the *lemma* level. |

`definition` is HTML, not plain text. It must be stripped before display and
never injected as markup.

**Separable prefixes remain a real problem elsewhere.** `aufstehen` looks up
fine, but in running prose the sentence reads *"er steht früh **auf**"* — the
prefix is stranded at the end of the clause. Reuniting `steht … auf` into
`aufstehen` is a job for the tokeniser, not the dictionary, and this spike does
not solve it. See *Open risks*.

**Verdict: adopt.** FreeDict `deu-eng` (517,534 headwords, ~18–44 MB per
release) was not needed and is not bundled.

---

## Spike B — Lemma data

The question asked first: **is an offline dataset needed at all?**

Wiktionary has pages for inflected German forms, and a "form of" gloss wraps its
lemma in `<span class="form-of-definition-link">` containing
`<a href="/wiki/LEMMA#German">`. Glossary links
(`/wiki/Appendix:Glossary#dative`) are grammatical labels and must be discarded.

### Sample 1 — 40 hand-picked inflected forms

Verbs (finite and participle), nouns in all four cases, umlaut plurals,
adjective endings, high-frequency pronouns.

```
n=40   German entry: 40 (100%)   lemma pointer: 40 (100%)   correct: 40 (100%)
```

Including the awkward ones: `Wäre → sein`, `besser → gut`, `höchsten → hoch`,
`ihnen → sie`, `Häusern → Haus`, `mitgenommen → mitnehmen`.

An earlier run of this same sample scored 68%. That was a bug in the spike's own
parser — the `href` regex broke on the `#German` fragment — not a gap in the
data. Recorded because the failure looked exactly like a data problem.

### Sample 2 — 150 unseen tokens from real prose

Sample 1 was hand-written and therefore favourable. Sample 2 draws every
distinct token of 3+ characters from the German Wikipedia article
*Die Verwandlung*, chosen by nobody.

```
distinct tokens tested: 150
German entry exists:    132/150 (88%)
  inflected, lemma pointer returned:  71
  already a lemma, no pointer needed: 61
no German entry:         18/150 (12%)
```

Of those 18 misses, 6 were recovered by retrying with the initial letter
lowercased — `Die → der`, `Wäre → sein`, `Mit → mit`, `Von → von`,
`Der → der`, `Zunächst → zunächst`. These are sentence-initial function words;
Wiktionary titles are case-sensitive and German capitalises nouns, so the
pipeline must try the exact surface form **first**, then a lowercased retry.

**Effective coverage: 138/150 = 92%.**

The residual 12 fall into two honest classes:

- **Proper nouns** — `Samsa`, `Schickele`. Not dictionary words. Correct to miss.
- **Rare compounds and participles** — `Druckseiten`, `Familienernährer`,
  `Erstausgabe`, `Buchform`, `Romanfragmente`, `Oktoberheft`, `rezipiert`,
  `ungeheueren`, `auszehrende`, `bankrottgegangenen`.

Compounds are precisely where Wiktionary is thin, and German generates them
without limit. This is a permanent ceiling, not a bug to fix. The data model
already has the escape hatch: `SavedWord.note` for the user's own gloss, and
`lookupFailed` to mark the entry for retry.

### Decision

**No offline lemma dataset is bundled.** 92% on unseen prose does not justify
shipping a dataset, and the misses are dominated by compounds that no general
lemma list would resolve either.

The candidates were priced anyway, so the fallback is costed rather than
guessed:

| Candidate | Size | Licence | Verdict |
|---|---|---|---|
| **simplemma** (German lemma list) | ~700k entries across languages | **MIT** | Permissive. **The fallback if Wiktionary is chosen against.** |
| Morphy / LanguageTool German POS dictionary | ~3.5M forms | **LGPL-2.1** | Usable but copyleft; deprioritised per the brief. |
| german-nouns | ~100k nouns | **CC BY-SA 4.0** (the PyPI classifier reads "Other/Proprietary", which is a metadata error, not a second licence) | Share-alike, nouns only. Deprioritised. |
| FreeDict deu-eng | 517,534 headwords | GPL-family | Not needed; Spike A succeeded. |

Nothing proprietary or scraped is used.

---

## What was chosen

**English Wiktionary REST does both jobs — definition lookup and lemmatisation.**
One network dependency, no bundled dataset, nothing added to the reading-path
bundle.

This fits the architecture already decided: lemmatisation happens **once, at
import**. The network is touched while importing a document and never while
reading. Results are written to `Doc.lemmas` and `DictEntry`, both permanent.

### Licence obligation

Wiktionary content is **CC BY-SA 3.0**. Cached definitions live in the user's
own IndexedDB, which is not redistribution, so the practical obligation is
attribution. Settings must credit English Wiktionary and link the licence. The
repo is public; this note is why that line exists.

---

## Open risks, and the fallback if this breaks

1. **Import latency.** Import must resolve every distinct token, one HTTP
   request each. A 2,000-token document has roughly 500–800 distinct tokens.
   Serial at polite pacing, that is minutes, not the "seconds" the architecture
   note assumes. Import needs bounded concurrency (5–8), a visible progress
   state, and must be resumable. *This is the one estimate in CLAUDE.md that the
   spike contradicts.*

2. **Import requires connectivity.** Reading and review stay fully offline;
   importing does not. A document imported offline would carry an empty lemma
   map, so import should refuse to run offline rather than silently degrade.

3. **Compounds.** ~8% of real tokens will not resolve, permanently. Handled by
   `note` and `lookupFailed`, not by a better dataset.

4. **Separable prefixes in running text.** `steht … auf` is not reunited by
   anything built here. A tokeniser concern, unsolved.

5. **Rate limits or policy change.** Wikimedia could throttle or require
   authentication. **Fallback: bundle the simplemma German lemma list (MIT) as
   an import-time-only asset**, with FreeDict `deu-eng` for definitions. The
   architecture already isolates this — the lemma dataset is an import-time
   dependency, never loaded during reading — so swapping the source touches the
   import pipeline and nothing else.

---

# Epic 3 — Lemma engine: what it cannot do

The cascade in `src/lib/lemma/` returns **ranked candidates**, never a single
answer, and this section exists so that nobody mistakes the ranking for
knowledge. Anything below confidence `0.7` is a guess dressed up as a list.

## Stages, cheapest first

| Stage | Method | Confidence | Needs network |
|---|---|---|---|
| 1 | `exact` — Wiktionary says this form is itself a citation form | 1.00 | yes |
| 2 | `wiktionary` — the entry declares it a form of another word | 0.95 | yes |
| 3a | `table` — hand-written irregular/strong verb table | 0.85–0.90 | no |
| 3b | `suffix` — ordered suffix rules, umlaut reversal, `ge-` circumfix, schwa restoration | 0.35–0.60 | no |
| 4 | `separable` — a stranded prefix later in the same clause | 0.45–0.55 | no |
| 5 | bundled dataset | — | **not built** |

Stage 5 was not built. Epic 0 measured Wiktionary at 92% on unseen prose, which
does not justify shipping a dataset. `simplemma` (MIT) remains the costed
fallback if Wikimedia ever refuses us.

## What it genuinely cannot do

1. **Compound nouns.** German builds them without limit and Wiktionary does not
   list most of them. `Familienernährer`, `Königstochter`, `Brunnenrand` will
   not resolve, and no suffix rule can split them. This is the single largest
   source of failure and it is permanent. The escape hatch is `SavedWord.note`.

2. **Strong verb stem vowels, offline.** `gesprochen → sprechen` works only
   because it is in the hand-written table. A strong verb outside that table —
   `gequollen`, `verdorben` — falls to the suffix rules, which will happily
   propose `quellen`-shaped nonsense. Online, Wiktionary gets these right.

3. **Separable prefixes are guessed, not parsed.** The stage scans forward in
   the clause for a known prefix. It cannot tell a stranded verb prefix from a
   preposition, so `er ging mit dem Hund` offers `mitgehen` next to `gehen`.
   Both are returned; the reader picks. It deliberately does not look backwards
   and does not cross a comma, which removes the worst false positives but not
   all of them.

4. **Ambiguity is not resolved, only listed.** `sein` is "to be" and "his".
   `Bauer` is a farmer and a birdcage. Nothing here does part-of-speech
   disambiguation, and with only a sentence of context it could not.

5. **Case, number and gender are discarded.** The engine answers "what is the
   dictionary form", not "what grammatical form is this". `dem`, `den`, `des`
   all collapse to `der`. That is the right answer for a dictionary lookup and
   the wrong one for a grammar lesson — and grammar tables are a stated
   non-goal.

6. **Proper nouns are not detected.** A capitalised unknown word is treated as
   a noun and inflected accordingly, so a name may acquire confident-looking
   suffix candidates. They rank low, but they are shown.

7. **The lowercase retry is lossy.** Sentence-initial `Die` resolves only after
   a second lookup with a lowercased first letter, and that retry can turn a
   genuine proper noun into a common one.

8. **Offline imports are much weaker.** Stage 1 and 2 need the network. With no
   connection the cascade still returns candidates, but nothing scores above
   `0.6`, so effectively nothing is *resolved* — only guessed at. Import should
   therefore not be run offline; reading and review remain fully offline.

## Two harness mistakes worth remembering

Both produced confident, wrong numbers before being caught:

- **A Varnish error page measured as prose.** Wikimedia serves rate-limit and
  error pages with HTTP 200 and English text in the body. Tokenising one gave a
  precise, meaningless "2.6% coverage". The measurement script now asserts the
  fetched text actually looks like German before trusting anything derived from
  it.
- **Failed lookups counted as "no entry".** Swallowing a network error and
  treating it as "Wiktionary has nothing" makes rate-limiting look exactly like
  poor coverage. Failures are now counted separately, and a run with more than
  10% failures fails the assertion instead of reporting a number.

The lesson generalises past this epic: a measurement harness that cannot tell
"absent" from "broken" will always report "absent".

## Measurement — Der Froschkönig (Grimm, 1857), 9 paragraphs, 488 unique forms

**Offline stages only (3 and 4, no network):**

```
Resolved:   87 / 488  (17.8%)
Unresolved: 401 / 488 (82.2%)
Top candidate by method: table 87
```

Every single offline resolution came from the hand-written irregular table.
The suffix rules contributed **nothing** above the 0.7 confidence bar — by
design, since a suffix strip can never *know* it is right.

This is the number that justifies the Wiktionary stage existing. It is also the
honest answer to "what happens if I import with no connection": roughly one word
in six, and those are the ones you already knew.

**Important nuance the headline number hides:** many "unresolved" forms have the
correct lemma sitting at the top of their candidate list, just below the
confidence bar — `alten → alt (0.50)`, `lebte → leben (0.50)`,
`Töchter → Tochter (0.40)`. Unresolved means *not confident*, not *wrong*. The
ranked list is doing its job.

The genuine offline failures are of three kinds:
- **Function words** — `so`, `doch`, `aber`, `wo`, `noch`. Already lemmas, but
  nothing offline can confirm that. Wiktionary answers these instantly.
- **Umlaut over-correction** — `König → Konig`. The reversal is blind; `König`
  is itself a lemma.
- **Orthographic age** — `daß` is pre-1996 spelling and is not a modern lemma.

**Full cascade (with Wiktionary): not yet measured.** The run was abandoned
after 25 minutes. Having hammered the API earlier in this epic, I was being
rate-limited into exponential backoff, and continuing would have been both
useless and rude. The harness now caches every lookup to `scripts/.form-cache.json`,
so the run can be resumed later and will accumulate rather than restart.
Epic 0's controlled sample puts the expected figure near 92%.

### A ranking bug this measurement caught

`lebte` in *"In alten Zeiten lebte ein König"* produced `einleben` (0.55
separable) **above** the correct `leben` (0.50 suffix): the stage saw `ein`
after the verb and joined it. Two changes:

- A separable candidate can no longer outrank the simple verb it was built from
  (0.48 / 0.42, both under the 0.50 suffix baseline).
- Article-like prefixes (`ein`, `an`, `zu`, `bei`, `mit` , `nach`, `vor`, `aus`)
  are skipped when the next token is capitalised, because a noun phrase is
  starting rather than a clause ending.

`lebte → leben` now ranks first. This is exactly the failure the spec predicted
when it called stage 4 "imperfect by design" — worth having found it on real
prose rather than on the test fixtures, which all passed throughout.
