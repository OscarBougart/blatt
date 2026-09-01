/**
 * The starter library: twelve Grimm tales, in the 1857 edition.
 *
 * Every text here is out of copyright and comes from de.wikisource.org, whose
 * page titles keep the 1857 orthography — Rothkäppchen, Sternthaler, Grethel.
 * The titles below are the Wikisource ones and must match exactly; the title
 * a reader sees is `title`, in modern spelling.
 *
 * Only High German. `Von dem Fischer un syner Fru` and the rest of the Low
 * German tales are in the same category on Wikisource and are deliberately
 * not here: a B2 learner meeting Plattdeutsch unannounced learns nothing
 * except that the app is broken.
 *
 * Ordered shortest first, which is also easiest first. A reader opening the
 * library sees something they can finish in five minutes at the top.
 *
 * Der Froschkönig is absent on purpose: it is the demo document every reader
 * already has, installed by the seed on first run.
 */

export const THEME = 'Märchen';

export interface LibraryText {
  /** Filename and identity. Stable — a reader's saved words point at it. */
  slug: string;
  /** As the reader sees it, in modern spelling. */
  title: string;
  /** The de.wikisource.org page, in 1857 spelling. Must match exactly. */
  source: string;
}

export const TEXTS: LibraryText[] = [
  { slug: 'sterntaler', title: 'Die Sterntaler', source: 'Die Sternthaler (1857)' },
  { slug: 'suesser-brei', title: 'Der süße Brei', source: 'Der süße Brei (1857)' },
  { slug: 'rotkaeppchen', title: 'Rotkäppchen', source: 'Rothkäppchen (1857)' },
  {
    slug: 'bremer-stadtmusikanten',
    title: 'Die Bremer Stadtmusikanten',
    source: 'Die Bremer Stadtmusikanten (1857)',
  },
  {
    slug: 'wolf-und-sieben-geisslein',
    title: 'Der Wolf und die sieben jungen Geißlein',
    source: 'Der Wolf und die sieben jungen Geislein (1857)',
  },
  { slug: 'frau-holle', title: 'Frau Holle', source: 'Frau Holle (1857)' },
  { slug: 'rumpelstilzchen', title: 'Rumpelstilzchen', source: 'Rumpelstilzchen (1857)' },
  { slug: 'haensel-und-gretel', title: 'Hänsel und Gretel', source: 'Hänsel und Grethel (1857)' },
  { slug: 'dornroeschen', title: 'Dornröschen', source: 'Dornröschen (1857)' },
  { slug: 'hase-und-igel', title: 'Der Hase und der Igel', source: 'Der Hase und der Igel (1857)' },
  { slug: 'aschenputtel', title: 'Aschenputtel', source: 'Aschenputtel (1857)' },
  {
    slug: 'tapferes-schneiderlein',
    title: 'Das tapfere Schneiderlein',
    source: 'Das tapfere Schneiderlein (1857)',
  },
];
