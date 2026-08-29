import { Link } from 'react-router-dom';
import Page from '@/components/Page';

export default function NotFoundPage() {
  return (
    <Page title="Nothing here">
      <Link to="/" className="type-en text-graphite underline dark:text-lamp-gph">
        Back to the library
      </Link>
    </Page>
  );
}
