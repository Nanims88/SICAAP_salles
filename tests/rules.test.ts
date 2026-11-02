import { describe, expect, it } from "vitest";
import { maxBookingDateKey, validateSlot } from "@/lib/rules";
import { parisToUtc } from "@/lib/time";

const NOW = parisToUtc("2026-11-02", "09:10"); // lundi 2 novembre 2026, 9h10
const ctx = { now: NOW, closures: [] };
const slot = (date: string, s: string, e: string, roomId = "r1") => ({
  roomId, start: parisToUtc(date, s), end: parisToUtc(date, e),
});

describe("règles de réservation", () => {
  it("accepte un créneau valide", () => {
    expect(validateSlot(slot("2026-11-03", "10:00", "11:30"), ctx)).toEqual([]);
  });

  it("accepte la journée entière 8h–19h", () => {
    expect(validateSlot(slot("2026-11-03", "08:00", "19:00"), ctx)).toEqual([]);
  });

  it("refuse une fin avant le début", () => {
    expect(validateSlot(slot("2026-11-03", "11:00", "10:00"), ctx)[0]).toMatch(/après/);
  });

  it("refuse hors des heures d'ouverture", () => {
    expect(validateSlot(slot("2026-11-03", "07:30", "09:00"), ctx).join()).toMatch(/de 8h à 19h/);
    expect(validateSlot(slot("2026-11-03", "18:00", "19:30"), ctx).join()).toMatch(/de 8h à 19h/);
  });

  it("refuse les créneaux non alignés sur 30 min", () => {
    expect(validateSlot(slot("2026-11-03", "10:15", "11:00"), ctx).join()).toMatch(/30 minutes/);
  });

  it("refuse le week-end", () => {
    expect(validateSlot(slot("2026-11-07", "10:00", "11:00"), ctx).join()).toMatch(/lundi au vendredi/);
  });

  it("refuse un jour férié", () => {
    expect(validateSlot(slot("2026-11-11", "10:00", "11:00"), ctx).join()).toMatch(/Armistice/);
  });

  it("refuse un créneau passé, y compris déjà commencé", () => {
    expect(validateSlot(slot("2026-11-02", "08:00", "09:00"), ctx).join()).toMatch(/passé/);
    expect(validateSlot(slot("2026-11-02", "09:00", "10:00"), ctx).join()).toMatch(/passé/);
    expect(validateSlot(slot("2026-11-02", "09:30", "10:00"), ctx)).toEqual([]);
  });

  it("limite à 3 mois à l'avance, sauf pour les admins", () => {
    expect(maxBookingDateKey(NOW)).toBe("2027-02-02");
    expect(validateSlot(slot("2027-02-01", "10:00", "11:00"), ctx)).toEqual([]);
    expect(validateSlot(slot("2027-02-02", "10:00", "11:00"), ctx).join()).toMatch(/3 mois/);
    expect(validateSlot(slot("2027-02-02", "10:00", "11:00"), { ...ctx, isAdmin: true })).toEqual([]);
  });

  it("applique les fermetures (une salle ou toutes)", () => {
    const closures = [
      { roomId: "r1", startDate: "2026-11-04", endDate: "2026-11-05", reason: "Travaux" },
      { roomId: null, startDate: "2026-11-13", endDate: "2026-11-13", reason: "Séminaire" },
    ];
    const c = { ...ctx, closures };
    expect(validateSlot(slot("2026-11-05", "10:00", "11:00", "r1"), c).join()).toMatch(/Travaux/);
    expect(validateSlot(slot("2026-11-05", "10:00", "11:00", "r2"), c)).toEqual([]);
    expect(validateSlot(slot("2026-11-13", "10:00", "11:00", "r2"), c).join()).toMatch(/Séminaire/);
  });

  it("gère l'heure de Paris en été comme en hiver", () => {
    // 10h à Paris = 8h UTC en été, 9h UTC en hiver
    expect(parisToUtc("2026-07-01", "10:00").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(parisToUtc("2026-12-01", "10:00").toISOString()).toBe("2026-12-01T09:00:00.000Z");
  });
});
