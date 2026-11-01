import type { ReactNode } from "react";
import type { SimEvent } from "./sim/WhiteHoleSim";

export type Lang = "tr" | "en";

const STORAGE_KEY = "white-hole-lang";

export function detectLang(): Lang {
  const param = new URLSearchParams(window.location.search).get("lang");
  if (param === "tr" || param === "en") return param;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "tr" || saved === "en") return saved;
  } catch {
    // storage blocked (private mode etc.) — fall back to the browser language
  }
  return navigator.language?.toLowerCase().startsWith("tr") ? "tr" : "en";
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore
  }
}

interface Strings {
  pageTitle: string;
  kicker: string;
  titleA: string;
  titleB: string;
  subtitle: string;
  webglError: string;
  modes: Record<"single" | "wh-wh" | "wh-bh", string>;
  statDistance: string;
  statActive: string;
  statEjected: string;
  throwBtn: string;
  spaceKey: string;
  burstBtn: string;
  infoBtn: string;
  controls: string;
  flowSpeed: string;
  spin: string;
  timeScale: string;
  bloom: string;
  lensing: string;
  particles: string;
  jets: string;
  shockwaves: string;
  autoRotate: string;
  camera: string;
  camTop: string;
  camSide: string;
  camClose: string;
  camReset: string;
  resetDefaults: string;
  mouseHelp: string;
  keyHelp: string;
  events: Record<SimEvent, string>;
  info: {
    intro: ReactNode;
    whiteTitle: string;
    whiteItems: string[];
    blackTitle: string;
    blackItems: string[];
    gravity: ReactNode;
    whatYouSee: ReactNode;
    note: string;
  };
}

const b = (s: string) => <b className="text-white">{s}</b>;

