"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { sendMail } from "@/lib/mailer";
import { generateTemporaryPassword, hashPassword } from "@/lib/password";
import { optionalStr, str } from "@/lib/forms";
import { keyToDbDate } from "@/lib/time";

export type AdminState = { ok: true; message: string; password?: string } | { ok: false; error: string } | null;

function back(path: string, error?: string): never {
  revalidatePath(path);
  revalidatePath("/");
  redirect(error ? `${path}?erreur=${encodeURIComponent(error)}` : path);
}

// ---------------------------------------------------------------------------
// Salles
// ---------------------------------------------------------------------------

const roomSchema = z.object({
  name: z.string().min(1, "Nom obligatoire.").max(60),
  capacity: z.coerce.number().int().min(1, "Capacité invalide.").max(500),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide."),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export async function saveRoomAction(form: FormData): Promise<void> {
  await requireAdmin();
  const parsed = roomSchema.safeParse({
    name: str(form, "name"),
    capacity: str(form, "capacity"),
    color: str(form, "color"),
    sortOrder: str(form, "sortOrder") || 0,
  });
  if (!parsed.success) back("/admin/salles", parsed.error.issues[0].message);
  const id = str(form, "id");
  const active = form.get("active") === "on";
  try {
    if (id) await prisma.room.update({ where: { id }, data: { ...parsed.data, active } });
    else await prisma.room.create({ data: { ...parsed.data, active: true } });
  } catch {
    back("/admin/salles", "Une salle porte déjà ce nom.");
  }
  back("/admin/salles");
}

// ---------------------------------------------------------------------------
// Fermetures
// ---------------------------------------------------------------------------

export async function addClosureAction(form: FormData): Promise<void> {
  await requireAdmin();
  const startDate = str(form, "startDate");
  const endDate = str(form, "endDate") || startDate;
  const reason = str(form, "reason").slice(0, 120);
  const roomId = optionalStr(form, "roomId");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    back("/admin/fermetures", "Dates invalides.");
  }
  if (endDate < startDate) back("/admin/fermetures", "La date de fin doit suivre la date de début.");
  if (!reason) back("/admin/fermetures", "Indiquez un motif.");
  await prisma.closure.create({
    data: { startDate: keyToDbDate(startDate), endDate: keyToDbDate(endDate), reason, roomId },
  });
  back("/admin/fermetures");
}

export async function deleteClosureAction(form: FormData): Promise<void> {
  await requireAdmin();
  await prisma.closure.deleteMany({ where: { id: str(form, "id") } });
  back("/admin/fermetures");
}

// ---------------------------------------------------------------------------
// Utilisateurs
// ---------------------------------------------------------------------------

async function sendWelcome(email: string, name: string, password: string, reset: boolean) {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await sendMail({
    to: email,
    subject: reset ? "Réinitialisation de votre mot de passe" : "Votre accès à la réservation des salles SICAAP",
    text: `Bonjour ${name},\n\n${reset ? "Votre mot de passe a été réinitialisé." : "Un compte vous a été créé."}\n\nAdresse : ${appUrl}\nIdentifiant : ${email}\nMot de passe provisoire : ${password}\n\nVous devrez le changer à la première connexion.\n\n— Réservation des salles SICAAP`,
  });
}

export async function createUserAction(_prev: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const email = str(form, "email").toLowerCase();
  const name = str(form, "name").slice(0, 80);
  const role = str(form, "role") === "ADMIN" ? "ADMIN" : "USER";
  if (!z.string().email().safeParse(email).success) return { ok: false, error: "E-mail invalide." };
  if (!name) return { ok: false, error: "Nom obligatoire." };
  if (await prisma.user.findUnique({ where: { email } })) return { ok: false, error: "Cet e-mail existe déjà." };

  const password = generateTemporaryPassword();
  await prisma.user.create({
    data: { email, name, role, passwordHash: await hashPassword(password), mustChangePassword: true },
  });
  await sendWelcome(email, name, password, false);
  revalidatePath("/admin/utilisateurs");
  return { ok: true, message: `Compte créé pour ${name}.`, password };
}

export async function resetPasswordAction(_prev: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: str(form, "id") } });
  if (!user) return { ok: false, error: "Utilisateur introuvable." };
  const password = generateTemporaryPassword();
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), mustChangePassword: true } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);
  await sendWelcome(user.email, user.name, password, true);
  return { ok: true, message: `Nouveau mot de passe provisoire pour ${user.name}.`, password };
}

export async function updateUserAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = str(form, "id");
  const role = str(form, "role") === "ADMIN" ? "ADMIN" : "USER";
  const active = form.get("active") === "on";
  const name = str(form, "name").slice(0, 80);
  if (!name) back("/admin/utilisateurs", "Nom obligatoire.");
  if (id === admin.id && (!active || role !== "ADMIN")) {
    back("/admin/utilisateurs", "Vous ne pouvez pas retirer vos propres droits d'administrateur ni désactiver votre compte.");
  }
  await prisma.user.update({ where: { id }, data: { role, active, name } });
  if (!active) await prisma.session.deleteMany({ where: { userId: id } });
  back("/admin/utilisateurs");
}
