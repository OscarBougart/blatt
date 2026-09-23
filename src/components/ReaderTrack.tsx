import type { Pair } from '@/db/types';
import ReaderPane from '@/components/ReaderPane';
import { HINT_SHIFT } from '@/hooks/useFlipHint';

const SLIDE_MS = 260;
const HINT_MS = 520;
const EASE = 'cubic-bezier(.2,.8,.2,1)';

type Register = (index: number) => (element: HTMLElement | null) => void;

export interface ReaderTrackProps {
  side: 'de' | 'en';
  /** The first-visit demonstration of the flip is running. */
  hinting: boolean;
  pairs: Pair[];
  dePaneRef: (element: HTMLElement | null) => void;
  enPaneRef: (element: HTMLElement | null) => void;
  deRegister: Register;
  enRegister: Register;
  savedKeys: Set<string>;
  exitingKeys: Set<string>;
}

/**
 * The two panes side by side on a track twice the screen width, and the
 * slide between them. Only ever one is on screen: the flip moves the whole
 * track, so German and English are never visible at the same time.
 */
export default function ReaderTrack({
  side,
  hinting,
  pairs,
  dePaneRef,
  enPaneRef,
  deRegister,
  enRegister,
  savedKeys,
  exitingKeys,
}: ReaderTrackProps) {
  return (
    <div
      className="flex h-full w-[200%] will-change-transform"
      style={{
        transform:
          side === 'en'
            ? 'translateX(-50%)'
            : hinting
              ? `translateX(${HINT_SHIFT})`
              : 'translateX(0)',
        // The hint moves more slowly than a flip: it is being shown to you,
        // not performed by you.
        transition: `transform ${hinting ? HINT_MS : SLIDE_MS}ms ${EASE}`,
      }}
    >
      <ReaderPane
        language="de"
        pairs={pairs}
        active={side === 'de'}
        paneRef={dePaneRef}
        register={deRegister}
        savedKeys={savedKeys}
        exitingKeys={exitingKeys}
      />
      <ReaderPane
        language="en"
        pairs={pairs}
        active={side === 'en'}
        paneRef={enPaneRef}
        register={enRegister}
        savedKeys={savedKeys}
        exitingKeys={exitingKeys}
      />
    </div>
  );
}
