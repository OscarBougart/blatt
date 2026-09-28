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
  /**
   * Title in the middle of the bar, the back arrow on its own at the left.
   * For a screen that is an end point rather than a list, like the summary
   * of a finished round.
   */
  centerTitle?: boolean;
  children?: ReactNode;
}

export default function Page({
  title,
  back,
  aside,
  hideTitle,
  centerTitle,
  children,
}: PageProps) {
  const backButton = back && (
    <button
      type="button"
      onClick={back}
      aria-label="Back"
      className="-ml-3 flex h-12 w-12 items-center justify-center text-ink dark:text-lamp-ink"
    >
      <BackArrow />
    </button>
  );

  if (centerTitle) {
    return (
      <>
        {/* Three columns, the outer two the width of the back button, so the
            title is centred on the screen and not on what is left of it. */}
        <div className="grid min-h-12 grid-cols-[3rem_1fr_3rem] items-center">
          <div>{backButton}</div>
          <h1 className="text-center text-2xl">{title}</h1>
          <div className="flex justify-end">{aside}</div>
        </div>

        <div className="mt-8">{children}</div>
      </>
    );
  }

  return (
    <>
      <div className="flex min-h-12 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {backButton}
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
