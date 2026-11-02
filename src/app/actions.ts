"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession, getCurrentUser, requireUser } from "@/lib/auth";
import { cancelBooking, createBooking, updateBooking, type ActionResult } from "@/lib/bookings";
import { hashPassword, passwordPolicyError, verifyPassword } from "@/lib/password";
import { optionalStr, str, type FormState } from "@/lib/forms";
import { parisToUtc } from "@/lib/time";

// ---------------------------------------------------------------------------
// Connexion
// ---------------------------------------------------------------------------

/** Limitation simple des tentatives : 5 échecs → blocage 15 min (par e-mail, en mémoire). */
const failures = new Map<string, { count: number; until: number }>();
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email").toLowerCase();
  const password = str(form, "password");
  if (!email || !password) return { ok: false, error: "Saisissez votre e-mail et votre mot de passe." };

  const state = failures.get(email);
  if (state && state.count >= MAX_FAILURES && state.until > Date.now()) {
    return { ok: false, error: "Trop de tentatives. Réessayez dans 15 minutes." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user && user.active && (await verifyPassword(password, user.passwordHash));
  if (!valid) {
    const count = (state && state.until > Date.now() ? state.count : 0) + 1;
    failures.set(email, { count, until: Date.now() + LOCK_MS });
    return { ok: false, error: "E-mail ou mot de passe incorrect." };
  }

  failures.delete(email);
  await createSession(user.id);
  redirect(user.mustChangePassword ? "/mot-de-passe" : "/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser({ allowPasswordChange: true });
  const current = str(form, "current");
  const next = str(form, "next");
  const confirm = str(form, "confirm");

  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(current, row.passwordHash))) {
    return { ok: false, error: "Mot de passe actuel incorrect." };
  }
  const policy = passwordPolicyError(next);
  if (policy) return { ok: false, error: policy };
  if (next !== confirm) return { ok: false, error: "Les deux mots de passe ne correspondent pas." };
  if (next === current) return { ok: false, error: "Le nouveau mot de passe doit être différent de l'actuel." };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next), mustChangePassword: false },
  });
  redirect("/");
}

// ---------------------------------------------------------------------------
// Réservations
// ---------------------------------------------------------------------------

function slotFrom(form: FormData): { start: Date; end: Date } | null {
  try {
    const date = str(form, "date");
    return { start: parisToUtc(date, str(form, "startTime")), end: parisToUtc(date, str(form, "endTime")) };
  } catch {
    return null;
  }
}

export async function createBookingAction(form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return { ok: false, error: "Session expirée, reconnectez-vous." };
  const slot = slotFrom(form);
  if (!slot) return { ok: false, error: "Date ou heure invalide." };
  const repeat = str(form, "repeat") === "weekly";
  if (repeat && !str(form, "repeatUntil")) return { ok: false, error: "Indiquez la date de fin de la récurrence." };
  const result = await createBooking(user, {
    roomId: str(form, "roomId"),
    ...slot,
    title: optionalStr(form, "title"),
    repeatUntil: repeat ? str(form, "repeatUntil") || null : null,
    ownerId: optionalStr(form, "ownerId") ?? undefined,
  });
  revalidatePath("/");
  return result;
}

export async function updateBookingAction(form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return { ok: false, error: "Session expirée, reconnectez-vous." };
  const slot = slotFrom(form);
  if (!slot) return { ok: false, error: "Date ou heure invalide." };
  const result = await updateBooking(user, {
    id: str(form, "id"),
    roomId: str(form, "roomId"),
    ...slot,
    title: optionalStr(form, "title"),
  });
  revalidatePath("/");
  return result;
}

export async function cancelBookingAction(id: string, scope: "one" | "following"): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return { ok: false, error: "Session expirée, reconnectez-vous." };
  const result = await cancelBooking(user, id, scope === "following" ? "following" : "one");
  revalidatePath("/");
  revalidatePath("/mes-reservations");
  revalidatePath("/admin/reservations");
  return result;
}
