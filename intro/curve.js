/* One smooth curve through a channel's keys: monotone cubic (Fritsch-Carlson), so it
   keeps moving through a key instead of stopping on it, and never overshoots one.
   It only levels off where the channel itself turns or holds. Both ends leave at half
   the speed of their first stretch: not from a standstill, not at a jolt. */
export function curve(knots) {
  const n = knots.length;
  if (n === 1) return () => knots[0][1];
  const at = knots.map(([t]) => t);
  const value = knots.map(([, v]) => v);
  const h = at.slice(1).map((t, i) => t - at[i]);
  const slope = h.map((dt, i) => (value[i + 1] - value[i]) / dt);
  const m = value.map((_, i) => {
    if (i === 0) return slope[0] / 2;
    if (i === n - 1) return slope[n - 2] / 2;
    if (slope[i - 1] * slope[i] <= 0) return 0;
    const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
    return (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
  });
  return (t) => {
    if (t <= at[0]) return value[0];
    if (t >= at[n - 1]) return value[n - 1];
    let i = 0;
    while (t > at[i + 1]) i++;
    const dt = h[i], s = (t - at[i]) / dt, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * value[i] + (s3 - 2 * s2 + s) * dt * m[i]
      + (-2 * s3 + 3 * s2) * value[i + 1] + (s3 - s2) * dt * m[i + 1];
  };
}
