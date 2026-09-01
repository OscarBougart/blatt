import { NavLink, Outlet } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Read', end: true },
  { to: '/words', label: 'Words' },
  { to: '/review', label: 'Review' },
  { to: '/import', label: 'Import' },
  { to: '/stats', label: 'Stats' },
  { to: '/settings', label: 'Settings' },
];

/** Chrome for every route except the reader, which mounts outside it. */
export default function Shell() {
  return (
    <div className="min-h-full bg-paper text-ink dark:bg-lamp dark:text-lamp-ink">
      <div className="mx-auto max-w-prose px-6 pb-24 pt-10">
        <Outlet />
      </div>

      <nav className="fixed inset-x-0 bottom-0 border-t border-rule bg-paper dark:border-lamp-gph/25 dark:bg-lamp">
        <ul className="mx-auto flex max-w-prose">
          {NAV.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'flex min-h-12 items-center justify-center text-[13px]',
                    isActive
                      ? 'text-ink dark:text-lamp-ink'
                      : 'text-graphite dark:text-lamp-gph',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
