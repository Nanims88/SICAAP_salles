import { describe, expect, it } from "vitest";
import { weeklyOccurrences } from "@/lib/recurrence";
import { parisTime, parisToUtc } from "@/lib/time";

describe("récurrence hebdomadaire", () => {
  it("génère une occurrence par semaine jusqu'à la date incluse", () => {
    const occ = weeklyOccurrences(
      { start: parisToUtc("2026-11-02", "10:00"), end: parisToUtc("2026-11-02", "11:00") },
      "2026-11-23",
    );
    expect(occ).toHaveLength(4);
    expect(occ[3].start.toISOString()).toBe(parisToUtc("2026-11-23", "10:00").toISOString());
  });

  it("conserve l'heure locale lors du passage à l'heure d'été", () => {
    const occ = weeklyOccurrences(
      { start: parisToUtc("2027-03-22", "10:00"), end: parisToUtc("2027-03-22", "11:00") },
      "2027-04-05",
    );
    expect(occ.map((o) => parisTime(o.start))).toEqual(["10:00", "10:00", "10:00"]);
  });

  it("refuse plus de 26 semaines", () => {
    expect(() =>
      weeklyOccurrences({ start: parisToUtc("2026-11-02", "10:00"), end: parisToUtc("2026-11-02", "11:00") }, "2027-11-01"),
    ).toThrow(/26 semaines/);
  });

  it("refuse une date de fin antérieure", () => {
    expect(() =>
      weeklyOccurrences({ start: parisToUtc("2026-11-02", "10:00"), end: parisToUtc("2026-11-02", "11:00") }, "2026-10-01"),
    ).toThrow();
  });
});
