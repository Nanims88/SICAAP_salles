import { describe, expect, it } from "vitest";
import { contrastRatio, readableTextOn, TEXT_DARK, TEXT_LIGHT } from "@/lib/color";

describe("lisibilité des couleurs de la charte", () => {
  it("choisit le texte foncé sur les couleurs claires (Orange, Turquoise)", () => {
    expect(readableTextOn("#f8ac16")).toBe(TEXT_DARK);
    expect(readableTextOn("#57cbbb")).toBe(TEXT_DARK);
  });

  it("choisit le texte blanc sur les couleurs foncées (Vert Abysse, Bleu)", () => {
    expect(readableTextOn("#015959")).toBe(TEXT_LIGHT);
    expect(readableTextOn("#044589")).toBe(TEXT_LIGHT);
  });

  it("garantit un contraste d'au moins 4,5:1 (WCAG AA) pour les 4 salles", () => {
    for (const c of ["#57cbbb", "#f8ac16", "#044589", "#015959"]) {
      expect(contrastRatio(c, readableTextOn(c))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
