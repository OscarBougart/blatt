import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Page from '@/components/Page';
import { db } from '@/db/db';

export default function HomePage() {
  const docs = useLiveQuery(() => db.docs.orderBy('createdAt').reverse().toArray(), []);
  const words = useLiveQuery(() => db.words.toArray(), [], []);

  const counts = useMemo(() => {
    const byDoc = new Map<string, number>();
    for (const word of words ?? []) {
      byDoc.set(word.docId, (byDoc.get(word.docId) ?? 0) + 1);
    }
    return byDoc;
  }, [words]);

  if (docs === undefined) return <Page title="Blatt" />;

  return (
    <Page title="Blatt">
      {docs.length === 0 ? (
        <p className="type-en text-graphite dark:text-lamp-gph">
          No texts yet. Import one to begin.
        </p>
      ) : (
        <ul>
          {docs.map((doc) => {
            const saved = counts.get(doc.id) ?? 0;
            return (
              <li key={doc.id} className="border-b border-rule dark:border-lamp-gph/25">
                <Link
                  to={`/read/${doc.id}`}
                  className="flex min-h-14 flex-col justify-center py-2"
                >
                  <span className="text-lg">{doc.title}</span>
                  <span className="type-en text-graphite dark:text-lamp-gph">
                    {doc.theme}
                    {doc.theme && saved > 0 && ' · '}
                    {saved > 0 && `${saved} ${saved === 1 ? 'word' : 'words'}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
