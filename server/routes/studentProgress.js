// studentProgress.js
//
// Progress tracking for the website:
//   GET /api/campaigns/:id/student-progress - TEACHER (owner of the room) or ADMIN: how every student
//        of the room is doing on one campaign (see the "Student progress" page, Figure 16 of the paper).
//   GET /api/campaigns/:id/results/history  - any logged-in user: their own finished runs of the
//        campaign, newest first (see the "Previous attempts" card on the results page).
//
// Where the numbers come from (nothing new is stored by the game for this):
//   - A finished run is a CampaignSession row: time, rank, mistakes, checkpoints, and one entry per lock.
//   - A student still playing is the CampaignProgress row (status IN_PROGRESS): the checkpoints reached,
//     the clues found, and the game's world state from the LAST CHECKPOINT (locks solved and the run time).
//     So for a student who is playing, the time and the locks only change when a checkpoint is reached.
//   - Clues found are saved only while a run is in progress; the website clears them when the run is
//     finished, so they are not shown for a finished run.

import express from "express";
import prisma from "../lib/prisma.js";
import { protect, teacherOnly } from "../middleware/auth.js";
import {
  bestOf,
  completionPercent,
  percentOf,
  readLockResults,
  readWorldState,
  summarizeSession,
  trendOf,
} from "../lib/progressStats.js";

const router = express.Router();

const HARDEST_LOCKS_SHOWN = 5;

