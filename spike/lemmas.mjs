import { def, lemmaPointer, strip } from './probe.mjs';

/** 40 inflected forms drawn from ordinary German prose. */
const SAMPLE = [
  // finite verbs
  ['läuft', 'laufen'], ['ging', 'gehen'], ['sprach', 'sprechen'], ['hätte', 'haben'],
  ['wurde', 'werden'], ['nimmt', 'nehmen'], ['weiß', 'wissen'], ['konnte', 'können'],
  // participles
  ['gelaufen', 'laufen'], ['gesprochen', 'sprechen'], ['gewesen', 'sein'],
  ['aufgestanden', 'aufstehen'], ['mitgenommen', 'mitnehmen'], ['verstanden', 'verstehen'],
  // nouns, four cases
  ['Hauses', 'Haus'], ['Kindes', 'Kind'], ['Frauen', 'Frau'], ['dem', 'der'],
  ['Menschen', 'Mensch'], ['Herzens', 'Herz'], ['Namen', 'Name'], ['Jungen', 'Junge'],
  // umlaut plurals
  ['Häusern', 'Haus'], ['Bäume', 'Baum'], ['Väter', 'Vater'], ['Städte', 'Stadt'],
  ['Bücher', 'Buch'], ['Mütter', 'Mutter'], ['Hände', 'Hand'], ['Wörter', 'Wort'],
  // adjective endings
  ['großen', 'groß'], ['kleines', 'klein'], ['alten', 'alt'], ['gutem', 'gut'],
  ['schöner', 'schön'], ['dunkler', 'dunkel'], ['besser', 'gut'], ['höchsten', 'hoch'],
  // pronouns / misc high-frequency
  ['ihnen', 'sie'], ['seinem', 'sein'],
];

const norm = (s) => s.replace(/_/g, ' ').toLowerCase();

const rows = [];
for (const [form, expected] of SAMPLE) {
  let r;
  try { r = await def(form); } catch (e) { r = { status: 'ERR', de: null }; }
  const ptr = lemmaPointer(r.de);
  const hasDe = !!r.de;
  const ok = ptr ? norm(ptr) === norm(expected) : false;
  rows.push({ form, expected, status: r.status, hasDe, ptr, ok });
  await new Promise((r) => setTimeout(r, 120));
}

const n = rows.length;
const withDe = rows.filter((r) => r.hasDe).length;
const withPtr = rows.filter((r) => r.ptr).length;
const correct = rows.filter((r) => r.ok).length;

console.log('form            expected     German?  pointer            ok');
for (const r of rows)
  console.log(
    r.form.padEnd(15), String(r.expected).padEnd(12),
    (r.hasDe ? 'yes' : 'NO ').padEnd(8),
    String(r.ptr ?? '—').padEnd(18), r.ok ? 'Y' : '.',
  );
console.log(`\nn=${n}  German entry: ${withDe} (${(100*withDe/n).toFixed(0)}%)  lemma pointer: ${withPtr} (${(100*withPtr/n).toFixed(0)}%)  correct: ${correct} (${(100*correct/n).toFixed(0)}%)`);
