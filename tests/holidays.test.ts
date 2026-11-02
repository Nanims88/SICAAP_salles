import { describe, expect, it } from "vitest";
import { easterSunday, frenchHolidays, holidayName } from "@/lib/holidays";

describe("jours fériés", () => {
  it("calcule Pâques (dates de référence)", () => {
    expect(easterSunday(2024)).toEqual({ month: 3, day: 31 });
    expect(easterSunday(2025)).toEqual({ month: 4, day: 20 });
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 });
    expect(easterSunday(2027)).toEqual({ month: 3, day: 28 });
  });

  it("liste les 11 jours fériés français de 2026", () => {
    const h = frenchHolidays(2026);
    expect(h.size).toBe(11);
    expect(h.get("2026-04-06")).toBe("Lundi de Pâques");
    expect(h.get("2026-05-14")).toBe("Ascension");
    expect(h.get("2026-05-25")).toBe("Lundi de Pentecôte");
    expect(h.get("2026-11-11")).toBe("Armistice 1918");
  });

  it("reconnaît un jour non férié", () => {
    expect(holidayName("2026-11-03")).toBeNull();
    expect(holidayName("2026-12-25")).toBe("Noël");
  });
});
