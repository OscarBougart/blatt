import { def, lemmaPointer } from './probe.mjs';

const page = 'Die_Verwandlung';
const res = await fetch(
  `https://de.wikipedia.org/api/rest_v1/page/summary/${page}`,
  { headers: { 'Api-User-Agent': 'Blatt/0.1 spike' } },
);
const extract = (await res.json()).extract;

const res2 = await fetch('https://de.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&origin=*&titles=' + page);
const pages = (await res2.json()).query.pages;
const text = extract + ' ' + Object.values(pages)[0].extract.slice(0, 4000);

const tokens = [...new Set((text.match(/[A-Za-zÄÖÜäöüß]{3,}/g) ?? []))].slice(0, 150);
console.log('distinct tokens tested:', tokens.length);

let de = 0, resolved = 0, pointer = 0, miss = [];
for (const t of tokens) {
  let r; try { r = await def(t); } catch { r = { de: null }; }
  if (r.de) {
    de++;
    const p = lemmaPointer(r.de);
    if (p) { pointer++; resolved++; }
    else resolved++;            // no pointer means the token IS the lemma
  } else miss.push(t);
  await new Promise((x) => setTimeout(x, 90));
}
const n = tokens.length;
const pct = (k) => `${k}/${n} (${(100 * k / n).toFixed(0)}%)`;
console.log('German entry exists: ', pct(de));
console.log('  of those, inflected (lemma pointer):', pointer);
console.log('  of those, already a lemma:          ', de - pointer);
console.log('no German entry at all:', pct(n - de));
console.log('misses:', miss.join(' '));
