export function calculateCriticality(ep: number, bestVsSecondGap = 0, potentialSwing = 0): number {
  const closeness = 1 - Math.min(1, Math.abs(ep - 0.5) * 2);
  return Math.max(0, Math.min(1, 0.35 * closeness + 0.4 * Math.min(1, bestVsSecondGap / 0.25) + 0.25 * Math.min(1, potentialSwing / 0.25)));
}
