import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export interface EmptyStateProps {
  /** What is not here, in one sentence. */
  children: ReactNode;
  /** Where to go instead. Omitted only when there is genuinely nowhere. */
  to?: string;
  /** The label on that way out. */
  action?: string;
  /** For a reset rather than a destination — clearing a filter, retrying. */
  onAction?: () => void;
}

const muted = "text-graphite dark:text-lamp-gph";

/**
 * An empty screen with a way off it.
 *
 * Every empty state in the app used to be a sentence of prose and nothing
 * else — correct about the situation, useless about what to do next. The way
 * out is a real control at thumb size, not an underlined word in a paragraph.
 */
export default function EmptyState({
  children,
  to,
  action,
  onAction,
}: EmptyStateProps) {
  const control =
    "mt-6 inline-flex min-h-12 items-center rounded-sm border border-rule px-4 dark:border-lamp-gph/25";

  return (
    <>
      <p className={`type-en ${muted}`}>{children}</p>

      {action &&
        (to ? (
          <Link to={to} className={`${control} ${muted}`}>
            {action}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAction}
            className={`${control} ${muted}`}
          >
            {action}
          </button>
        ))}
    </>
  );
}
