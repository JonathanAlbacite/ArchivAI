// Clears all user data from the database but keeps the things the site needs to run.
//
// Run by hand from server/ (never runs on server start):
//   npm run reset-users              - shows what will be deleted, then asks you to confirm
//   npm run reset-users -- --dry-run - only shows the counts, deletes nothing
//   npm run reset-users -- --delete-files - also deletes the uploaded lesson files and campaign attachments
//
// DELETED: every teacher and student account, and all their data - rooms, room members, campaigns,
// clues, answers, additional notes, play sessions and attempts, checkpoint progress (world state,
// journal), lesson modules and their generated clues, chat history, and saved character loadouts.
//
// KEPT: the admin account(s) (and their character loadout), Environments, vault templates and their
// slots, and character sets. Nothing is re-seeded - there is nothing to restore, so it works on the
// live database as it is.
//
// SAFETY: it prints which database it is about to change. A local database asks for "RESET". Any other
// host (e.g. Railway) asks you to type the database name instead.

import readline from "node:readline/promises";
import fs from "node:fs/promises";
import prisma from "../lib/prisma.js";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const DELETE_FILES = args.includes("--delete-files");

// Reads host and database name from DATABASE_URL, without the password.
function describeDatabase() {
  try {
    const url = new URL(process.env.DATABASE_URL);
    return { host: url.hostname, name: url.pathname.replace(/^\//, "") };
  } catch {
    return { host: "(unknown)", name: "(unknown)" };
  }
}

// Every table that gets emptied, in the order it is deleted (children before parents).
const TABLES = [
  ["Play attempts", () => prisma.sessionAttempt],
  ["Play sessions", () => prisma.campaignSession],
  ["Checkpoint progress", () => prisma.campaignProgress],
  ["Lesson file reads", () => prisma.campaignRead],
  ["Room members", () => prisma.roomStudent],
  ["Additional notes", () => prisma.standaloneNote],
  ["Clue answers", () => prisma.clueAnswer],
  ["Clues", () => prisma.clue],
  ["Campaigns", () => prisma.campaign],
  ["Rooms", () => prisma.room],
  ["Generated clues", () => prisma.generatedClue],
  ["Lesson modules", () => prisma.lessonModule],
  ["Chat messages", () => prisma.chatMessage],
  ["Chat conversations", () => prisma.chatConversation],
];

async function countAll() {
  const rows = [];
  for (const [label, model] of TABLES) {
    rows.push([label, await model().count()]);
  }
  rows.push(["Character loadouts (non-admin)", await prisma.characterLoadout.count({ where: { user: { role: { not: "ADMIN" } } } })]);
  rows.push(["User accounts (non-admin)", await prisma.user.count({ where: { role: { not: "ADMIN" } } })]);
  return rows;
}

async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

async function main() {
  const db = describeDatabase();
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(db.host);

  console.log(`\nDatabase: ${db.name} on ${db.host}${isLocal ? " (local)" : "  <-- NOT LOCAL"}\n`);

  const counts = await countAll();
  console.log("Will delete:");
  for (const [label, n] of counts) console.log(`  ${label.padEnd(34)} ${n}`);

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true } });
  console.log(`\nKept: ${admins.length} admin account(s) (${admins.map((a) => a.email).join(", ") || "none"}), environments, vault templates, character sets.`);
  console.log(DELETE_FILES ? "Uploaded lesson files and campaign attachments: WILL be deleted." : "Uploaded lesson files and campaign attachments: kept (use --delete-files to remove them).");

  if (DRY_RUN) {
    console.log("\nDry run - nothing was deleted.");
    return;
  }

  const expected = isLocal ? "RESET" : db.name;
  const typed = await ask(`\nType ${expected} to continue, or anything else to cancel: `);
  if (typed !== expected) {
    console.log("Cancelled - nothing was deleted.");
    return;
  }

  // Collect the file paths first, since the rows holding them are deleted below.
  let filePaths = [];
  if (DELETE_FILES) {
    const modules = await prisma.lessonModule.findMany({ select: { filePath: true } });
    const campaigns = await prisma.campaign.findMany({ where: { attachmentPath: { not: null } }, select: { attachmentPath: true } });
    filePaths = [...modules.map((m) => m.filePath), ...campaigns.map((c) => c.attachmentPath)].filter(Boolean);
  }

  // All or nothing: if any step fails, the database is left exactly as it was.
  await prisma.$transaction(
    async (tx) => {
      // A room points at its live campaign; clear that first so the campaigns can go.
      await tx.room.updateMany({ data: { activeCampaignId: null } });

      await tx.sessionAttempt.deleteMany();
      await tx.campaignSession.deleteMany();
      await tx.campaignProgress.deleteMany();
      await tx.campaignRead.deleteMany();
      await tx.roomStudent.deleteMany();
      await tx.standaloneNote.deleteMany();
      await tx.clueAnswer.deleteMany();
      await tx.clue.deleteMany();
      await tx.campaign.deleteMany();
      await tx.room.deleteMany();
      await tx.generatedClue.deleteMany();
      await tx.lessonModule.deleteMany();
      await tx.chatMessage.deleteMany();
      await tx.chatConversation.deleteMany();
      await tx.characterLoadout.deleteMany({ where: { user: { role: { not: "ADMIN" } } } });
      await tx.user.deleteMany({ where: { role: { not: "ADMIN" } } });
    },
    { timeout: 60000 }
  );

  let removedFiles = 0;
  for (const p of filePaths) {
    try {
      await fs.unlink(p);
      removedFiles++;
    } catch {
      // already gone - nothing to do
    }
  }

  console.log("\nDone. All user data was deleted.");
  if (DELETE_FILES) console.log(`Uploaded files removed: ${removedFiles} of ${filePaths.length}.`);
  console.log("Tip: log out in the browser and clear the site data so old logins and saved checkpoints don't linger.");
}

main()
  .catch((err) => {
    console.error("Reset failed - nothing was changed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
