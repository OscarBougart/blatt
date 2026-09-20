/**
 * A left-pointing arrow. Drawn rather than typed: an arrow glyph is at the
 * mercy of whichever font the platform has, and Newsreader has no good one.
 */
export default function BackArrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}
