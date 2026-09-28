import Page from '@/components/Page';
import { GRADES, GRADE_LABEL, type Grade } from '@/lib/srs';

const muted = 'text-graphite dark:text-lamp-gph';

export interface ReviewSummaryProps {
  tally: Record<Grade, number>;
  onDone: () => void;
}

/**
 * How the round went, as the four grades. Not a score: a card graded Hard is
 * a card you will see again sooner, not a mark against the reader.
 */
export default function ReviewSummary({ tally, onDone }: ReviewSummaryProps) {
  return (
    <Page title="Review" back={onDone} centerTitle>
      <dl>
        {GRADES.map((grade) => (
          <div
            key={grade}
            className="flex items-baseline justify-between border-b border-rule py-4 text-xl dark:border-lamp-gph/25"
          >
            <dt>{GRADE_LABEL[grade]}</dt>
            <dd className={`tabular-nums ${tally[grade] === 0 ? muted : ''}`}>{tally[grade]}</dd>
          </div>
        ))}
      </dl>

      {/* The one thing on this screen to do, so it looks like a button. */}
      <button
        type="button"
        onClick={onDone}
        className="mt-10 flex min-h-14 w-full items-center justify-center rounded-sm border border-accent text-lg text-accent transition-colors active:bg-accent/10 dark:border-lamp-accent dark:text-lamp-accent dark:active:bg-lamp-accent/10"
      >
        Done
      </button>
    </Page>
  );
}
