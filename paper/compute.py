"""Numbers and figures for "Can white holes merge?".

Everything is in geometric units G = c = 1 unless a name ends in _SI.
Run:  python compute.py      (writes figures/*.pdf and results.json, prints the tables)

The model is the exact thin-null-shell construction of Barcelo, Carballo-Rubio & Garay
(JHEP 01 (2016) 157, arXiv:1511.00633), Eqs. (1)-(7): an exploding white hole of mass M
(outgoing null shell at retarded time u_out) and an ingoing null shell of mass dM at
advanced time v_in. All coordinates are those of the Schwarzschild region of mass M that
lies between the two shells before they cross.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

HERE = Path(__file__).parent
FIG = HERE / "figures"
FIG.mkdir(exist_ok=True)

# ---------------------------------------------------------------- constants (SI)
G = 6.67430e-11
C = 2.99792458e8
HBAR = 1.054571817e-34
M_SUN = 1.98892e30
M_PLANCK = math.sqrt(HBAR * C / G)  # 2.176e-8 kg
A_RAD = 7.565723e-16  # radiation constant, J m^-3 K^-4
T_CMB = 2.7255
U_CMB = A_RAD * T_CMB**4  # J m^-3


def lambert_w0(x: float) -> float:
    """Principal branch W0(x) for x >= 0 (Halley iteration, ~1e-15 relative)."""
    if x < 0:
        raise ValueError("only x >= 0 is needed here")
    if x == 0:
        return 0.0
    w = math.log1p(x) if x < 3 else math.log(x) - math.log(math.log(x))
    for _ in range(60):
        ew = math.exp(w)
        f = w * ew - x
        step = f / (ew * (w + 1) - (w + 2) * f / (2 * w + 2))
        w -= step
        if abs(step) < 1e-15 * max(1.0, abs(w)):
            break
    return w


# ---------------------------------------------------------------- core model
def crossing_w(M: float, dt: float) -> float:
    """w = r_c/2M - 1 at the crossing of the outgoing shell (u_out) and ingoing shell (v_in).

    dt = u_out - v_in. In the mass-M region, U = -exp(-u/4M), V = exp(v/4M) and
    UV = (1 - r/2M) exp(r/2M) (Barcelo et al. Eqs. 1-2), so w e^w = exp(-dt/4M - 1).
    Kept separate from r_c because 1 + w loses w entirely once w < 1e-16.
    """
    return lambert_w0(math.exp(-dt / (4 * M) - 1))


def crossing_radius(M: float, dt: float) -> float:
    return 2 * M * (1 + crossing_w(M, dt))


def mass_between_after(M: float, dM: float, w: float) -> float:
    """Barcelo et al. Eq. (4) with r_c = 2M(1+w), i.e. Delta r/2 = M w - dM (DTR relation)."""
    return (M + M * w) / (M * w) * dM


def escaping_energy(M: float, dM: float, dt: float) -> float:
    """Barcelo et al. Eq. (5): energy reaching infinity; zero once the crossing is trapped."""
    w = crossing_w(M, dt)
    if M * w <= dM:
        return 0.0
    return M + dM - mass_between_after(M, dM, w)


def eardley_lifetime(M: float, dM: float) -> float:
    """Largest u_out - v_in for which the white hole can still explode.

    From Eqs. (6)-(7): U_out < U_h  <=>  u_out - v_in < 4M [ln(M/dM) - 1 - dM/M].
    """
    return 4 * M * (math.log(M / dM) - 1 - dM / M)


def gw_inspiral_time(a: float, M: float, eta: float) -> float:
    """Peters (1964) circular-orbit merger time from separation a: (5/256) a^4 / (eta M^3)."""
    return 5.0 / 256.0 * a**4 / (eta * M**3)


def captured_fraction(M2: float, a: float) -> float:
    """Fraction of an isotropic burst at distance a that hits a hole of mass M2 (sigma = 27 pi M2^2)."""
    return 27 * M2**2 / (4 * a**2)


def critical_separation(tau: float, M: float, eta: float) -> float:
    """Separation whose GW inspiral time equals tau."""
    return (256.0 / 5.0 * eta * M**3 * tau) ** 0.25


# ---------------------------------------------------------------- perturbation estimates
def seconds_per_M(M_kg: float) -> float:
    return G * M_kg / C**3


def quantum_floor_ratio(M_kg: float) -> float:
    """dM/M for one quantum whose reduced wavelength equals the Schwarzschild radius.

    E = hbar c / r_s = hbar c^3 / (2 G M)  ->  dM = m_P^2 / (2 M).  Heuristic lower bound.
    """
    return M_PLANCK**2 / (2 * M_kg**2)


def cmb_ratio(M_kg: float) -> tuple[float, float]:
    """Self-consistent dM/M from CMB photons captured during one Eardley lifetime.

    Capture cross-section for photons sigma = 27 pi (GM/c^2)^2; dM c^2 = sigma u_CMB c tau.
    Returns (dM/M, tau in units of M).
    """
    rg = G * M_kg / C**2
    power = 27 * math.pi * rg**2 * U_CMB * C  # W
    ratio = 1e-40
    tau_M = 0.0
    for _ in range(100):
        tau_M = eardley_lifetime(1.0, ratio)
        new = power * tau_M * seconds_per_M(M_kg) / C**2 / M_kg
        if abs(math.log(new / ratio)) < 1e-12:
            ratio = new
            break
        ratio = new
    return ratio, eardley_lifetime(1.0, ratio)


# ---------------------------------------------------------------- self-checks
def self_checks() -> list[str]:
    out = []
    M = 1.0
    for dM in (1e-1, 1e-3, 1e-8, 1e-20):
        tau = eardley_lifetime(M, dM)
        rc = crossing_radius(M, tau)
        assert abs(rc - 2 * (M + dM)) < 1e-9 * 2 * (M + dM), (dM, rc)
        # DTR: f_bottom f_top = f_left f_right at a crossing outside the threshold
        rc2 = crossing_radius(M, tau - 8.0)
        Mb = mass_between_after(M, dM, crossing_w(M, tau - 8.0))
        lhs = (1 - 2 * M / rc2) * (1 - 2 * Mb / rc2)
        rhs = 1.0 * (1 - 2 * (M + dM) / rc2)
        assert abs(lhs - rhs) < 1e-12, (lhs, rhs)
        # exact balance M_inf = M - dM/w (paper Eq. 7)
        w2 = crossing_w(M, tau - 8.0)
        assert abs(escaping_energy(M, dM, tau - 8.0) - (M - dM / w2)) < 1e-12
        # energy bookkeeping: escaping energy tends to M for early crossings
        assert abs(escaping_energy(M, dM, -400.0) - M) < 2 * dM + 1e-6
        # universal near-threshold profile for dM << M: M_inf/M ~ 1 - exp((dt - tau)/4M)
        if dM < 1e-6:
            for x in (-30.0, -10.0, -2.0):
                approx = 1 - math.exp(x / 4)
                assert abs(escaping_energy(M, dM, tau + x) - approx) < 1e-5, (dM, x)
    out.append("threshold r_c(tau_E) = 2(M+dM): ok")
    out.append("universal profile M_inf/M = 1 - exp((dt-tau_E)/4M) for dM << M: ok (<1e-5)")
    out.append("DTR identity f_b f_t = f_l f_r: ok (|err| < 1e-12)")
    out.append("exact balance M_inf = M - dM/w: ok")
    out.append("early-crossing limit M_inf -> M: ok")
    # asymptotics tau ~ 4M ln(M/dM) for dM << M
    r = eardley_lifetime(1.0, 1e-30) / (4 * math.log(1e30))
    out.append(f"tau_E / (4M ln(M/dM)) at dM/M=1e-30: {r:.4f}")
    # Peters: a_crit inverts t_GW
    a = critical_separation(500.0, 1.0, 0.25)
    assert abs(gw_inspiral_time(a, 1.0, 0.25) - 500.0) < 1e-9
    out.append("a_crit inverts t_GW: ok")
    return out


# ---------------------------------------------------------------- figures
plt.rcParams.update({
    "font.family": "serif",
    "font.size": 9,
    "axes.linewidth": 0.6,
    "lines.linewidth": 1.3,
    "figure.dpi": 150,
    "savefig.bbox": "tight",
})
COLORS = ["#1f4e79", "#c0504d", "#4f8f3a", "#8064a2"]


def fig_no_half_measures():
    fig, ax = plt.subplots(figsize=(3.4, 2.5))
    for col, k in zip(COLORS, (2, 6, 12, 20)):
        dM = 10.0**-k
        tau = eardley_lifetime(1.0, dM)
        x = np.linspace(tau - 40, tau + 6, 900)
        y = [escaping_energy(1.0, dM, t) for t in x]
        ax.plot(x - tau, y, color=col, label=rf"$\Delta M/M=10^{{-{k}}}$  ($\tau_E={tau:.0f}M$)")
    xs = np.linspace(-40, 0, 200)
    ax.plot(xs, 1 - np.exp(xs / 4), color="k", ls="--", lw=0.8, label=r"$1-e^{(\Delta t-\tau_E)/4M}$")
    ax.axvline(0, color="0.5", lw=0.6, ls=":")
    ax.set_xlabel(r"$(u_{\rm out}-v_{\rm in}-\tau_E)/M$")
    ax.set_ylabel(r"$M_\infty/M$")
    ax.set_ylim(-0.03, 1.05)
    ax.legend(fontsize=6.5, frameon=False, loc="lower left")
    fig.savefig(FIG / "escape_fraction.pdf")
    plt.close(fig)


def fig_lifetime(rows):
    fig, ax = plt.subplots(figsize=(3.4, 2.5))
    x = np.logspace(-100, -1, 400)
    ax.semilogx(x, [eardley_lifetime(1.0, v) for v in x], color=COLORS[0], label=r"exact $\tau_E$")
    ax.semilogx(x, 4 * np.log(1 / x), color="0.55", ls="--", lw=0.9, label=r"$4M\ln(M/\Delta M)$")
    marks = {"10 Msun": "o", "4.3e6 Msun": "s", "6.5e9 Msun": "^"}
    for row in rows:
        if row["name"] in marks:
            ax.plot(row["cmb_ratio"], row["cmb_tau_M"], marks[row["name"]], ms=4, color=COLORS[1],
                    mfc="none", label=f"CMB, {row['label']}")
            ax.plot(row["q_ratio"], row["q_tau_M"], marks[row["name"]], ms=4, color=COLORS[2],
                    label=f"one quantum, {row['label']}")
    ax.set_xlabel(r"$\Delta M/M$")
    ax.set_ylabel(r"$\tau_E/M$")
    ax.legend(fontsize=5.6, frameon=False, ncol=1, loc="upper right")
    fig.savefig(FIG / "lifetime.pdf")
    plt.close(fig)


def fig_binary(tau_lo, tau_hi):
    fig, ax = plt.subplots(figsize=(3.4, 2.5))
    a = np.linspace(4, 60, 400)
    for col, (eta, lab) in zip(COLORS, ((0.25, r"$q=1$"), (2 / 9, r"$q=1/2$"), (0.1 / 1.21, r"$q=1/10$"))):
        ax.semilogy(a, gw_inspiral_time(a, 1.0, eta), color=col, label=lab)
    ax.axhspan(tau_lo, tau_hi, color=COLORS[1], alpha=0.15, lw=0)
    ax.text(13, math.sqrt(tau_lo * tau_hi), r"$\tau_E$ range", fontsize=7, va="center", color=COLORS[1])
    ax.axvline(6, color="0.5", lw=0.6, ls=":")
    ax.text(6.4, 2e6, "ISCO", fontsize=6.5, color="0.4")
    ax.set_xlabel(r"separation $a/M$")
    ax.set_ylabel(r"$t_{\rm GW}/M$")
    ax.set_xlim(4, 60)
    ax.set_ylim(10, 1e8)
    ax.legend(fontsize=7, frameon=False, loc="lower right")
    fig.savefig(FIG / "binary.pdf")
    plt.close(fig)


# ---------------------------------------------------------------- main
def main():
    for line in self_checks():
        print("check:", line)

    masses = [
        ("10 Msun", r"$10\,M_\odot$", 10 * M_SUN),
        ("4.3e6 Msun", r"$4.3\times10^{6}\,M_\odot$", 4.3e6 * M_SUN),
        ("6.5e9 Msun", r"$6.5\times10^{9}\,M_\odot$", 6.5e9 * M_SUN),
    ]
    rows = []
    for name, label, Mkg in masses:
        q = quantum_floor_ratio(Mkg)
        cmb, cmb_tau = cmb_ratio(Mkg)
        tq = eardley_lifetime(1.0, q)
        rows.append(dict(
            name=name, label=label, M_kg=Mkg, t_M_s=seconds_per_M(Mkg),
            q_ratio=q, q_tau_M=tq, q_tau_s=tq * seconds_per_M(Mkg),
            cmb_ratio=cmb, cmb_tau_M=cmb_tau, cmb_tau_s=cmb_tau * seconds_per_M(Mkg),
        ))

    print("\nTable 1: Eardley lifetimes")
    print(f"{'mass':>12} {'GM/c^3 [s]':>11} {'dM/M (1q)':>10} {'tau/M':>7} {'tau [s]':>10} "
          f"{'dM/M CMB':>10} {'tau/M':>7} {'tau [s]':>10}")
    for r in rows:
        print(f"{r['name']:>12} {r['t_M_s']:11.3e} {r['q_ratio']:10.2e} {r['q_tau_M']:7.0f} {r['q_tau_s']:10.3e} "
              f"{r['cmb_ratio']:10.2e} {r['cmb_tau_M']:7.0f} {r['cmb_tau_s']:10.3e}")

    # binary: the longest lifetime in the table (one quantum on the heaviest hole) is the
    # most favourable case for a white hole to survive until merger
    tau_hi = max(max(r["q_tau_M"], r["cmb_tau_M"]) for r in rows)
    tau_lo = min(r["cmb_tau_M"] for r in rows)
    print("\nTable 2: critical separations a_crit/M (t_GW(a_crit) = tau_E)")
    binary = []
    for q in (1.0, 0.5, 0.1):
        eta = q / (1 + q) ** 2
        lo, hi = critical_separation(tau_lo, 1, eta), critical_separation(tau_hi, 1, eta)
        P_hi = 2 * math.pi * hi**1.5
        binary.append(dict(q=q, eta=eta, a_lo=lo, a_hi=hi, period_hi=P_hi))
        print(f"q={q:4}: eta={eta:.4f}  a_crit = {lo:5.2f}M (tau={tau_lo:.0f}M) .. "
              f"{hi:5.2f}M (tau={tau_hi:.0f}M); orbital period at a_crit,hi = {P_hi:.0f}M")
    # how long a 10 Msun + 10 Msun binary from 100 M or 1000 M takes, vs tau
    for a0 in (20.0, 100.0, 1000.0):
        print(f"  q=1, a0={a0:.0f}M: t_GW = {gw_inspiral_time(a0, 1, 0.25):.3e} M")

    # domino: white hole 1 explodes with its full mass; the share caught by white hole 2
    # acts as dM on it
    print("\nTable 3: companion sealed by the first explosion (q=1, M1=M2=M/2)")
    domino = []
    for a in (10.0, 20.0, 100.0, 1000.0):
        f = captured_fraction(0.5, a)
        ratio = f * 0.5 / 0.5
        tau2 = eardley_lifetime(1.0, ratio)  # in units of M2
        domino.append(dict(a=a, captured=f, dM_over_M2=ratio, tau_over_M2=tau2))
        print(f"  a={a:6.0f}M: captured {f:.2e}, dM/M2 = {ratio:.2e}, tau_E = {tau2:5.1f} M2")

    fig_no_half_measures()
    fig_lifetime(rows)
    fig_binary(tau_lo, tau_hi)

    (HERE / "results.json").write_text(json.dumps(
        {"lifetimes": rows, "binary": binary, "domino": domino, "tau_lo_M": tau_lo, "tau_hi_M": tau_hi,
         "u_cmb_J_m3": U_CMB, "m_planck_kg": M_PLANCK}, indent=2))
    print("\nfigures written to", FIG)


if __name__ == "__main__":
    main()
