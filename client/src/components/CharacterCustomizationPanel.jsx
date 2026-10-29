import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Save } from 'lucide-react'
import dashboard_bg from '../assets/dashboard_bg.png'
import Navbar from './Navbar'
import EmberField from './EmberField'
import CharacterCustomizer3D from './CharacterCustomizer3D'
import { colors, fonts } from '../theme'

// The 4 fixed body-part slots every character set must be mapped against - matches Unity's own
// CharacterPartRegistryAsset.BodyPartSlot enum exactly. Unlike the OPTIONS for each slot (which
// are now admin-managed, see characterSets state below), this list itself isn't dynamic - adding
// a 5th slot would need a matching change on the Unity side too, so it stays a plain constant.
const SLOTS = ['Head', 'Body', 'Arm', 'Leg']

// Two visual variants, matching the two color families already used across the site: the light
// parchment/violet theme (Student pages) and the dark wood/obsidian/ember/brass theme (Teacher and
// Admin pages). Only the colors and background change between them - the layout and behavior below
// is identical for every caller.
const THEMES = {
    light: {
        bgGradient: `radial-gradient(ellipse at 50% 0%, rgba(139,111,179,0.25), rgba(243,233,215,0.85)), url(${dashboard_bg})`,
        emberVariant: 'sparkle',
        panelBg: colors.parchmentDark,
        panelBorder: `1px solid ${colors.magicViolet}55`,
        accent: colors.magicViolet,
        accentBright: colors.magicVioletBright,
        textPrimary: colors.ink,
        textMuted: colors.inkMuted,
        controlBg: colors.parchmentPanel,
        controlBorder: colors.parchmentLine,
        errorColor: '#B33A3A',
    },
    dark: {
        bgGradient: `radial-gradient(ellipse at 50% 0%, rgba(60,38,20,0.45), rgba(6,4,2,0.94)), url(${dashboard_bg})`,
        emberVariant: 'ember',
        panelBg: `linear-gradient(165deg, ${colors.wood} 0%, ${colors.obsidian} 100%)`,
        panelBorder: `1px solid ${colors.vaultBorder}`,
        accent: colors.ember,
        accentBright: colors.emberBright,
        textPrimary: colors.brassBright,
        textMuted: '#C9BBA6',
        controlBg: `linear-gradient(165deg, #241A10 0%, ${colors.obsidian} 100%)`,
        controlBorder: colors.vaultBorder,
        errorColor: '#E08585',
    },
}

