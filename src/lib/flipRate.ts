/**
 * The one honest statistic: how much of what you read you had to look up.
 *
 * Both inputs are counts of *unique* paragraph indices that met the dwell
 * threshold, so neither re-reading nor fast scrolling moves the number.
 */
export function flipRate(paragraphsViewed: number, paragraphsFlipped: number): number {
  if (paragraphsViewed <= 0) return 0;
  return paragraphsFlipped / paragraphsViewed;
}
