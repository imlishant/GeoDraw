// One place for every numeric tolerance. Tolerances are relative to the magnitude
// of the numbers involved, and never depend on zoom (see PLAN.md §6.1).

/** Relative tolerance for tangency / parallel decisions. */
export const REL = 1e-9;
/** Relative tolerance for "these two points are the same point". */
export const COINCIDE_REL = 1e-7;

export function magnitude(...xs: number[]): number {
  let m = 1;
  for (const x of xs) {
    const a = Math.abs(x);
    if (a > m && Number.isFinite(a)) m = a;
  }
  return m;
}

export const tol = (...xs: number[]): number => REL * magnitude(...xs);
export const coincideTol = (...xs: number[]): number => COINCIDE_REL * magnitude(...xs);

export function samePoint(ax: number, ay: number, bx: number, by: number): boolean {
  return Math.hypot(ax - bx, ay - by) <= coincideTol(ax, ay, bx, by);
}
