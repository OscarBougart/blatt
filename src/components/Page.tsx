import type { ReactNode } from 'react';
import BackArrow from '@/components/BackArrow';

interface PageProps {
  title: string;
  /** Given when the page is a step in a flow rather than a destination. */
  back?: () => void;
  /**
   * Drops the heading, leaving the back arrow and whatever `aside` holds. For
   * the card itself: a review card wants the screen, and a heading naming the
   * section you are plainly already in earns none of it.
   */
  hideTitle?: boolean;
  /** Set opposite the title. Where a running count belongs. */
  aside?: ReactNode;
  children?: ReactNode;
}

export default function Page({ title, back, aside, hideTitle, children }: PageProps) {
  return (
    <>
      <div className="flex min-h-12 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {back && (
            <button
              type="button"
              onClick={back}
              aria-label="Back"
              className="-ml-3 flex h-12 w-12 items-center justify-center text-graphite dark:text-lamp-gph"
            >
              <BackArrow />
            </button>
          )}
          {/* Hidden, never absent: the heading is what a screen reader
              announces the page by. */}
          <h1 className={hideTitle ? 'sr-only' : 'text-2xl'}>{title}</h1>
        </div>

        {aside}
      </div>

      <div className="mt-8">{children}</div>
    </>
  );
}
