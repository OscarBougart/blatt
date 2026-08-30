import Dexie, { type EntityTable } from 'dexie';
import type { DictEntry, Doc, FormEntry, ReviewLog, SavedWord, Session, Sighting } from './types';

export class BlattDB extends Dexie {
  docs!: EntityTable<Doc, 'id'>;
  words!: EntityTable<SavedWord, 'id'>;
  dict!: EntityTable<DictEntry, 'lemma'>;
  sessions!: EntityTable<Session, 'id'>;
  forms!: EntityTable<FormEntry, 'surface'>;
  reviews!: EntityTable<ReviewLog, 'id'>;
  sightings!: EntityTable<Sighting, 'lemma'>;

  constructor() {
    super('blatt');

    this.version(1).stores({
      docs: 'id, title, theme, createdAt',
      words: 'id, lemma, docId, dueAt, createdAt',
      dict: 'lemma, fetchedAt',
      sessions: 'id, docId, startedAt',
      lemmaMaps: 'docId',
    });

    this.version(2).stores({
      positions: 'docId',
    });

    // The reading position and the lemma map both belong on the Doc, per the
    // spec. Fold the two side tables back in before dropping them.
    this.version(3)
      .stores({ forms: 'surface, fetchedAt' })
      .upgrade(async (tx) => {
        const positions = await tx.table('positions').toArray();
        const byDoc = new Map<string, number>(
          positions.map((p) => [p.docId as string, (p.lastParagraphIndex as number) ?? 0]),
        );

        await tx.table('docs').toCollection().modify((doc) => {
          doc.lastParagraphIndex = byDoc.get(doc.id) ?? 0;
          doc.lemmaMap = doc.lemmaMap ?? {};
        });
      });

    // Dropped in a later version than the migration that read them, or Dexie
    // would delete the stores before the upgrade could copy anything out.
    this.version(4).stores({
      lemmaMaps: null,
      positions: null,
    });

    /**
     * Epic 9. The review log, and the sightings that feed the familiarity
     * model.
     *
     * Additive throughout. Existing words keep their SM-2 state untouched —
     * `modify` sets the new fields and leaves everything else alone — because
     * the whole point of a migration rather than a reset is that a year of
     * scheduling survives it.
     */
    this.version(5)
      .stores({
        reviews: 'id, wordId, reviewedAt',
        sightings: 'lemma, lastSeenAt',
      })
      .upgrade(async (tx) => {
        // Every word that already exists is already a card: it has been
        // scheduled and reviewed under the old rules, and putting it back in
        // the queue would be a demotion the reader never asked for.
        await tx
          .table('words')
          .toCollection()
          .modify((word) => {
            word.introducedAt = word.introducedAt ?? word.createdAt;
          });

        // Seed sightings from what has already been read. Counting each lemma
        // once per document is rough — it credits a word in a document that
        // was opened and abandoned — but starting every reader at zero would
        // make the familiarity model useless for months.
        const docs = await tx.table('docs').toArray();
        const counts = new Map<string, number>();

        for (const doc of docs) {
          const lemmas = new Set<string>();
          for (const candidates of Object.values(doc.lemmaMap ?? {})) {
            const best = (candidates as { lemma: string }[])[0]?.lemma;
            if (best) lemmas.add(best);
          }
          for (const lemma of lemmas) counts.set(lemma, (counts.get(lemma) ?? 0) + 1);
        }

        const now = Date.now();
        await tx.table('sightings').bulkAdd(
          [...counts].map(([lemma, count]) => ({ lemma, count, lastSeenAt: now })),
        );
      });
  }
}

export const db = new BlattDB();
