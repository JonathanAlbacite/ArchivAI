import express from "express";
import prisma from "../lib/prisma.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = express.Router();

// Matches the keys in client/src/scenes.js (SCENE_LIST) - Campaign.scene
// is stored lowercase, so VaultTemplate.scene is too, to look up straight
// from a campaign's own scene value with no case juggling.
export const VALID_SCENES = ["laboratory", "library", "tomb"];
const VALID_TYPES = ["NORMAL", "MULTICHOICE", "COMBO"];

const normalizeScene = (scene) => VALID_SCENES.find((s) => s === (scene || "").toLowerCase().trim()) || null;

// Admin: list every vault's template, including vaults with no template
// row yet (returned as an empty/unpublished stub), so the dashboard can
// always show all three vaults.
router.get("/admin/vault-templates", protect, adminOnly, async (req, res) => {
  try {
    const templates = await prisma.vaultTemplate.findMany({
      include: { slots: { orderBy: { orderNumber: "asc" } } },
    });
    const byScene = Object.fromEntries(templates.map((t) => [t.scene, t]));

    res.json(
      VALID_SCENES.map((scene) => byScene[scene] || { id: null, scene, isPublished: false, slots: [] })
    );
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Admin: fetch one vault's template (returns a stub, doesn't create a row,
// if none exists yet).
router.get("/admin/vault-templates/:scene", protect, adminOnly, async (req, res) => {
  const scene = normalizeScene(req.params.scene);
  if (!scene) return res.status(400).json({ message: `scene must be one of ${VALID_SCENES.join(", ")}` });

  try {
    const template = await prisma.vaultTemplate.findUnique({
      where: { scene },
      include: { slots: { orderBy: { orderNumber: "asc" } } },
    });
    res.json(template || { id: null, scene, isPublished: false, slots: [] });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Admin: replace a vault's whole slot list (creates the template row the
// first time). Only while still a draft - once published a template is
// locked, same one-way idea as Campaign.isPublished elsewhere; unpublish
// first (see below) to make more changes.
router.put("/admin/vault-templates/:scene", protect, adminOnly, async (req, res) => {
  const scene = normalizeScene(req.params.scene);
  if (!scene) return res.status(400).json({ message: `scene must be one of ${VALID_SCENES.join(", ")}` });

  const { slots } = req.body;
  if (!Array.isArray(slots) || slots.length === 0)
    return res.status(400).json({ message: "slots must be a non-empty array" });
  if (slots.some((s) => !s || !VALID_TYPES.includes(s.type)))
    return res.status(400).json({ message: `Each slot's type must be one of ${VALID_TYPES.join(", ")}` });

  try {
    const existing = await prisma.vaultTemplate.findUnique({ where: { scene } });
    if (existing?.isPublished)
      return res.status(400).json({ message: "This vault's template is published - unpublish it first to edit" });

    const template = await prisma.vaultTemplate.upsert({
      where: { scene },
      update: {},
      create: { scene },
    });

    // Simplest correct way to apply a reordered/resized slot list: drop
    // and recreate them all. Templates only ever hold a handful of slots
    // (authored by hand by the admin), so this is never a real cost.
    await prisma.templateSlot.deleteMany({ where: { templateId: template.id } });
    await prisma.templateSlot.createMany({
      data: slots.map((s, i) => ({ templateId: template.id, orderNumber: i + 1, type: s.type })),
    });

    const updated = await prisma.vaultTemplate.findUnique({
      where: { scene },
      include: { slots: { orderBy: { orderNumber: "asc" } } },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Admin: publish a vault's template - this is what makes it the required
// structure teachers must follow when creating a campaign in that scene.
router.patch("/admin/vault-templates/:scene/publish", protect, adminOnly, async (req, res) => {
  const scene = normalizeScene(req.params.scene);
  if (!scene) return res.status(400).json({ message: `scene must be one of ${VALID_SCENES.join(", ")}` });

  try {
    const template = await prisma.vaultTemplate.findUnique({ where: { scene }, include: { slots: true } });
    if (!template) return res.status(404).json({ message: "No template found for this vault yet" });
    if (template.slots.length === 0)
      return res.status(400).json({ message: "Add at least one slot before publishing" });

    const updated = await prisma.vaultTemplate.update({ where: { scene }, data: { isPublished: true } });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Admin: unpublish - lets the slot list be edited again. Doesn't touch any
// campaign already created under the structure it published earlier; only
// new campaigns in this scene are affected once it's republished.
router.patch("/admin/vault-templates/:scene/unpublish", protect, adminOnly, async (req, res) => {
  const scene = normalizeScene(req.params.scene);
  if (!scene) return res.status(400).json({ message: `scene must be one of ${VALID_SCENES.join(", ")}` });

  try {
    const template = await prisma.vaultTemplate.findUnique({ where: { scene } });
    if (!template) return res.status(404).json({ message: "No template found for this vault yet" });

    const updated = await prisma.vaultTemplate.update({ where: { scene }, data: { isPublished: false } });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: fetch the published structure for a scene, so the campaign
// editor knows exactly how many clue pages to show and what type each one
// is. 404 means no template has been published yet for this vault -
// campaign creation there is blocked until one is.
router.get("/vault-templates/:scene/published", protect, async (req, res) => {
  const scene = normalizeScene(req.params.scene);
  if (!scene) return res.status(400).json({ message: `scene must be one of ${VALID_SCENES.join(", ")}` });

  try {
    const template = await prisma.vaultTemplate.findUnique({
      where: { scene },
      include: { slots: { orderBy: { orderNumber: "asc" } } },
    });
    if (!template || !template.isPublished)
      return res.status(404).json({ message: "No published template for this vault yet" });

    res.json(template);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
