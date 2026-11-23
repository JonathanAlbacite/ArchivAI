import express from "express";
import prisma from "../lib/prisma.js";
import { protect, adminOnly } from "../middleware/auth.js";
import { exportVaultTemplatesSnapshot } from "../lib/vaultTemplatesExport.js";
import { exportSceneTrophiesSnapshot } from "../lib/sceneTrophiesExport.js";
import { removeTrophyFile } from "./sceneTrophies.js";
import {
  ENVIRONMENT_ICONS,
  DEFAULT_ICON,
  isValidColor,
  listEnvironments,
  uniqueKey,
} from "../lib/environments.js";

const router = express.Router();

const MAX_LABEL_LENGTH = 40;
const MAX_BLURB_LENGTH = 120;

// What the website gets for each environment.
const toPublic = (e) => ({
  id: e.id,
  key: e.key,
  label: e.label,
  icon: e.icon,
  color: e.color,
  blurb: e.blurb || "",
  orderNumber: e.orderNumber,
});

// Checks the fields an admin can set. Returns { error } or { data } with only the fields that were
// sent, cleaned up. `requireLabel` is true when creating.
const readFields = (body, requireLabel) => {
  const data = {};

  if (body.label !== undefined || requireLabel) {
    const label = typeof body.label === "string" ? body.label.trim() : "";
    if (!label) return { error: "Give the environment a name" };
    if (label.length > MAX_LABEL_LENGTH) return { error: `The name can be at most ${MAX_LABEL_LENGTH} characters` };
    data.label = label;
  }

  if (body.icon !== undefined) {
    if (!ENVIRONMENT_ICONS.includes(body.icon)) return { error: "Pick one of the listed icons" };
    data.icon = body.icon;
  }

  if (body.color !== undefined) {
    if (!isValidColor(body.color)) return { error: "The colour must look like #RRGGBB" };
    data.color = body.color ? body.color.toLowerCase() : null;
  }

  if (body.blurb !== undefined) {
    const blurb = typeof body.blurb === "string" ? body.blurb.trim() : "";
    if (blurb.length > MAX_BLURB_LENGTH) return { error: `The description can be at most ${MAX_BLURB_LENGTH} characters` };
    data.blurb = blurb || null;
  }

  return { data };
};

// Any logged-in user: the environments campaigns can be set in, in display order. Teachers need it for
// the scene picker, students and the results page for the scene badges and colours.
router.get("/environments", protect, async (req, res) => {
  try {
    res.json((await listEnvironments()).map(toPublic));
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Admin: add an environment. The key is made from the name and never changes afterwards.
router.post("/admin/environments", protect, adminOnly, async (req, res) => {
  const { data, error } = readFields(req.body || {}, true);
  if (error) return res.status(400).json({ message: error });

  try {
    const all = await listEnvironments();
    if (all.some((e) => e.label.toLowerCase() === data.label.toLowerCase()))
      return res.status(400).json({ message: "An environment with this name already exists" });

    const created = await prisma.environment.create({
      data: {
        key: await uniqueKey(data.label),
        label: data.label,
        icon: data.icon || DEFAULT_ICON,
        color: data.color ?? null,
        blurb: data.blurb ?? null,
        orderNumber: all.reduce((max, e) => Math.max(max, e.orderNumber), 0) + 1,
      },
    });

    res.status(201).json(toPublic(created));
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Admin: rename an environment or change its icon, colour or description. The key stays the same, so
// campaigns and question sets keep pointing at it.
router.put("/admin/environments/:id", protect, adminOnly, async (req, res) => {
  const id = parseInt(req.params.id);
  const { data, error } = readFields(req.body || {}, false);
  if (error) return res.status(400).json({ message: error });

  try {
    const existing = await prisma.environment.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Environment not found" });

    if (data.label) {
      const all = await listEnvironments();
      if (all.some((e) => e.id !== id && e.label.toLowerCase() === data.label.toLowerCase()))
        return res.status(400).json({ message: "An environment with this name already exists" });
    }

    const updated = await prisma.environment.update({ where: { id }, data });
    res.json(toPublic(updated));
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Admin: delete an environment. Refused while any campaign is set in it. Its question set (draft or
// published) and its trophy are deleted with it, since nothing can use them any more.
router.delete("/admin/environments/:id", protect, adminOnly, async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const existing = await prisma.environment.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Environment not found" });

    // Campaign.scene was always matched without caring about upper/lower case.
    const inUse = await prisma.campaign.count({ where: { scene: existing.key } });
    if (inUse > 0)
      return res.status(409).json({
        message: `${inUse} campaign${inUse === 1 ? " is" : "s are"} still set in ${existing.label}. Move or delete ${inUse === 1 ? "it" : "them"} first.`,
      });

    await prisma.vaultTemplate.deleteMany({ where: { scene: existing.key } });
    await prisma.environment.delete({ where: { id } });

    // Its trophy (if the admin added one) goes with it, file included.
    const trophy = await prisma.sceneTrophy.findUnique({ where: { sceneKey: existing.key } });
    if (trophy) {
      await prisma.sceneTrophy.delete({ where: { id: trophy.id } });
      removeTrophyFile(trophy);
      try {
        await exportSceneTrophiesSnapshot();
      } catch (exportErr) {
        console.error("[environments] Failed to export trophy seed snapshot:", exportErr);
      }
    }

    // Keeps prisma/vaultTemplatesSeed.json in sync, same as the vault template routes do.
    try {
      await exportVaultTemplatesSnapshot();
    } catch (exportErr) {
      console.error("[environments] Failed to export seed snapshot:", exportErr);
    }

    res.json({ message: "Environment deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
