import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw, Save, Shirt, Users } from 'lucide-react'
import CharacterCustomizer3D from './CharacterCustomizer3D'
import { Alert, Breadcrumbs, Button, Card, EmptyState, IconButton, LoadingState, PageHeader } from './ui'
import { useToast } from '../lib/toast'

// The 4 fixed body-part slots every character set must be mapped against - matches Unity's own
// CharacterPartRegistryAsset.BodyPartSlot enum exactly. Unlike the OPTIONS for each slot (which
// are now admin-managed, see characterSets state below), this list itself isn't dynamic - adding
// a 5th slot would need a matching change on the Unity side too, so it stays a plain constant.
const SLOTS = ['Head', 'Body', 'Arm', 'Leg']
const SLOT_LABELS = { Head: 'Head', Body: 'Body', Arm: 'Arms', Leg: 'Legs' }

// CharacterCustomizationPanel.jsx
//
// Shared character-customization screen, reused as-is by the Student, Teacher, and Admin
// dashboards (only the back-link and header text differ between them - see the thin wrapper
// pages in pages/student, pages/teacher, and pages/admin; the role accent comes from the app
// shell). Renders and saves the character's look directly on the website with three.js - see
// CharacterCustomizer3D.jsx for the 3D preview itself. The catalog of selectable characters comes
// from GET /api/character-sets (admin-managed - see server/routes/characterSets.js and the Admin
// dashboard's Character Sets page), not a hardcoded table, so adding a new option never needs a
// code change here. Saving goes through the same GET/PUT /api/character-loadout endpoints
// regardless of which account is signed in - those only ever deal in opaque optionId strings tied
// to req.user.id, so a teacher or admin testing this saves their own look, never a student's.
function CharacterCustomizationPanel({
    backTo,
    breadcrumbLabel,
    sectionLabel,
    title = 'Customize character',
    subtitle = 'Your character is saved to your account and used in every room. Drag the preview to rotate it.',
}) {
    const toast = useToast()
    const [characterSets, setCharacterSets] = useState([])
    const [selections, setSelections] = useState({})
    const [savedSelections, setSavedSelections] = useState({})
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState("")
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState("")

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
                if (!setsRes.ok) throw new Error(sets.message || "Couldn't load the character options")
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
                setSavedSelections(next)
            } catch (err) {
                console.error("[CharacterCustomizationPanel] Failed to load character sets/loadout:", err)
                setLoadError(err.message === "Failed to fetch" ? "Couldn't reach the server. Check your connection." : err.message)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const select = (slot, optionId) => setSelections((prev) => ({ ...prev, [slot]: optionId }))

    // Steps one slot to its next/previous option, wrapping around at either end - same cycling
    // behavior CharacterCustomizationUIController.cs used on the Unity side.
    const step = (slot, direction) => {
        const options = optionsFor(slot)
        if (options.length === 0) return
        const currentIndex = options.findIndex((o) => o.id === selections[slot])
        const nextIndex = ((currentIndex + direction) % options.length + options.length) % options.length
        select(slot, options[nextIndex].id)
    }

    const dirty = SLOTS.some((slot) => selections[slot] !== savedSelections[slot])

    const handleSave = async () => {
        setSaving(true)
        setSaveError("")
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
            setSavedSelections(selections)
            toast.success("Your character is saved.")
        } catch (err) {
            setSaveError(err.message === "Failed to fetch" ? "Couldn't reach the server. Your changes aren't saved yet." : err.message)
        } finally {
            setSaving(false)
        }
    }

    const empty = !loading && !loadError && characterSets.length === 0

    return (
        <div className="page">
            <PageHeader
                breadcrumbs={<Breadcrumbs items={[{ label: breadcrumbLabel, to: backTo }, { label: "Character" }]} />}
                eyebrow={sectionLabel}
                title={title}
                description={subtitle}
            />

            {loadError && <Alert tone="danger" title="We couldn't load the character options">{loadError}</Alert>}

            {empty && (
                <EmptyState icon={Users} title="No characters available yet">
                    An administrator needs to add character sets first.
                </EmptyState>
            )}

            {!loadError && !empty && (
                <div className="customizer">
                    <Card className="customizer__preview" flush>
                        {loading ? (
                            <LoadingState label="Loading your character..." />
                        ) : (
                            <CharacterCustomizer3D characterSets={characterSets} selections={selections} />
                        )}
                        <p className="customizer__hint text-xs">Drag to rotate</p>
                    </Card>

                    <div className="customizer__controls stack">
                        {SLOTS.map((slot) => {
                            const options = optionsFor(slot)
                            const current = options.find((o) => o.id === selections[slot])
                            return (
                                <Card key={slot} as="fieldset" className="slot-picker" disabled={loading || saving}>
                                    <legend className="sr-only">{SLOT_LABELS[slot]}</legend>
                                    <div className="row row-between row-nowrap">
                                        <span className="slot-picker__legend" aria-hidden="true">
                                            <Shirt size={16} /> {SLOT_LABELS[slot]}
                                        </span>
                                        <div className="row row-nowrap" style={{ "--gap": "4px" }}>
                                            <IconButton icon={ChevronLeft} size="sm" variant="secondary" label={`Previous ${SLOT_LABELS[slot].toLowerCase()} option`} onClick={() => step(slot, -1)} disabled={options.length < 2} />
                                            <IconButton icon={ChevronRight} size="sm" variant="secondary" label={`Next ${SLOT_LABELS[slot].toLowerCase()} option`} onClick={() => step(slot, 1)} disabled={options.length < 2} />
                                        </div>
                                    </div>
                                    {options.length === 0 ? (
                                        <p className="text-sm text-muted">No options for this part yet.</p>
                                    ) : (
                                        <div className="option-chips" role="radiogroup" aria-label={`${SLOT_LABELS[slot]} options`}>
                                            {options.map((o) => (
                                                <label key={o.id} className="option-chip" data-selected={o.id === current?.id}>
                                                    <input
                                                        type="radio"
                                                        className="sr-only"
                                                        name={`slot-${slot}`}
                                                        value={o.id}
                                                        checked={o.id === current?.id}
                                                        onChange={() => select(slot, o.id)}
                                                    />
                                                    {o.label}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            )
                        })}

                        {saveError && <Alert tone="danger">{saveError}</Alert>}

                        <div className="customizer__actions">
                            <Button variant="secondary" icon={RotateCcw} onClick={() => setSelections(savedSelections)} disabled={!dirty || saving}>
                                Undo changes
                            </Button>
                            <Button variant="accent" icon={Save} onClick={handleSave} loading={saving} disabled={loading || !dirty}>
                                {saving ? "Saving..." : dirty ? "Save" : "Saved"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default CharacterCustomizationPanel
