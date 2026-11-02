import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type Booking, type Room, type User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildIcs, type IcsMethod } from "@/lib/ics";
import { sendMail, senderAddress } from "@/lib/mailer";
import { weeklyOccurrences, type Occurrence } from "@/lib/recurrence";
import { validateSlot, type ClosureLike } from "@/lib/rules";
import { dbDateToKey, formatDateLong, parisDateKey, parisTime } from "@/lib/time";
import type { CurrentUser } from "@/lib/auth";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export class BookingError extends Error {}

const OVERLAP_CONSTRAINT = "Booking_no_overlap";

/** Détecte la violation de la contrainte d'exclusion (code PostgreSQL 23P01). */
export function isOverlapError(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err);
  if (text.includes(OVERLAP_CONSTRAINT) || text.includes("23P01")) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return JSON.stringify(err.meta ?? {}).includes(OVERLAP_CONSTRAINT);
  }
  return false;
}

async function loadClosures(): Promise<ClosureLike[]> {
  const rows = await prisma.closure.findMany();
  return rows.map((c) => ({
    roomId: c.roomId,
    startDate: dbDateToKey(c.startDate),
    endDate: dbDateToKey(c.endDate),
    reason: c.reason,
  }));
}

async function findConflict(roomId: string, start: Date, end: Date, excludeId?: string) {
  return prisma.booking.findFirst({
    where: {
      roomId,
      status: "CONFIRMED",
      start: { lt: end },
      end: { gt: start },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    include: { owner: { select: { name: true } } },
  });
}

function describeSlot(start: Date, end: Date): string {
  return `${formatDateLong(parisDateKey(start))}, de ${parisTime(start)} à ${parisTime(end)}`;
}

export function canManage(user: CurrentUser, booking: Pick<Booking, "ownerId">): boolean {
  return user.role === "ADMIN" || booking.ownerId === user.id;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

function summaryOf(room: Room, title: string | null): string {
  return title ? `${room.name} – ${title}` : `Réservation ${room.name}`;
}

async function notify(
  method: IcsMethod,
  owner: Pick<User, "email" | "name">,
  room: Room,
  subject: string,
  text: string,
  event: { uid: string; start: Date; end: Date; title: string | null; weeklyUntil?: Date; exdates?: Date[]; recurrenceId?: Date },
) {
  const ics = buildIcs(method, {
    uid: event.uid,
    start: event.start,
    end: event.end,
    weeklyUntil: event.weeklyUntil,
    exdates: event.exdates,
    recurrenceId: event.recurrenceId,
    summary: summaryOf(room, event.title),
    location: `${room.name} (SICAAP)`,
    description: event.title ?? undefined,
    organizerEmail: senderAddress(),
    attendeeEmail: owner.email,
    attendeeName: owner.name,
  });
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await sendMail({
    to: owner.email,
    subject,
    text: `Bonjour ${owner.name},\n\n${text}\n\nPlanning : ${appUrl}\n\n— Réservation des salles SICAAP`,
    ics: { method, content: ics },
  });
}

function uidFor(b: Pick<Booking, "id" | "seriesId">): string {
  return `${b.seriesId ?? b.id}@sicaap-salles`;
}

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

export interface CreateBookingInput {
  roomId: string;
  start: Date;
  end: Date;
  title: string | null;
  /** Date de fin de récurrence hebdomadaire "AAAA-MM-JJ" (incluse), ou null. */
  repeatUntil: string | null;
  /** Réservation au nom d'un autre utilisateur (admins uniquement). */
  ownerId?: string;
}

export async function createBooking(user: CurrentUser, input: CreateBookingInput): Promise<ActionResult> {
  const room = await prisma.room.findFirst({ where: { id: input.roomId, active: true } });
  if (!room) return { ok: false, error: "Salle introuvable ou désactivée." };

  const ownerId = user.role === "ADMIN" && input.ownerId ? input.ownerId : user.id;
  const owner = await prisma.user.findFirst({ where: { id: ownerId, active: true } });
  if (!owner) return { ok: false, error: "Utilisateur introuvable." };

  const ctx = { now: new Date(), closures: await loadClosures(), isAdmin: user.role === "ADMIN" };
  const first: Occurrence = { start: input.start, end: input.end };

  // Le premier créneau doit être valide, sinon on refuse directement.
  const firstErrors = validateSlot({ roomId: room.id, ...first }, ctx);
  if (firstErrors.length) return { ok: false, error: firstErrors.join(" ") };

  let occurrences: Occurrence[] = [first];
  const skipped: { occ: Occurrence; reason: string }[] = [];
  if (input.repeatUntil) {
    try {
      const all = weeklyOccurrences(first, input.repeatUntil);
      occurrences = [];
      for (const occ of all) {
        const errs = validateSlot({ roomId: room.id, ...occ }, ctx);
        if (errs.length) skipped.push({ occ, reason: errs.join(" ") });
        else occurrences.push(occ);
      }
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  // Les chevauchements bloquent la création (aucune occurrence n'est créée).
  const conflicts: string[] = [];
  for (const occ of occurrences) {
    const c = await findConflict(room.id, occ.start, occ.end);
    if (c) conflicts.push(`${describeSlot(c.start, c.end)} (réservé par ${c.owner.name})`);
  }
  if (conflicts.length) {
    return { ok: false, error: `Créneau déjà réservé : ${conflicts.join(" ; ")}.` };
  }

  const seriesId = input.repeatUntil && occurrences.length > 1 ? randomUUID() : null;
  let createdRows: Booking[];
  try {
    createdRows = await prisma.$transaction(
      occurrences.map((occ) =>
        prisma.booking.create({
          data: {
            roomId: room.id,
            ownerId: owner.id,
            title: input.title,
            start: occ.start,
            end: occ.end,
            seriesId,
            originalStart: seriesId ? occ.start : null,
          },
        }),
      ),
    );
  } catch (err) {
    if (isOverlapError(err)) {
      return { ok: false, error: "Ce créneau vient d'être réservé par quelqu'un d'autre. Actualisez le planning." };
    }
    throw err;
  }

  const last = occurrences[occurrences.length - 1];
  const skippedText = skipped.length
    ? `\n\nDates non réservées :\n${skipped.map((s) => `- ${formatDateLong(parisDateKey(s.occ.start))} : ${s.reason}`).join("\n")}`
    : "";
  if (seriesId) {
    await notify(
      "REQUEST",
      owner,
      room,
      `Réservation confirmée : ${room.name}, chaque semaine`,
      `Votre réservation récurrente de « ${room.name} » est confirmée : chaque semaine de ${parisTime(first.start)} à ${parisTime(first.end)}, du ${formatDateLong(parisDateKey(occurrences[0].start))} au ${formatDateLong(parisDateKey(last.start))} (${occurrences.length} occurrences).${skippedText}`,
      {
        uid: `${seriesId}@sicaap-salles`,
        start: occurrences[0].start,
        end: occurrences[0].end,
        title: input.title,
        weeklyUntil: last.end,
        exdates: skipped.map((s) => s.occ.start).filter((d) => d > occurrences[0].start && d < last.start),
      },
    );
  } else {
    const created = createdRows[0];
    await notify(
      "REQUEST",
      owner,
      room,
      `Réservation confirmée : ${room.name}`,
      `Votre réservation de « ${room.name} » est confirmée : ${describeSlot(created.start, created.end)}.${skippedText}`,
      { uid: uidFor(created), start: created.start, end: created.end, title: created.title },
    );
  }

  const message = seriesId
    ? `${occurrences.length} réservations créées.${skipped.length ? ` ${skipped.length} date(s) ignorée(s) (jour férié, fermeture ou hors délai).` : ""}`
    : "Réservation confirmée.";
  return { ok: true, message };
}

// ---------------------------------------------------------------------------
// Modification (une occurrence)
// ---------------------------------------------------------------------------

export interface UpdateBookingInput {
  id: string;
  roomId: string;
  start: Date;
  end: Date;
  title: string | null;
}

export async function updateBooking(user: CurrentUser, input: UpdateBookingInput): Promise<ActionResult> {
  const booking = await prisma.booking.findUnique({ where: { id: input.id }, include: { owner: true } });
  if (!booking || booking.status !== "CONFIRMED") return { ok: false, error: "Réservation introuvable." };
  if (!canManage(user, booking)) return { ok: false, error: "Vous ne pouvez modifier que vos propres réservations." };
  if (booking.end < new Date()) return { ok: false, error: "Une réservation terminée ne peut plus être modifiée." };

  const room = await prisma.room.findFirst({ where: { id: input.roomId, active: true } });
  if (!room) return { ok: false, error: "Salle introuvable ou désactivée." };

  const errors = validateSlot(
    { roomId: room.id, start: input.start, end: input.end },
    { now: new Date(), closures: await loadClosures(), isAdmin: user.role === "ADMIN" },
  );
  if (errors.length) return { ok: false, error: errors.join(" ") };

  const conflict = await findConflict(room.id, input.start, input.end, booking.id);
  if (conflict) {
    return { ok: false, error: `Créneau déjà réservé par ${conflict.owner.name} (${describeSlot(conflict.start, conflict.end)}).` };
  }

  try {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { roomId: room.id, start: input.start, end: input.end, title: input.title },
    });
  } catch (err) {
    if (isOverlapError(err)) return { ok: false, error: "Ce créneau vient d'être réservé. Actualisez le planning." };
    throw err;
  }

  await notify(
    "REQUEST",
    booking.owner,
    room,
    `Réservation modifiée : ${room.name}`,
    `Votre réservation a été modifiée : « ${room.name} », ${describeSlot(input.start, input.end)}.`,
    {
      uid: uidFor(booking),
      start: input.start,
      end: input.end,
      title: input.title,
      recurrenceId: booking.seriesId ? booking.originalStart ?? booking.start : undefined,
    },
  );
  return { ok: true, message: "Réservation modifiée." };
}

// ---------------------------------------------------------------------------
// Annulation
// ---------------------------------------------------------------------------

export async function cancelBooking(
  user: CurrentUser,
  id: string,
  scope: "one" | "following",
): Promise<ActionResult> {
  const booking = await prisma.booking.findUnique({ where: { id }, include: { owner: true, room: true } });
  if (!booking || booking.status !== "CONFIRMED") return { ok: false, error: "Réservation introuvable." };
  if (!canManage(user, booking)) return { ok: false, error: "Vous ne pouvez annuler que vos propres réservations." };
  if (booking.end < new Date()) return { ok: false, error: "Une réservation terminée ne peut plus être annulée." };

  const byAdmin = booking.ownerId !== user.id ? `\n\nAnnulation effectuée par ${user.name}.` : "";

  if (scope === "following" && booking.seriesId) {
    const { count } = await prisma.booking.updateMany({
      where: { seriesId: booking.seriesId, status: "CONFIRMED", start: { gte: booking.start } },
      data: { status: "CANCELLED" },
    });
    const remaining = await prisma.booking.findMany({
      where: { seriesId: booking.seriesId, status: "CONFIRMED" },
      orderBy: { start: "asc" },
    });
    if (remaining.length === 0) {
      await notify("CANCEL", booking.owner, booking.room, `Réservation annulée : ${booking.room.name}, chaque semaine`,
        `Votre réservation récurrente de « ${booking.room.name} » a été annulée.${byAdmin}`,
        { uid: uidFor(booking), start: booking.start, end: booking.end, title: booking.title });
    } else {
      // Mise à jour de la série dans l'agenda : elle s'arrête à la dernière occurrence conservée.
      const firstRemaining = remaining[0];
      const lastRemaining = remaining[remaining.length - 1];
      await notify("REQUEST", booking.owner, booking.room, `Réservation récurrente raccourcie : ${booking.room.name}`,
        `Les occurrences à partir du ${formatDateLong(parisDateKey(booking.start))} ont été annulées (${count}). La série se termine désormais le ${formatDateLong(parisDateKey(lastRemaining.start))}.${byAdmin}`,
        { uid: uidFor(booking), start: firstRemaining.originalStart ?? firstRemaining.start,
          end: new Date((firstRemaining.originalStart ?? firstRemaining.start).getTime() + (firstRemaining.end.getTime() - firstRemaining.start.getTime())),
          title: booking.title, weeklyUntil: lastRemaining.end });
    }
    return { ok: true, message: `${count} réservation(s) annulée(s).` };
  }

  await prisma.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
  await notify(
    "CANCEL",
    booking.owner,
    booking.room,
    `Réservation annulée : ${booking.room.name}`,
    `Votre réservation de « ${booking.room.name} » du ${describeSlot(booking.start, booking.end)} a été annulée.${byAdmin}`,
    {
      uid: uidFor(booking),
      start: booking.start,
      end: booking.end,
      title: booking.title,
      recurrenceId: booking.seriesId ? booking.originalStart ?? booking.start : undefined,
    },
  );
  return { ok: true, message: "Réservation annulée." };
}
