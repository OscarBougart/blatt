import Page from '@/components/Page';
import type { SessionStyle } from '@/lib/queue';

const muted = 'text-graphite dark:text-lamp-gph';

export interface StylePickerProps {
  onPick: (style: SessionStyle) => void;
}

/**
 * Which kind of question this session asks. Offered on a first round and
 * whenever the reader asks to change it; remembered in between.
 */
export default function StylePicker({ onPick }: StylePickerProps) {
  const option =
    'flex min-h-16 w-full flex-col justify-center border-b border-rule py-3 text-left dark:border-lamp-gph/25';

  return (
    <Page title="Review">
      <button type="button" onClick={() => onPick('sentence')} className={option}>
        <span className="text-lg">In context</span>
        <span className={`type-en ${muted}`}>The sentence you read it in</span>
      </button>

      <button type="button" onClick={() => onPick('word')} className={option}>
        <span className="text-lg">Word only</span>
        <span className={`type-en ${muted}`}>The meaning, and you supply the German</span>
      </button>
    </Page>
  );
}
