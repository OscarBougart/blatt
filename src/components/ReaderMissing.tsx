import { Link } from 'react-router-dom';

/**
 * The text is gone, or never existed. The reader is mounted outside the
 * Shell, so the way out has to be part of this screen or there is none.
 */
export default function ReaderMissing() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-paper px-6 dark:bg-lamp">
      <p className="type-en text-graphite dark:text-lamp-gph">That text is no longer here.</p>
      <Link
        to="/"
        className="inline-flex min-h-12 items-center rounded-sm border border-rule px-4 text-graphite dark:border-lamp-gph/25 dark:text-lamp-gph"
      >
        Back to the library
      </Link>
    </div>
  );
}
