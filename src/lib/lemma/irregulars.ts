/**
 * Irregular (strong) German verb forms that no suffix rule can reach.
 *
 * Hand-written, not a dataset. It covers the high-frequency verbs that carry
 * most of a page of prose; the long tail of rare strong verbs is left to the
 * Wiktionary stage, which handles them well. Keys are lowercase surface forms.
 *
 * Deliberately not exhaustive — see docs/spikes.md.
 */
export const IRREGULAR_VERBS: Readonly<Record<string, string>> = {
  // sein / haben / werden — the three that appear on every page
  bin: 'sein', bist: 'sein', ist: 'sein', sind: 'sein', seid: 'sein',
  war: 'sein', warst: 'sein', waren: 'sein', wart: 'sein',
  wäre: 'sein', wären: 'sein', wärst: 'sein', gewesen: 'sein', sei: 'sein',
  habe: 'haben', hast: 'haben', hat: 'haben', habt: 'haben',
  hatte: 'haben', hattest: 'haben', hatten: 'haben', hattet: 'haben',
  hätte: 'haben', hätten: 'haben', gehabt: 'haben',
  werde: 'werden', wirst: 'werden', wird: 'werden', werdet: 'werden',
  wurde: 'werden', wurdest: 'werden', wurden: 'werden', wurdet: 'werden',
  würde: 'werden', würden: 'werden', geworden: 'werden', worden: 'werden',

  // modals
  kann: 'können', kannst: 'können', könnt: 'können',
  konnte: 'können', konnten: 'können', könnte: 'können', könnten: 'können', gekonnt: 'können',
  muss: 'müssen', musst: 'müssen', müsst: 'müssen',
  musste: 'müssen', mussten: 'müssen', müsste: 'müssen', müssten: 'müssen', gemusst: 'müssen',
  will: 'wollen', willst: 'wollen', wollt: 'wollen',
  wollte: 'wollen', wollten: 'wollen', gewollt: 'wollen',
  soll: 'sollen', sollst: 'sollen', sollt: 'sollen',
  sollte: 'sollen', sollten: 'sollen', gesollt: 'sollen',
  darf: 'dürfen', darfst: 'dürfen', dürft: 'dürfen',
  durfte: 'dürfen', durften: 'dürfen', dürfte: 'dürfen', dürften: 'dürfen', gedurft: 'dürfen',
  mag: 'mögen', magst: 'mögen', mögt: 'mögen',
  mochte: 'mögen', mochten: 'mögen', möchte: 'mögen', möchten: 'mögen', gemocht: 'mögen',
  weiß: 'wissen', weißt: 'wissen', wisst: 'wissen',
  wusste: 'wissen', wussten: 'wissen', wüsste: 'wissen', gewusst: 'wissen',

  // common strong verbs: preterite and participle
  ging: 'gehen', gingst: 'gehen', gingen: 'gehen', gegangen: 'gehen', geht: 'gehen',
  kam: 'kommen', kamst: 'kommen', kamen: 'kommen', gekommen: 'kommen', kommt: 'kommen',
  lief: 'laufen', liefen: 'laufen', gelaufen: 'laufen', läuft: 'laufen', läufst: 'laufen',
  sah: 'sehen', sahst: 'sehen', sahen: 'sehen', gesehen: 'sehen', sieht: 'sehen', siehst: 'sehen',
  gab: 'geben', gabst: 'geben', gaben: 'geben', gegeben: 'geben', gibt: 'geben', gibst: 'geben',
  nahm: 'nehmen', nahmen: 'nehmen', genommen: 'nehmen', nimmt: 'nehmen', nimmst: 'nehmen',
  sprach: 'sprechen', sprachen: 'sprechen', gesprochen: 'sprechen',
  spricht: 'sprechen', sprichst: 'sprechen',
  stand: 'stehen', standen: 'stehen', gestanden: 'stehen', steht: 'stehen', stehst: 'stehen',
  saß: 'sitzen', saßen: 'sitzen', gesessen: 'sitzen', sitzt: 'sitzen',
  lag: 'liegen', lagen: 'liegen', gelegen: 'liegen', liegt: 'liegen',
  fand: 'finden', fanden: 'finden', gefunden: 'finden', findet: 'finden',
  hielt: 'halten', hielten: 'halten', gehalten: 'halten', hält: 'halten', hältst: 'halten',
  fuhr: 'fahren', fuhren: 'fahren', gefahren: 'fahren', fährt: 'fahren', fährst: 'fahren',
  trug: 'tragen', trugen: 'tragen', getragen: 'tragen', trägt: 'tragen',
  schlug: 'schlagen', schlugen: 'schlagen', geschlagen: 'schlagen', schlägt: 'schlagen',
  rief: 'rufen', riefen: 'rufen', gerufen: 'rufen', ruft: 'rufen',
  fiel: 'fallen', fielen: 'fallen', gefallen: 'fallen', fällt: 'fallen',
  hieß: 'heißen', hießen: 'heißen', geheißen: 'heißen', heißt: 'heißen',
  ließ: 'lassen', ließen: 'lassen', gelassen: 'lassen', lässt: 'lassen',
  aß: 'essen', aßen: 'essen', gegessen: 'essen', isst: 'essen',
  trank: 'trinken', tranken: 'trinken', getrunken: 'trinken', trinkt: 'trinken',
  schrieb: 'schreiben', schrieben: 'schreiben', geschrieben: 'schreiben',
  blieb: 'bleiben', blieben: 'bleiben', geblieben: 'bleiben',
  zog: 'ziehen', zogen: 'ziehen', gezogen: 'ziehen', zieht: 'ziehen',
  flog: 'fliegen', flogen: 'fliegen', geflogen: 'fliegen', fliegt: 'fliegen',
  schlief: 'schlafen', schliefen: 'schlafen', geschlafen: 'schlafen', schläft: 'schlafen',
  las: 'lesen', lasen: 'lesen', gelesen: 'lesen', liest: 'lesen',
  fing: 'fangen', fingen: 'fangen', gefangen: 'fangen', fängt: 'fangen',
  half: 'helfen', halfen: 'helfen', geholfen: 'helfen', hilft: 'helfen',
  nannte: 'nennen', nannten: 'nennen', genannt: 'nennen',
  brachte: 'bringen', brachten: 'bringen', gebracht: 'bringen',
  dachte: 'denken', dachten: 'denken', gedacht: 'denken',
  tat: 'tun', taten: 'tun', getan: 'tun', tut: 'tun',
  bat: 'bitten', baten: 'bitten', gebeten: 'bitten', bittet: 'bitten',
  band: 'binden', banden: 'binden', gebunden: 'binden',
  sang: 'singen', sangen: 'singen', gesungen: 'singen', singt: 'singen',
  sprang: 'springen', sprangen: 'springen', gesprungen: 'springen',
  starb: 'sterben', starben: 'sterben', gestorben: 'sterben', stirbt: 'sterben',
  warf: 'werfen', warfen: 'werfen', geworfen: 'werfen', wirft: 'werfen',
  verlor: 'verlieren', verloren: 'verlieren', verliert: 'verlieren',
  schnitt: 'schneiden', schnitten: 'schneiden', geschnitten: 'schneiden',
  stieg: 'steigen', stiegen: 'steigen', gestiegen: 'steigen',
  wusch: 'waschen', wuschen: 'waschen', gewaschen: 'waschen', wäscht: 'waschen',
  wuchs: 'wachsen', wuchsen: 'wachsen', gewachsen: 'wachsen', wächst: 'wachsen',
};

