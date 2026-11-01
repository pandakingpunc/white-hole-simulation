import type { ReactNode } from "react";
import type { Lang } from "./i18n";
import type { BinaryEvent, BinaryStats, BodyKind } from "./sim/BinarySim";

export const PAPER_URL = "https://github.com/pandakingpunc/white-hole-simulation/blob/main/paper/white-hole-binaries.pdf";

type CollisionMode = "wh-wh" | "wh-bh";

interface BinaryStrings {
  kicker: string;
  title: Record<CollisionMode, [string, string]>;
  subtitle: Record<CollisionMode, string>;
  statTime: string;
  statSep: string;
  body: (i: number) => string;
  kind: Record<BodyKind, string>;
  deadline: string;
  phase: Record<BinaryStats["phase"], string>;
  finalMass: string;
  a0: string;
  q: string;
  logDM: string;
  selfExplode: string;
  tExplode: string;
  instability: string;
  speed: string;
  restart: string;
  info: string;
  paper: string;
  aCrit: string;
  events: Record<BinaryEvent, string>;
  infoTitle: string;
  infoBody: ReactNode;
}

const b = (s: string) => <b className="text-white">{s}</b>;

export const BINARY_STRINGS: Record<Lang, BinaryStrings> = {
  tr: {
    kicker: "Çarpışma modu · makaledeki formülle",
    title: { "wh-wh": ["Beyaz delik", "çifti"], "wh-bh": ["Beyaz delik +", "kara delik"] },
    subtitle: {
      "wh-wh": "İki beyaz delik birbirine dolanıyor. Birleşmeye yetişebilirler mi?",
      "wh-bh": "Bir beyaz delik bir kara deliğe dolanıyor. Beyaz delik dayanabilir mi?",
    },
    statTime: "Zaman",
    statSep: "Ayrım a",
    body: (i) => `Cisim ${i + 1}`,
    kind: { white: "beyaz delik", black: "kara delik", gone: "patladı", merged: "birleşti" },
    deadline: "son tarih",
    phase: {
      inspiral: "Dolanım",
      single: "Tek cisim kaldı",
      merged: "Birleşti: tek kara delik",
      contact: "Ufuklar değdi: bilinen çözüm yok",
      empty: "İkisi de patladı",
    },
    finalMass: "Son kütle",
    a0: "Başlangıç ayrımı a₀ (M)",
    q: "Kütle oranı q = m₂/m₁",
    logDM: "Düşen madde log₁₀(ΔM/m)",
    selfExplode: "1. cisim kendiliğinden patlasın",
    tExplode: "Patlama zamanı (M)",
    instability: "Eardley kararsızlığı",
    speed: "Oynatma hızı",
    restart: "Yeniden başlat",
    info: "Bu mod nedir?",
    paper: "Makale (PDF)",
    aCrit: "Birleşmeye yetişmek için a ≤",
    events: {
      sealed: "🕳️ Beyaz delik mühürlendi: üstünde biriken madde onu kara deliğe çevirdi",
      exploded: "💥 Beyaz delik patladı ve yok oldu",
      domino: "⚡ Patlamanın enkazı eşine çarpacak: onun süresi kısaldı",
      merged: "🌊 İki kara delik birleşti, kütleçekim dalgası yayıldı",
      contact: "⚠️ Beyaz delik ufku başka bir ufka değdi: genel görelilikte bunun bilinen bir çözümü yok",
    },
    infoTitle: "Beyaz delikler çarpışabilir mi?",
    infoBody: (
      <>
        <p>
          Beyaz deliğe hiçbir şey giremez ama kütleçekimi çekicidir. Üstüne düşen madde ufkun hemen önünde birikir ve onu
          {b(" kara deliğe çevirir")} (Eardley kararsızlığı). Makalede bunun ne kadar sürdüğünü kesin olarak hesapladık:
        </p>
        <p className="font-mono text-sky-200 text-center">τ_E = 4m [ ln(m/ΔM) − 1 − ΔM/m ]</p>
        <p>
          Logaritma yüzünden ΔM ne kadar küçük olursa olsun süre kısa kalır: yıldız kütleli bir beyaz delik için yüzde birkaç
          saniye. İkili sistemin kütleçekim dalgasıyla birleşmesi çok daha uzun sürer. Bu yüzden beyaz delikler
          {b(" ya birleşmeden patlar ya da kara delik olarak birleşir")}. Biri patlarsa enkazı eşini hemen mühürler (domino). İki
          beyaz delik ufku zaten tek bir beyaz delik olarak birleşemez (zamanda ters çevrilmiş alan teoremi).
        </p>
        <p className="text-slate-500 text-xs">
          Bu modda yalnızca patlama ve mühürlenme zamanları makaledeki formülden gelir. Yörünge, Peters hızıyla küçülen Newton
          çemberidir; görüntüler temsilidir. Eardley kararsızlığını kapatırsan varsayımsal &quot;kararlı&quot; beyaz delikleri
          görürsün: ufuklar değince simülasyon durur, çünkü bunun bilinen bir çözümü yok.
        </p>
      </>
    ),
  },
  en: {
    kicker: "Collision mode · timed by the paper's formula",
    title: { "wh-wh": ["White hole", "pair"], "wh-bh": ["White hole +", "black hole"] },
    subtitle: {
      "wh-wh": "Two white holes orbit each other. Can they make it to merger?",
      "wh-bh": "A white hole orbits a black hole. Can the white hole hold out?",
    },
    statTime: "Time",
    statSep: "Separation a",
    body: (i) => `Body ${i + 1}`,
    kind: { white: "white hole", black: "black hole", gone: "exploded", merged: "merged" },
    deadline: "deadline",
    phase: {
      inspiral: "Inspiral",
      single: "One body left",
      merged: "Merged: a single black hole",
      contact: "Horizons touched: no known solution",
      empty: "Both exploded",
    },
    finalMass: "Final mass",
    a0: "Initial separation a₀ (M)",
    q: "Mass ratio q = m₂/m₁",
    logDM: "Infalling matter log₁₀(ΔM/m)",
    selfExplode: "Body 1 explodes on its own",
    tExplode: "Explosion time (M)",
    instability: "Eardley instability",
    speed: "Playback speed",
    restart: "Restart",
    info: "What is this mode?",
    paper: "Paper (PDF)",
    aCrit: "To reach merger, a ≤",
    events: {
      sealed: "🕳️ White hole sealed: matter piling up on it turned it into a black hole",
      exploded: "💥 The white hole exploded and is gone",
      domino: "⚡ The burst will hit its partner: the partner's deadline just got shorter",
      merged: "🌊 The two black holes merged and sent out a gravitational wave",
      contact: "⚠️ A white-hole horizon touched another horizon: general relativity has no known solution for this",
    },
    infoTitle: "Can white holes collide?",
    infoBody: (
      <>
        <p>
          Nothing can enter a white hole, yet its gravity attracts. Matter falling towards it piles up just outside the horizon and
          {b(" turns it into a black hole")} (Eardley's instability). The paper computes exactly how long that takes:
        </p>
        <p className="font-mono text-sky-200 text-center">τ_E = 4m [ ln(m/ΔM) − 1 − ΔM/m ]</p>
        <p>
          Because of the logarithm the time stays short however small ΔM is: a few hundredths of a second for a stellar-mass white
          hole. A binary takes far longer to merge through gravitational waves. So white holes{" "}
          {b("either explode before merging or merge as black holes")}. If one explodes, its debris seals its partner almost at once
          (the domino effect). Two white-hole horizons cannot merge into one white hole anyway (the time-reversed area theorem).
        </p>
        <p className="text-slate-500 text-xs">
          In this mode only the explosion and sealing times come from the paper's formula. The orbit is a Newtonian circle shrinking at
          the Peters rate, and the visuals are illustrative. Switch off Eardley's instability to see hypothetical &quot;stable&quot;
          white holes: the simulation stops when the horizons touch, because there is no known solution for that.
        </p>
      </>
    ),
  },
};
