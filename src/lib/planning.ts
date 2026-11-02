import "server-only";
import { prisma } from "@/lib/db";
import { holidayName } from "@/lib/holidays";
import { canManage } from "@/lib/bookings";
import type { CurrentUser } from "@/lib/auth";
import { addDaysToKey, dbDateToKey, formatDateShort, keyToDbDate, parisToUtc } from "@/lib/time";

export interface PlanningRoom { id: string; name: string; capacity: number; color: string }
export interface PlanningBooking {
  id: string;
  roomId: string;
  start: string;
  end: string;
  ownerName: string;
  /** null si l'utilisateur n'a pas le droit de voir l'objet. */
  title: string | null;
  mine: boolean;
  canManage: boolean;
  isSeries: boolean;
}
export interface PlanningDay {
  key: string;
  label: string;
  holiday: string | null;
  closures: { roomId: string | null; reason: string }[];
}
export interface PlanningData {
  weekStart: string;
  days: PlanningDay[];
  rooms: PlanningRoom[];
  bookings: PlanningBooking[];
  users: { id: string; name: string }[];
  now: string;
}

/** Données de la semaine (lundi → vendredi) pour l'utilisateur courant. */
export async function loadWeek(user: CurrentUser, weekStart: string): Promise<PlanningData> {
  const dayKeys = [0, 1, 2, 3, 4].map((i) => addDaysToKey(weekStart, i));
  const from = parisToUtc(dayKeys[0], "00:00");
  const to = parisToUtc(addDaysToKey(weekStart, 7), "00:00");

  const [rooms, bookings, closures, users] = await Promise.all([
    prisma.room.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.booking.findMany({
      where: { status: "CONFIRMED", start: { lt: to }, end: { gt: from } },
      include: { owner: { select: { name: true } } },
      orderBy: { start: "asc" },
    }),
    prisma.closure.findMany({
      where: { startDate: { lte: keyToDbDate(dayKeys[4]) }, endDate: { gte: keyToDbDate(dayKeys[0]) } },
    }),
    user.role === "ADMIN"
      ? prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  return {
    weekStart,
    rooms: rooms.map(({ id, name, capacity, color }) => ({ id, name, capacity, color })),
    days: dayKeys.map((key) => ({
      key,
      label: formatDateShort(key),
      holiday: holidayName(key),
      closures: closures
        .filter((c) => dbDateToKey(c.startDate) <= key && key <= dbDateToKey(c.endDate))
        .map((c) => ({ roomId: c.roomId, reason: c.reason })),
    })),
    bookings: bookings.map((b) => {
      const manage = canManage(user, b);
      return {
        id: b.id,
        roomId: b.roomId,
        start: b.start.toISOString(),
        end: b.end.toISOString(),
        ownerName: b.owner.name,
        // Règle de visibilité : seuls l'auteur et les admins voient l'objet.
        title: manage ? b.title : null,
        mine: b.ownerId === user.id,
        canManage: manage,
        isSeries: b.seriesId !== null,
      };
    }),
    users,
    now: new Date().toISOString(),
  };
}
