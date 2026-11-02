/**
 * Test d'intégration : la base refuse deux réservations qui se chevauchent,
 * même si le contrôle applicatif était contourné (requêtes simultanées).
 * Nécessite DATABASE_URL (ignoré sinon).
 */
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

const enabled = !!process.env.DATABASE_URL;
const prisma = enabled ? new PrismaClient() : (null as unknown as PrismaClient);

describe.skipIf(!enabled)("contrainte anti-chevauchement (PostgreSQL)", () => {
  const tag = `test-${Date.now()}`;
  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { title: tag } });
    await prisma.room.deleteMany({ where: { name: tag } });
    await prisma.user.deleteMany({ where: { email: `${tag}@test.local` } });
    await prisma.$disconnect();
  });

  it("refuse un chevauchement mais accepte des créneaux contigus", async () => {
    const room = await prisma.room.create({ data: { name: tag, capacity: 2, color: "#000000" } });
    const user = await prisma.user.create({ data: { email: `${tag}@test.local`, name: "Test", passwordHash: "x" } });
    const mk = (s: string, e: string) =>
      prisma.booking.create({ data: { roomId: room.id, ownerId: user.id, title: tag, start: new Date(s), end: new Date(e) } });

    await mk("2030-01-07T09:00:00Z", "2030-01-07T10:00:00Z");
    await expect(mk("2030-01-07T09:30:00Z", "2030-01-07T10:30:00Z")).rejects.toThrow();
    // Contigu : autorisé (intervalle semi-ouvert [début, fin[)
    await expect(mk("2030-01-07T10:00:00Z", "2030-01-07T11:00:00Z")).resolves.toBeTruthy();
    // Requêtes simultanées : une seule passe
    const results = await Promise.allSettled([
      mk("2030-01-08T09:00:00Z", "2030-01-08T10:00:00Z"),
      mk("2030-01-08T09:00:00Z", "2030-01-08T10:00:00Z"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("libère le créneau après annulation", async () => {
    const room = await prisma.room.findUniqueOrThrow({ where: { name: tag } });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: `${tag}@test.local` } });
    const b = await prisma.booking.findFirstOrThrow({ where: { roomId: room.id, start: new Date("2030-01-07T09:00:00Z") } });
    await prisma.booking.update({ where: { id: b.id }, data: { status: "CANCELLED" } });
    await expect(
      prisma.booking.create({ data: { roomId: room.id, ownerId: user.id, title: tag, start: new Date("2030-01-07T09:00:00Z"), end: new Date("2030-01-07T10:00:00Z") } }),
    ).resolves.toBeTruthy();
  });
});
