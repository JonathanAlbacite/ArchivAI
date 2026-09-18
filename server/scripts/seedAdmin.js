// One-off script that creates (or resets the password of) the single admin
// account used to sign in to /admin. There's no admin self-registration -
// this is the only way that account gets created.
//
// Run once from server/:
//   node scripts/seedAdmin.js
//
// Safe to re-run: it upserts on email, so running it again just re-hashes
// and resets the password to the same value below.

import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";

const ADMIN_EMAIL = "fergusjerome@archivist.admin";
const ADMIN_PASSWORD = "password";
const ADMIN_NAME = "Admin";

async function main() {
  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { password: hashed, role: "ADMIN" },
    create: { name: ADMIN_NAME, email: ADMIN_EMAIL, password: hashed, role: "ADMIN" },
  });

  console.log(`Admin account ready: ${admin.email} (id ${admin.id})`);
}

main()
  .catch((err) => {
    console.error("Failed to seed admin account:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
