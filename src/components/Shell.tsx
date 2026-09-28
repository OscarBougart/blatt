import { useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import type { ShellContext } from '@/hooks/useFocusMode';

/**
 * Four destinations, not five.
 *
 * Import used to sit here, but importing is something you do once per text,
 * not a place you go. It lives on the library screen now, beside Edit, where
 * the thing it acts on is.
 */
const NAV = [
  { to: '/', label: 'Read', end: true },
  { to: '/words', label: 'Words' },
  { to: '/review', label: 'Review' },
  { to: '/stats', label: 'Stats' },
];

/** Chrome for every route except the reader, which mounts outside it. */
export default function Shell() {
  /** A page has asked for the screen to itself: see `useFocusMode`. */
  const [focused, setFocused] = useState(false);
  const context = useMemo<ShellContext>(() => ({ setFocused }), []);

  return (
    <div
      className={[
        'min-h-full bg-paper text-ink dark:bg-lamp dark:text-lamp-ink',
        // With the bar gone there is nothing to clear but the phone's own
        // home indicator. Everything that measures from --nav-clear, the
        // grade bar included, drops to the bottom with it.
        focused ? '[--nav-clear:env(safe-area-inset-bottom)]' : '',
      ].join(' ')}
    >
      {/* The bar is 56px plus whatever the phone reserves for its own home
          indicator, and the page has to clear both. */}
      <div className="mx-auto max-w-prose px-6 pt-10 pb-[calc(var(--nav-clear)+2.5rem)]">
        <Outlet context={context} />
      </div>

      <nav
        aria-label="Sections"
        aria-hidden={focused}
        {...{ inert: focused ? '' : undefined }}
        className={[
          'fixed inset-x-0 bottom-0 border-t border-sill-edge bg-sill pb-[env(safe-area-inset-bottom)] transition-transform duration-200 ease-out motion-reduce:transition-none dark:border-lamp-sill-edge dark:bg-lamp-sill',
          focused ? 'translate-y-full' : 'translate-y-0',
        ].join(' ')}
      >
        <ul className="mx-auto flex max-w-prose">
          {NAV.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className="relative flex min-h-14 items-center justify-center text-[13px] tracking-[0.02em]"
              >
                {({ isActive }) => (
                  <>
                    {/* A short rule at the top of the tab, in the idiom of a
                        printed one. Colour alone was carrying the active
                        state before, and at a glance it did not carry it. */}
                    <span
                      aria-hidden="true"
                      className={[
                        'absolute inset-x-0 top-0 mx-auto h-0.5 w-6 rounded-b-sm bg-accent transition-opacity duration-200 dark:bg-lamp-accent',
                        isActive ? 'opacity-100' : 'opacity-0',
                      ].join(' ')}
                    />
                    <span
                      className={
                        isActive
                          ? 'font-semibold text-ink dark:text-lamp-ink'
                          : 'text-graphite dark:text-lamp-gph'
                      }
                    >
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