export const STRINGS: Record<Lang, Strings> = {
  tr: {
    pageTitle: "Beyaz Delik — 3D Simülasyon",
    kicker: "3D Uzay-Zaman Simülasyonu",
    titleA: "Beyaz",
    titleB: "Delik",
    subtitle: "Hiçbir şeyin giremediği, yalnızca madde ve ışık fışkırtan uzay-zaman bölgesi.",
    webglError: "WebGL başlatılamadı. Lütfen WebGL destekleyen bir tarayıcı kullanın.",
    modes: { single: "Tek beyaz delik", "wh-wh": "Beyaz + beyaz", "wh-bh": "Beyaz + kara" },
    statDistance: "Kamera uzaklığı",
    statActive: "Aktif asteroit",
    statEjected: "Geri fırlatılan",
    throwBtn: "Asteroit Fırlat",
    spaceKey: "Boşluk",
    burstBtn: "Patlama",
    infoBtn: "Beyaz Delik Nedir?",
    controls: "Kontroller",
    flowSpeed: "Fışkırma hızı",
    spin: "Dönüş (spin)",
    timeScale: "Zaman akışı",
    bloom: "Parlaklık (bloom)",
    lensing: "Kütleçekimsel mercek",
    particles: "Parçacık sayısı",
    jets: "Kutup jetleri",
    shockwaves: "Şok dalgaları",
    autoRotate: "Otomatik dönüş",
    camera: "Kamera",
    camTop: "Üstten",
    camSide: "Yandan",
    camClose: "Yakın",
    camReset: "Sıfırla",
    resetDefaults: "Varsayılanlara dön",
    mouseHelp: "Fare: sürükle = döndür · tekerlek = yakınlaş · sağ tık = kaydır.",
    keyHelp: "H tuşu paneli gizler.",
    events: {
      throw: "☄️ Asteroit fırlatıldı — ufka doğru yol alıyor...",
      bounce: "🔥 Asteroit ufka ulaşamadı! Akkor halinde geri fırlatıldı",
      burst: "💥 Beyaz delik patlaması! Muazzam miktarda madde ve enerji salındı",
    },
    info: {
      intro: (
        <>
          {b("Beyaz delik")}, Einstein'ın genel görelilik denklemlerinin matematiksel olarak izin verdiği varsayımsal bir uzay-zaman
          bölgesidir. Bir <b className="text-orange-300">kara deliğin zamanda tersine çevrilmiş</b> hâlidir: kara delikten hiçbir şey
          kaçamazken, beyaz deliğe {b("hiçbir şey giremez")}; yalnızca madde ve ışık dışarı fışkırır.
        </>
      ),
      whiteTitle: "Beyaz Delik",
      whiteItems: ["Geçmiş olay ufku", "Madde dışarı akar", "Dışarıdan girilemez", "Aşırı parlak, mavi-beyaz"],
      blackTitle: "Kara Delik",
      blackItems: ["Gelecek olay ufku", "Madde içeri düşer", "İçeriden çıkılamaz", "Karanlık gölge + foton halkası"],
      gravity: (
        <>
          {b("İlginç bir detay:")} Beyaz deliğin dışındaki kütleçekimi bir kara deliğinkiyle aynıdır — yani çekicidir! Bir asteroit ona
          doğru hızlanarak düşer, ancak olay ufkuna asla ulaşamaz. Dışarı akan madde ve aşırı maviye kaymış ışınım onu ısıtır ve geri
          iter. Simülasyonda "Asteroit Fırlat" ile bunu deneyebilirsiniz.
        </>
      ),
      whatYouSee: (
        <>
          {b("Simülasyonda gördükleriniz:")} parlayan merkez (geçmiş olay ufku), dışarı doğru sarmal çizerek soğuyan ve renk değiştiren
          madde diski (mavi-beyaz → sarı → kırmızı), kutuplardan fışkıran jetler, periyodik şok dalgaları ve arka plandaki yıldızları
          büken {b("kütleçekimsel merceklenme")}.
        </>
      ),
      note: 'Not: Beyaz deliklerin varlığı hiçbir zaman gözlemlenmemiştir. Bazı teoriler, Büyük Patlama\'nın ya da kara deliklerin "son hâlinin" beyaz delik olabileceğini öne sürer. Bu simülasyon bilimsel fikirlerden ilham alan görsel bir yorumdur.',
    },
  },
  en: {
    pageTitle: "White Hole — 3D Simulation",
    kicker: "3D Spacetime Simulation",
    titleA: "White",
    titleB: "Hole",
    subtitle: "A region of spacetime that nothing can enter — it only pours out matter and light.",
    webglError: "WebGL could not be initialised. Please use a browser that supports WebGL.",
    modes: { single: "Single white hole", "wh-wh": "White + white", "wh-bh": "White + black" },
    statDistance: "Camera distance",
    statActive: "Active asteroids",
    statEjected: "Thrown back",
    throwBtn: "Throw Asteroid",
    spaceKey: "Space",
    burstBtn: "Burst",
    infoBtn: "What Is a White Hole?",
    controls: "Controls",
    flowSpeed: "Outflow speed",
    spin: "Rotation (spin)",
    timeScale: "Time flow",
    bloom: "Brightness (bloom)",
    lensing: "Gravitational lensing",
    particles: "Particle count",
    jets: "Polar jets",
    shockwaves: "Shock waves",
    autoRotate: "Auto-rotate",
    camera: "Camera",
    camTop: "Top",
    camSide: "Side",
    camClose: "Close",
    camReset: "Reset",
    resetDefaults: "Reset to defaults",
    mouseHelp: "Mouse: drag = orbit · wheel = zoom · right-click = pan.",
    keyHelp: "Press H to hide the panel.",
    events: {
      throw: "☄️ Asteroid thrown — heading for the horizon...",
      bounce: "🔥 The asteroid never reached the horizon! Hurled back red-hot",
      burst: "💥 White hole burst! A huge amount of matter and energy released",
    },
    info: {
      intro: (
        <>
          A {b("white hole")} is a hypothetical region of spacetime that Einstein's equations of general relativity allow
          mathematically. It is a <b className="text-orange-300">black hole reversed in time</b>: nothing can escape a black hole, and{" "}
          {b("nothing can enter")} a white hole — matter and light only stream out of it.
        </>
      ),
      whiteTitle: "White Hole",
      whiteItems: ["Past event horizon", "Matter flows out", "Cannot be entered from outside", "Extremely bright, blue-white"],
      blackTitle: "Black Hole",
      blackItems: ["Future event horizon", "Matter falls in", "Cannot be left from inside", "Dark shadow + photon ring"],
      gravity: (
        <>
          {b("A curious detail:")} the gravity outside a white hole is the same as outside a black hole — it attracts! An asteroid
          speeds up as it falls towards it, yet it never reaches the event horizon. The outflowing matter and strongly blueshifted
          radiation heat it up and push it back. Try it with "Throw Asteroid".
        </>
      ),
      whatYouSee: (
        <>
          {b("What you see in the simulation:")} the glowing centre (the past event horizon), a disk of matter that spirals outwards,
          cooling and changing colour (blue-white → yellow → red), jets bursting from the poles, periodic shock waves, and{" "}
          {b("gravitational lensing")} that bends the background stars.
        </>
      ),
      note: 'Note: no white hole has ever been observed. Some theories suggest that the Big Bang, or the "final state" of black holes, could be a white hole. This simulation is a visual interpretation inspired by scientific ideas.',
    },
  },
};
