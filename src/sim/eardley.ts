// Formulas from paper/white-hole-binaries.tex, in geometric units G = c = 1 (lengths and times in M).
// paper/compute.py is the reference implementation; keep the two in step.

/** Eardley lifetime, Eq. (6): the latest the white hole can explode after a shell dM falls in. */
export function eardleyLifetime(M: number, dM: number): number {
  return 4 * M * (Math.log(M / dM) - 1 - dM / M);
}

/** Peters (1964) circular-orbit decay da/dt for total mass M and symmetric mass ratio eta. */
export function petersDadt(a: number, M: number, eta: number): number {
  return (-64 / 5) * (eta * M ** 3) / a ** 3;
}

/** Peters merger time from separation a, Eq. (9). */
export function inspiralTime(a: number, M: number, eta: number): number {
  return ((5 / 256) * a ** 4) / (eta * M ** 3);
}

/** Share of an isotropic burst at distance a that a hole of mass m captures (sigma = 27 pi m^2). */
export function capturedFraction(m: number, a: number): number {
  return Math.min(1, (27 * m * m) / (4 * a * a));
}

/** GM/c^3 in seconds per solar mass. */
export const SECONDS_PER_MSUN = 4.925490947e-6;
