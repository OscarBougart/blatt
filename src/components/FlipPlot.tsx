import type { Session } from '@/db/types';
import { plotPoints } from '@/lib/stats';

const W = 320;
const H = 120;

/**
 * Flip rate over time. The only coloured thing in the app.
 *
 * `signal` is spent here and nowhere else, which is what makes it mean
 * something. The axis runs a fixed 0–100%: the line must not be able to
 * flatter you by rescaling itself.
 */
export default function FlipPlot({ sessions }: { sessions: Session[] }) {
  const points = plotPoints(sessions, W, H);
  if (points.length === 0) return null;

  const path = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <figure className="mt-2">
      <svg
        viewBox={`-4 -4 ${W + 8} ${H + 8}`}
        className="w-full"
        role="img"
        aria-label={`Flip rate across ${sessions.length} sessions, oldest first.`}
      >
        {/* 0% and 100%, so the line has something to be high or low against. */}
        {[0, H].map((y) => (
          <line
            key={y}
            x1={0}
            x2={W}
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeWidth={1}
            className="text-rule dark:text-lamp-gph/25"
          />
        ))}

        {points.length > 1 && (
          <polyline
            points={path}
            fill="none"
            stroke="var(--color-signal)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="var(--color-signal)" />
        ))}
      </svg>

      <figcaption className="type-en mt-2 flex justify-between text-graphite dark:text-lamp-gph">
        <span>Oldest</span>
        <span>100% at the top</span>
      </figcaption>
    </figure>
  );
}
