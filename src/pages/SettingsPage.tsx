import { Link, useNavigate } from 'react-router-dom';
import BackupSection from '@/components/BackupSection';
import PaceSection from '@/components/PaceSection';
import Page from '@/components/Page';
import { THEME_PREFERENCES, useTheme } from '@/context/ThemeContext';
import { TYPE_SIZES, useTypeSize } from '@/context/TypeSizeContext';

const THEME_LABELS = { light: 'Light', dark: 'Dark', system: 'System' } as const;

export default function SettingsPage() {
  const navigate = useNavigate();
  const { preference, setPreference } = useTheme();
  const { size, setSize } = useTypeSize();

  return (
    <Page title="Settings" back={() => void navigate('/')}>
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

      <PaceSection />

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

      <p className="type-en mt-4 text-graphite dark:text-lamp-gph">
        <Link to="/privacy" className="underline">
          Privacy
        </Link>
      </p>
    </Page>
  );
}
