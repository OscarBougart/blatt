import Page from '@/components/Page';

const muted = 'text-graphite dark:text-lamp-gph';

/** The round lengths on offer. */
const LIMITS = [5, 10, 20];

export interface LengthPickerProps {
  onPick: (limit: number) => void;
  onBack: () => void;
}

/**
 * How long this round runs, asked before every round. Picking a length is
 * what starts it. Short by default: a round you finish is a round.
 */
export default function LengthPicker({ onPick, onBack }: LengthPickerProps) {
  return (
    <Page title="Review" back={onBack}>
      <p className={`type-en mb-4 ${muted}`}>How many cards?</p>
      <div className="flex gap-3">
        {LIMITS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            className="min-h-12 flex-1 rounded-sm border border-rule text-lg dark:border-lamp-gph/25"
          >
            {n}
          </button>
        ))}
      </div>
    </Page>
  );
}