// CharacterCustomizationPanel.jsx
//
// Shared character-customization screen, reused as-is by the Student, Teacher, and Admin
// dashboards (only the theme, back-link, and header text differ between them - see the thin
// wrapper pages in pages/student, pages/teacher, and pages/admin). Renders and saves the
// character's look directly on the website with three.js - see CharacterCustomizer3D.jsx for the
// 3D preview itself. The catalog of selectable characters comes from GET /api/character-sets
// (admin-managed - see server/routes/characterSets.js and the Admin dashboard's Character Sets
// page), not a hardcoded table, so adding a new option never needs a code change here. Saving
// goes through the same GET/PUT /api/character-loadout endpoints regardless of which account is
// signed in - those only ever deal in opaque optionId strings tied to req.user.id, so a teacher or
// admin testing this saves their own look, never a student's.
function CharacterCustomizationPanel({
    theme = 'light',
    backTo,
    breadcrumbLabel,
    sectionLabel,
    title = 'Customize Character',
    subtitle = 'Your look is saved to your account and carries into every room you enter. Drag the preview to rotate.',
}) {
    const navigate = useNavigate()
    const t = THEMES[theme] || THEMES.light
    const [characterSets, setCharacterSets] = useState([])
    const [selections, setSelections] = useState({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saveMessage, setSaveMessage] = useState("")

    // The selectable options for one slot, in characterSets order (lowest orderNumber first,
    // matching "Base" being first/default) - e.g. optionsFor("Head") => [{id: "head000", label:
    // "Base"}, {id: "head001", label: "Pirate"}, ...]. A set that has no mapping for this slot
    // (shouldn't normally happen, but admin data is never assumed perfect) is simply skipped.
    const optionsFor = (slot) =>
        characterSets
            .map((set) => {
                const match = set.slots.find((s) => s.slot === slot)
                return match ? { id: match.optionId, label: set.label } : null
            })
            .filter(Boolean)

    // Loads the admin-managed catalog AND whatever this account last saved (or leaves the first
    // option per slot - the lowest-orderNumber set, i.e. "Base" today - for a first-time visitor)
    // in one pass, so the 3D preview only ever mounts once both are known.
    useEffect(() => {
        const token = localStorage.getItem("token")

        const load = async () => {
            try {
                const setsRes = await fetch(`${import.meta.env.VITE_API_URL}/api/character-sets`, {
                    headers: { "Authorization": `Bearer ${token}` },
                })
                const sets = await setsRes.json()
                const orderedSets = Array.isArray(sets) ? sets : []
                setCharacterSets(orderedSets)

                const defaults = {}
                for (const slot of SLOTS) {
                    const firstOption = orderedSets
                        .map((set) => set.slots.find((s) => s.slot === slot))
                        .find(Boolean)
                    if (firstOption) defaults[slot] = firstOption.optionId
                }

                const loadoutRes = await fetch(`${import.meta.env.VITE_API_URL}/api/character-loadout`, {
                    headers: { "Authorization": `Bearer ${token}` },
                })
                const loadoutData = await loadoutRes.json()

                const next = { ...defaults }
                if (loadoutRes.ok && Array.isArray(loadoutData.parts)) {
                    for (const part of loadoutData.parts) {
                        if (SLOTS.includes(part.slot) && part.optionId) next[part.slot] = part.optionId
                    }
                }
                setSelections(next)
            } catch (err) {
                console.error("[CharacterCustomizationPanel] Failed to load character sets/loadout:", err)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    // Steps one slot to its next/previous option, wrapping around at either end - same cycling
    // behavior CharacterCustomizationUIController.cs used on the Unity side.
    const step = (slot, direction) => {
        const options = optionsFor(slot)
        if (options.length === 0) return
        const currentIndex = options.findIndex((o) => o.id === selections[slot])
        const nextIndex = ((currentIndex + direction) % options.length + options.length) % options.length
        setSelections((prev) => ({ ...prev, [slot]: options[nextIndex].id }))
    }

    const handleSave = async () => {
        setSaving(true)
        setSaveMessage("")
        const token = localStorage.getItem("token")
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/character-loadout`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ parts: SLOTS.map((slot) => ({ slot, optionId: selections[slot] })) }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.message || "Could not save your look")
            }
            setSaveMessage("Saved!")
        } catch (err) {
            setSaveMessage(err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <Navbar />

            {/* Background div */}
            <div style={{ position: "relative", display: "flex", minHeight: "100vh", backgroundImage: t.bgGradient, backgroundSize: "cover", backgroundPosition: "center" }}>

                <EmberField variant={t.emberVariant} count={22} />

                {/* Main panel */}
                <div style={{ position: "relative", background: t.panelBg, flex: 1, borderRadius: "24px", margin: "20px", boxShadow: "0 20px 50px rgba(0,0,0,0.25)", border: t.panelBorder }}>
                    <div style={{ padding: "40px" }}>

                        {/* Breadcrumb */}
                        <p onClick={() => navigate(backTo)} style={{ cursor: "pointer", color: t.accent, fontFamily: fonts.body, fontSize: "14px", marginBottom: "16px" }}>
                            {breadcrumbLabel} &gt; Customize Character
                        </p>

                        {/* Header */}
                        <div style={{ marginBottom: "24px" }}>
                            <p style={{ margin: "0 0 4px 0", fontFamily: fonts.flourish, fontSize: "12px", letterSpacing: "3px", color: t.accent }}>
                                {sectionLabel}
                            </p>
                            <h1 style={{ fontFamily: fonts.displayDecorative, fontSize: "32px", color: t.textPrimary, margin: 0 }}>{title}</h1>
                            <p style={{ fontFamily: fonts.body, fontSize: "14px", color: t.textMuted, margin: "6px 0 0 0" }}>
                                {subtitle}
                            </p>
                        </div>

                        <div style={{ display: "flex", gap: "32px", alignItems: "flex-start", flexWrap: "wrap" }}>

                            {/* 3D preview */}
                            <div style={{ width: "480px", height: "560px", borderRadius: "20px", overflow: "hidden", flexShrink: 0 }}>
                                {loading ? (
                                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted, fontFamily: fonts.body, fontSize: "13px" }}>
                                        Loading your look...
                                    </div>
                                ) : (
                                    <CharacterCustomizer3D characterSets={characterSets} selections={selections} />
                                )}
                            </div>

                            {/* Slot controls */}
                            <div style={{ flex: 1, minWidth: "260px", display: "flex", flexDirection: "column", gap: "16px" }}>
                                {SLOTS.map((slot) => {
                                    const options = optionsFor(slot)
                                    const current = options.find((o) => o.id === selections[slot])
                                    return (
                                        <div key={slot} style={{ background: t.controlBg, borderRadius: "18px", border: `1px solid ${t.controlBorder}`, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                            <p style={{ fontFamily: fonts.body, fontWeight: "600", fontSize: "14px", color: t.textPrimary, margin: 0 }}>{slot}</p>
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                <button
                                                    onClick={() => step(slot, -1)}
                                                    style={{ background: "transparent", border: `1px solid ${t.accent}`, borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", color: t.accent, cursor: "pointer" }}
                                                >
                                                    <ChevronLeft size={16} />
                                                </button>
                                                <p style={{ fontFamily: fonts.body, fontSize: "14px", color: t.textMuted, margin: 0, minWidth: "70px", textAlign: "center" }}>{current?.label}</p>
                                                <button
                                                    onClick={() => step(slot, 1)}
                                                    style={{ background: "transparent", border: `1px solid ${t.accent}`, borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", color: t.accent, cursor: "pointer" }}
                                                >
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}

                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: `linear-gradient(160deg, ${t.accentBright}, ${t.accent})`, color: "#FFFFFF", border: "none", borderRadius: "18px", padding: "12px 24px", fontFamily: fonts.body, fontWeight: "600", fontSize: "16px", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1, marginTop: "8px" }}
                                >
                                    <Save size={16} /> {saving ? "Saving..." : "Save Look"}
                                </button>

                                {saveMessage && (
                                    <p style={{ fontFamily: fonts.body, fontSize: "13px", color: saveMessage === "Saved!" ? t.accent : t.errorColor, margin: 0 }}>
                                        {saveMessage}
                                    </p>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    )
}

export default CharacterCustomizationPanel
