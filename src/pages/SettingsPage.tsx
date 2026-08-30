import BackupSection from '@/components/BackupSection';
import PaceSection from '@/components/PaceSection';
import Page from '@/components/Page';
import { useTheme } from '@/context/ThemeContext';
import { TYPE_SIZES, useTypeSize } from '@/context/TypeSizeContext';

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const { size, setSize } = useTypeSize();

  return (
    <Page title="Settings">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={theme === 'dark'}
        className="flex min-h-12 w-full items-center justify-between border-b border-rule text-left dark:border-lamp-gph/25"
      >
        <span>Dark</span>
        <span className="type-en text-graphite dark:text-lamp-gph">
          {theme === 'dark' ? 'On' : 'Off'}
        </span>
      </button>

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
    </Page>
  );
}
