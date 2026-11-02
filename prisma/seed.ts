import { PrismaClient } from "@prisma/client";
import { generateTemporaryPassword, hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

const ROOMS = [
  { name: "Box 1", capacity: 2, color: "#57cbbb", sortOrder: 1 },
  { name: "Box 2", capacity: 2, color: "#f8ac16", sortOrder: 2 },
  { name: "Petite salle", capacity: 6, color: "#044589", sortOrder: 3 },
  { name: "Grande salle", capacity: 12, color: "#015959", sortOrder: 4 },
];

async function main() {
  for (const room of ROOMS) {
    await prisma.room.upsert({ where: { name: room.name }, update: {}, create: room });
  }
  console.log(`✔ ${ROOMS.length} salles présentes`);

  const email = (process.env.SEED_ADMIN_EMAIL || "a.texier@sicaap.com").toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✔ Administrateur ${email} déjà présent (inchangé)`);
    return;
  }
  const password = process.env.SEED_ADMIN_PASSWORD || generateTemporaryPassword();
  await prisma.user.create({
    data: {
      email,
      name: process.env.SEED_ADMIN_NAME || "Administrateur SICAAP",
      role: "ADMIN",
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
    },
  });
  console.log(`✔ Administrateur créé : ${email}`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`  Mot de passe provisoire : ${password}  (à changer à la première connexion)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