/**
 * Comparatives and superlatives that change stem, plus a few pronoun forms
 * that no suffix rule will ever recover.
 */
export const IRREGULAR_OTHER: Readonly<Record<string, string>> = {
  besser: 'gut', besten: 'gut', beste: 'gut', bester: 'gut', bestes: 'gut', am: 'an',
  mehr: 'viel', meisten: 'viel', meiste: 'viel',
  lieber: 'gern', liebsten: 'gern',
  höher: 'hoch', höhere: 'hoch', höchsten: 'hoch', höchste: 'hoch',
  näher: 'nah', nächsten: 'nah', nächste: 'nah',
  größer: 'groß', größten: 'groß', größte: 'groß',
  ihm: 'er', ihn: 'er', ihnen: 'sie', ihr: 'sie', sie: 'sie',
  mir: 'ich', mich: 'ich', dir: 'du', dich: 'du', uns: 'wir', euch: 'ihr',
  dem: 'der', den: 'der', des: 'der', die: 'der', das: 'der', der: 'der',
  einem: 'ein', einen: 'ein', eines: 'ein', einer: 'ein', eine: 'ein',
};

export function lookupIrregular(surface: string): string | null {
  const key = surface.toLowerCase();
  return IRREGULAR_VERBS[key] ?? IRREGULAR_OTHER[key] ?? null;
}
