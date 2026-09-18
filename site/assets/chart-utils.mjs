export const formatAbundance = (n) =>
  !Number.isFinite(n)
    ? "Not available"
    : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
export const matchesTypes = (type, selected) =>
  selected.size === 0 || selected.has(type);
// Area follows log2(1 + size), with a visible minimum and an 8 px radius cap.
export const pointRadius = (weight, width, zoom) =>
  weight <= 0
    ? 0
    : Math.min(
        8,
        Math.max(0.9, 1.4 * Math.sqrt(Math.log1p(weight) / Math.LN2)),
      ) *
      (width / 500) *
      Math.sqrt(zoom);
