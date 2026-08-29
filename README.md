# Blatt

A local-first reading app for German. The text is German by default; the English
translation costs a deliberate gesture, and the two are never on screen at once.
Words you tap are saved and come back as SM-2 flashcards.

No backend, no accounts, no sync. Everything lives in IndexedDB on the device.
The only network call the app ever makes is to Wiktionary, when a document is
imported.

## Running it

```
npm install
npm run dev        # http://localhost:5173
npm test           # the pure modules: lemmatiser, aligner, scheduler, stats
npm run build
```

## Regenerating the generated assets

Both are committed, and neither runs as part of `npm run build`.

```
npm run icons      # public/icon-*.png, from the mark in favicon.svg
npm run seed       # public/seed.json — the demo document
```

`npm run seed` fetches the Grimms' *Der Froschkönig* (1857) and Margaret Hunt's
1884 translation from Wikisource, aligns them by the table in
`scripts/seed-source.ts`, lemmatises every surface form with the app's own
cascade, and inlines every definition. It takes several minutes and caches
everything it fetches under `scripts/.seed-cache/`. It is polite to Wikimedia
and should stay that way.

## The offline acceptance test

Not a Lighthouse score. The test is a cold launch with no network:

1. `npm run build && npm run preview -- --host`, and open it on a phone on the
   same network — or deploy it. A service worker needs HTTPS or localhost.
2. Load it once, so the service worker installs. Add to Home Screen.
3. Put the phone in airplane mode.
4. Kill the app and launch it from the home screen icon.

It must open into the library, into the demo text, flip to English, save a word
and review a card, with no network and no visible failure. The demo ships with
its lemma map and every definition inlined precisely so this holds.

## Backups

Browsers evict IndexedDB from sites they consider idle, and iOS Safari does not
reliably honour `navigator.storage.persist()`. Settings → Backup writes the
whole database to one JSON file through the share sheet. Restoring merges by
id and never overwrites what is already there.

## Sources and licences

Text: Kinder- und Hausmärchen (1857) and Margaret Hunt's 1884 translation, both
public domain, from Wikisource. Definitions: English Wiktionary, CC BY-SA 3.0.
Type: [Newsreader](https://fonts.google.com/specimen/Newsreader), OFL.