// Teacher or admin: how each student of the room is doing on one campaign.
router.get("/campaigns/:id/student-progress", protect, teacherOnly, async (req, res) => {
  const campaignId = parseInt(req.params.id);
  if (!Number.isInteger(campaignId)) return res.status(400).json({ message: "Invalid campaign id" });

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        room: {
          select: {
            id: true,
            name: true,
            teacherId: true,
            students: {
              orderBy: { joinedAt: "asc" },
              include: { student: { select: { id: true, name: true, email: true } } },
            },
          },
        },
      },
    });

    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.room.teacherId !== req.user.id) return res.status(403).json({ message: "Access denied" });

    const [sessions, progressRows] = await Promise.all([
      prisma.campaignSession.findMany({
        where: { campaignId, completedAt: { not: null } },
        orderBy: [{ completedAt: "asc" }, { id: "asc" }],
      }),
      prisma.campaignProgress.findMany({ where: { campaignId } }),
    ]);

    // How many checkpoints the campaign has: the game reports it with every finished run, so it is
    // only known once someone has finished. Until then the checkpoint part is left out of the percentage.
    const checkpointsTotal = sessions.reduce((max, s) => (Number.isInteger(s.checkpointsTotal) && s.checkpointsTotal > max ? s.checkpointsTotal : max), 0) || null;

    // What the lock ids stand for (their order and type), learned from the finished runs.
    const lockInfo = new Map();
    for (const s of sessions) {
      for (const l of readLockResults(s.lockResults)) {
        if (l.id && !lockInfo.has(l.id)) lockInfo.set(l.id, { order: l.order, type: l.type });
      }
    }

    const sessionsByStudent = new Map();
    for (const s of sessions) {
      if (!sessionsByStudent.has(s.studentId)) sessionsByStudent.set(s.studentId, []);
      sessionsByStudent.get(s.studentId).push(s);
    }
    const progressByStudent = new Map(progressRows.map((p) => [p.studentId, p]));

    // Per lock, across the class: what each student's current locks look like.
    const lockStats = new Map();
    const addLocks = (locks) => {
      for (const l of locks) {
        if (!l.id) continue;
        const stat = lockStats.get(l.id) || { id: l.id, wrongAttempts: 0, studentsWithMistakes: 0, solvedBy: 0, outOf: 0 };
        stat.outOf += 1;
        stat.wrongAttempts += l.attempts;
        if (l.attempts > 0) stat.studentsWithMistakes += 1;
        if (l.isSolved) stat.solvedBy += 1;
        lockStats.set(l.id, stat);
      }
    };

    const students = campaign.room.students.map(({ student }) => {
      const own = sessionsByStudent.get(student.id) || [];
      const progress = progressByStudent.get(student.id) || null;
      const attemptsOldestFirst = own.map((s, i) => summarizeSession(s, i + 1));
      const { bestRank, bestTime } = bestOf(attemptsOldestFirst);

      const playing = progress?.status === "IN_PROGRESS";
      const state = playing ? "inProgress" : own.length > 0 || progress ? "completed" : "notStarted";

      let current = null; // the run the percentage, time and clues belong to
      let locksForStats = [];

      if (playing) {
        const world = readWorldState(progress.worldState);
        const reached = Array.isArray(progress.reachedCheckpointIds) ? progress.reachedCheckpointIds.length : 0;
        const locksTotal = world ? world.locks.length : null;
        const locksSolved = world ? world.locks.filter((l) => l.isSolved).length : null;
        current = {
          completionPercent: completionPercent({ locksSolved, locksTotal, checkpointsReached: reached, checkpointsTotal }) ?? 0,
          locksSolved,
          locksTotal,
          checkpointsReached: reached,
          checkpointsTotal,
          runSeconds: world?.elapsedSeconds ?? null,
          savedAt: progress.updatedAt,
          cluesFound: Array.isArray(progress.journalIds) ? progress.journalIds.length : 0,
        };
        locksForStats = world ? world.locks : [];
      } else if (own.length > 0) {
        const last = attemptsOldestFirst[attemptsOldestFirst.length - 1];
        current = {
          completionPercent: last.completionPercent,
          locksSolved: last.locksSolved,
          locksTotal: last.locksTotal,
          checkpointsReached: last.checkpointsReached,
          checkpointsTotal: last.checkpointsTotal,
          runSeconds: last.totalTime,
          savedAt: last.completedAt,
          cluesFound: null,
        };
        locksForStats = readLockResults(own[own.length - 1].lockResults);
      }
      addLocks(locksForStats);

      const lastPlayedAt = [progress?.updatedAt, own.length ? own[own.length - 1].completedAt : null]
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0] || null;

      return {
        id: student.id,
        name: student.name,
        email: student.email,
        state,
        current,
        lastPlayedAt,
        attemptCount: attemptsOldestFirst.length,
        attempts: [...attemptsOldestFirst].reverse(), // newest first
        bestRank,
        bestTime,
        trend: trendOf(attemptsOldestFirst),
      };
    });

    const finished = students.filter((s) => s.state === "completed").length;
    const playingNow = students.filter((s) => s.state === "inProgress").length;
    const started = students.filter((s) => s.current);
    const average = started.length
      ? Math.round(started.reduce((sum, s) => sum + (s.current.completionPercent ?? 0), 0) / started.length)
      : null;

    const hardestLocks = [...lockStats.values()]
      .filter((l) => l.wrongAttempts > 0)
      .sort((a, b) => b.wrongAttempts - a.wrongAttempts || b.studentsWithMistakes - a.studentsWithMistakes)
      .slice(0, HARDEST_LOCKS_SHOWN)
      .map((l) => ({
        ...l,
        order: lockInfo.get(l.id)?.order || null,
        type: lockInfo.get(l.id)?.type || null,
        missedPercent: percentOf(l.studentsWithMistakes, l.outOf),
      }));

    res.json({
      campaign: { id: campaign.id, title: campaign.title, scene: campaign.scene, roomId: campaign.room.id, roomName: campaign.room.name },
      checkpointsTotal,
      summary: {
        students: students.length,
        finished,
        playing: playingNow,
        notStarted: students.length - finished - playingNow,
        averageCompletion: average,
      },
      hardestLocks,
      students,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Any logged-in user: their own finished runs of a campaign, newest first, for the "Previous attempts"
// card. The user always comes from the token.
router.get("/campaigns/:id/results/history", protect, async (req, res) => {
  const campaignId = parseInt(req.params.id);
  if (!Number.isInteger(campaignId)) return res.status(400).json({ message: "Invalid campaign id" });

  try {
    const sessions = await prisma.campaignSession.findMany({
      where: { campaignId, studentId: req.user.id, completedAt: { not: null } },
      orderBy: [{ completedAt: "asc" }, { id: "asc" }],
    });

    const attempts = sessions.map((s, i) => summarizeSession(s, i + 1));
    const { bestRank, bestTime } = bestOf(attempts);

    res.json({ attempts: [...attempts].reverse(), bestRank, bestTime, trend: trendOf(attempts) });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
