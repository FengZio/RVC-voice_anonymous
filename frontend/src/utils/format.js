export function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(4) : 'unavailable';
}
