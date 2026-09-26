export function formatNumber(v: number, decimals: number): string {
  const s = v.toFixed(decimals);
  return s === `-${(0).toFixed(decimals)}` ? s.slice(1) : s;
}
