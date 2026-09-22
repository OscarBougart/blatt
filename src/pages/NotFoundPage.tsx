import { Link } from 'react-router-dom';
import Page from '@/components/Page';

export default function NotFoundPage() {
  return (
    <Page title="Nothing here">
      {/* The app's designated way out of a wrong turn. It used to be a bare
          text link, and so the smallest thing to hit in the whole app. */}
      <Link
        to="/"
        className="type-en inline-flex min-h-12 items-center rounded-sm border border-rule px-4 text-graphite dark:border-lamp-gph/25 dark:text-lamp-gph"
      >
        Back to the library
      </Link>
    </Page>
  );
}
