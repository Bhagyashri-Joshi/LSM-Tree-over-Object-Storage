export function displayMetric(value: number | null, suffix = ''): string {
  return value === null ? '—' : `${value}${suffix}`
}
