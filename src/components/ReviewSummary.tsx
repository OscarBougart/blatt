import Page from '@/components/Page';
import { GRADES, GRADE_LABEL, type Grade } from '@/lib/srs';

const muted = 'text-graphite dark:text-lamp-gph';

export interface ReviewSummaryProps {
  tally: Record<Grade, number>;
  onAgain: () => void;
  onDone: () => void;
}

/**
 * How the round went, as the four grades. Not a score: a card graded Hard is
 * a card you will see again sooner, not a mark against the reader.
 */
export default function ReviewSummary({ tally, onAgain, onDone }: ReviewSummaryProps) {
  return (
    <Page title="Review" back={onDone}>
      <dl className="type-en">
        {GRADES.map((grade) => (
          <div key={grade} className="flex items-baseline justify-between py-1">
            <dt>{GRADE_LABEL[grade]}</dt>
            <dd className={tally[grade] === 0 ? muted : undefined}>{tally[grade]}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onAgain}
          className={`min-h-12 rounded-sm border border-rule px-4 dark:border-lamp-gph/25 ${muted}`}
        >
          Another round
        </button>
        <button
          type="button"
          onClick={onDone}
          className={`type-en min-h-12 underline underline-offset-4 ${muted}`}
        >
          Done
        </button>
      </div>
    </Page>
  );
}
