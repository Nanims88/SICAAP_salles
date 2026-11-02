/** Utilitaires de couleur : lisibilité du texte sur un fond (contraste WCAG). */

export const TEXT_DARK = "#2f3e47";
export const TEXT_LIGHT = "#ffffff";

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Couleur de texte (blanc ou gris anthracite de la charte) la plus lisible sur le fond donné. */
export function readableTextOn(background: string): string {
  return contrastRatio(background, TEXT_LIGHT) >= contrastRatio(background, TEXT_DARK) ? TEXT_LIGHT : TEXT_DARK;
}

/** Palette de la charte SICAAP, proposée dans l'administration des salles. */
export const BRAND_PALETTE = [
  "#015959", "#57cbbb", "#f8ac16",
  "#044589", "#0b3159", "#0086ff", "#6c8ead",
  "#149972", "#18614c", "#7bbdaa", "#85d4b1",
  "#e3ba02", "#ffdc20", "#8c6151", "#aa6e3f", "#2f3e47",
];
