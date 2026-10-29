// Creates (or resets the password of) the single admin account used to sign in to /admin. There's
// no admin self-registration - this is the only way that account gets created.
//
// Runs automatically on every server startup (see index.js, via scripts/seedAll.js) - a fresh
// clone needs no separate manual step for this. Still runnable by hand from server/ if you ever
// need to force it without restarting the server:
//   node scripts/seedAdmin.js
//
// Safe to re-run: it upserts on email, so running it again just re-hashes
// and resets the password to the same value below.

import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";

const ADMIN_EMAIL = "fergusjerome@archivist.admin";
const ADMIN_PASSWORD = "password";
const ADMIN_NAME = "Admin";

export async function seedAdmin() {
  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { password: hashed, role: "ADMIN" },
    create: { name: ADMIN_NAME, email: ADMIN_EMAIL, password: hashed, role: "ADMIN" },
  });

  console.log(`Admin account ready: ${admin.email} (id ${admin.id})`);
  return admin;
}

// Only runs this when the file is executed directly (`node scripts/seedAdmin.js`), not when
// scripts/seedAll.js imports `seedAdmin` from it - an import must never disconnect the shared
// Prisma client the rest of the running server is still using.
if (import.meta.url === `file://${process.argv[1]}`) {
  seedAdmin()
    .catch((err) => {
      console.error("Failed to seed admin account:", err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
