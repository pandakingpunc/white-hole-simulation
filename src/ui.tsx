import type { ReactNode } from "react";
import type { Lang } from "./i18n";

export interface ViewProps {
  lang: Lang;
  setLang: (l: Lang) => void;
  modeTabs: ReactNode;
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
  keepCase,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
  keepCase?: boolean; // labels with symbols like q = m₂/m₁ must not be upper-cased
}) {
  return (
    <label className="block">
      <div className={`flex justify-between text-[11px] text-slate-400 mb-1 ${keepCase ? "" : "uppercase tracking-wider"}`}>
        <span>{label}</span>
        <span className="text-slate-200 font-mono">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-sky-300 h-1 cursor-pointer"
      />
    </label>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex items-center justify-between w-full text-sm text-slate-300 py-1 group"
    >
      <span>{label}</span>
      <span
        className={`w-9 h-5 rounded-full relative transition-colors ${value ? "bg-sky-400/80" : "bg-slate-700"}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${value ? "left-[18px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

export function LangButton({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <button
      onClick={() => setLang(lang === "tr" ? "en" : "tr")}
      title={lang === "tr" ? "Switch to English" : "Türkçeye geç"}
      className="px-2.5 py-1.5 rounded-lg bg-black/30 hover:bg-white/10 backdrop-blur-md border border-white/10 text-xs font-mono tracking-wider whitespace-nowrap"
    >
      <span className={lang === "tr" ? "text-white" : "text-slate-500"}>TR</span>
      <span className="text-slate-600"> / </span>
      <span className={lang === "en" ? "text-white" : "text-slate-500"}>EN</span>
    </button>
  );
}
