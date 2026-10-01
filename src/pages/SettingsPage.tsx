import { useState } from 'react';
import { Link } from 'react-router-dom';
import BackupSection from '@/components/BackupSection';
import Page from '@/components/Page';
import { THEME_PREFERENCES, useTheme } from '@/context/ThemeContext';
import { TYPE_SIZES, useTypeSize } from '@/context/TypeSizeContext';
import { useBack } from '@/hooks/useBack';
import { resetTutorial } from '@/lib/tutorial';

const THEME_LABELS = { light: 'Light', dark: 'Dark', system: 'System' } as const;

export default function SettingsPage() {
  const back = useBack('/');
  const { preference, setPreference } = useTheme();
  const { size, setSize } = useTypeSize();
  const [tutorialReset, setTutorialReset] = useState(false);

  return (
    <Page title="Settings" back={back}>
      {/* Three states rather than a switch, because the useful third one is
          neither: a phone that goes dark at dusk should take the app with it. */}
      <div className="flex min-h-12 items-center justify-between border-b border-rule dark:border-lamp-gph/25">
        <span>Theme</span>
        <div className="flex gap-1">
          {THEME_PREFERENCES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPreference(option)}
              aria-pressed={preference === option}
              className={[
                'type-en min-h-12 px-3',
                preference === option
                  ? 'text-ink dark:text-lamp-ink'
                  : 'text-graphite dark:text-lamp-gph',
              ].join(' ')}
            >
              {THEME_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      {/* Pinch-zoom is off in the reader so that double-tap can save a word.
          This gives the size control back. */}
      <div className="flex min-h-12 items-center justify-between border-b border-rule dark:border-lamp-gph/25">
        <span>Text size</span>
        <div className="flex gap-1">
          {TYPE_SIZES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSize(option)}
              aria-pressed={size === option}
              className={[
                'min-h-12 min-w-12 px-2',
                size === option
                  ? 'text-ink dark:text-lamp-ink'
                  : 'text-graphite dark:text-lamp-gph',
              ].join(' ')}
              style={{ fontSize: `${option}px` }}
            >
              Aa
            </button>
          ))}
        </div>
      </div>

      {/* The reader teaches its two gestures once. This is how to be taught
          again, or to hand the phone to someone who has never seen it. */}
      <button
        type="button"
        onClick={() => {
          resetTutorial();
          setTutorialReset(true);
        }}
        className="flex min-h-12 w-full items-center border-b border-rule text-left dark:border-lamp-gph/25"
      >
        Show the tutorial again
      </button>
      {tutorialReset && (
        <p role="status" className="type-en mt-3 text-graphite dark:text-lamp-gph">
          It will run the next time you open a text.
        </p>
      )}

      <BackupSection />

      <p className="type-en mt-10 text-graphite dark:text-lamp-gph">
        Definitions come from{' '}
        <a href="https://en.wiktionary.org" className="underline">
          English Wiktionary
        </a>
        , used under{' '}
        <a href="https://creativecommons.org/licenses/by-sa/3.0/" className="underline">
          CC BY-SA 3.0
        </a>
        .
      </p>

      {/* The only route to the privacy page, and at 18px it was the smallest
          thing to hit in the app. The Wiktionary and licence links above stay
          as they are: those sit inside a sentence, where a thumb-sized target
          would break the line. */}
      <Link
        to="/privacy"
        className="type-en mt-4 inline-flex min-h-12 items-center underline underline-offset-4 text-graphite dark:text-lamp-gph"
      >
        Privacy
      </Link>
    </Page>
  );
}
