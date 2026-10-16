// Общие данные об износе CS2: границы флоата и подписи. Без зависимостей, работает и на сервере, и в браузере.
export const WEAR_RANGES = [
  { key: "FN", name: "Factory New", from: 0, to: 0.07, color: "#2ee59d" },
  { key: "MW", name: "Minimal Wear", from: 0.07, to: 0.15, color: "#8be04e" },
  { key: "FT", name: "Field-Tested", from: 0.15, to: 0.38, color: "#ffb020" },
  { key: "WW", name: "Well-Worn", from: 0.38, to: 0.45, color: "#ff7a45" },
  { key: "BS", name: "Battle-Scarred", from: 0.45, to: 1, color: "#ff5470" },
] as const;

export function wearOf(float: number) {
  return WEAR_RANGES.find((w) => float < w.to) ?? WEAR_RANGES[WEAR_RANGES.length - 1];
}

export function fmtFloat(f?: number | null) {
  return f == null ? "—" : f.toFixed(8).replace(/0+$/, "").replace(/\.$/, ".0");
}
