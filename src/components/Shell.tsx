import { NavLink, Outlet } from 'react-router-dom';

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
  return (
    <div className="min-h-full bg-paper text-ink dark:bg-lamp dark:text-lamp-ink">
      {/* The bar is 56px plus whatever the phone reserves for its own home
          indicator, and the page has to clear both. */}
      <div className="mx-auto max-w-prose px-6 pt-10 pb-[calc(var(--nav-clear)+2.5rem)]">
        <Outlet />
      </div>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 border-t border-sill-edge bg-sill pb-[env(safe-area-inset-bottom)] dark:border-lamp-sill-edge dark:bg-lamp-sill"
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
                        'absolute inset-x-0 top-0 mx-auto h-0.5 w-6 rounded-b-sm bg-ink transition-opacity duration-200 dark:bg-lamp-ink',
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
