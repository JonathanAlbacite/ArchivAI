import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import {
    BookOpen, Copy, CopyPlus, Eye, EyeOff, KeyRound, MoreVertical, Paperclip, Pencil, Play, Rocket, Search, Sparkles, Trash2, UserPlus, Users, Wifi,
} from 'lucide-react'
import GameStage from '../../components/game/GameStage'
import CampaignEditor from '../../components/teacher/campaignEditor/CampaignEditor'
import CampaignViewer from '../../components/teacher/CampaignViewer'
import { SceneBadge } from '../../components/SceneIcon'
import { BooksArt } from '../../components/Illustrations'
import {
    Alert, Avatar, Badge, Breadcrumbs, Button, Card, ConfirmDialog, EmptyState, IconButton, Menu, Modal, OnlineIndicator, PageHeader,
    Segmented, Skeleton, SkeletonCards, Stat, StatusChip, Tabs, TextAreaField, TextField,
} from '../../components/ui'
import useRoomMembers from '../../lib/useRoomMembers'
import { api, errorMessage } from '../../lib/api'
import { clearSession } from '../../lib/session'
import { useToast } from '../../lib/toast'
import { plural } from '../../lib/format'

const hasPlayHistory = (c) => (c._count?.sessions || 0) + (c._count?.progress || 0) > 0

function EditRoomModal({ room, onClose, onSaved }) {
    const [name, setName] = useState(room.name || "")
    const [description, setDescription] = useState(room.description || "")
    const [error, setError] = useState("")
    const [serverError, setServerError] = useState("")
    const [saving, setSaving] = useState(false)

    const submit = async (e) => {
        e.preventDefault()
        if (!name.trim()) {
            setError("The room needs a name.")
            return
        }
        setSaving(true)
        setServerError("")
        try {
            const { ok, data } = await api(`/rooms/${room.id}`, { method: "PATCH", body: { name: name.trim(), description } })
            if (!ok) {
                setServerError(errorMessage(data))
                return
            }
            onSaved()
        } catch {
            setServerError("Couldn't reach the server. Nothing was changed.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            title="Edit room"
            size="sm"
            onClose={onClose}
            busy={saving}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button variant="accent" type="submit" form="edit-room-form" loading={saving}>Save changes</Button>
                </>
            }
        >
            <form id="edit-room-form" className="stack" onSubmit={submit} noValidate>
                {serverError && <Alert tone="danger">{serverError}</Alert>}
                <TextField label="Room name" required value={name} onChange={(e) => setName(e.target.value)} error={error} maxLength={120} data-autofocus />
                <TextAreaField label="Description" optional rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </form>
        </Modal>
    )
}

function AddStudentForm({ roomId, onAdded, onCancel }) {
    const [email, setEmail] = useState("")
    const [error, setError] = useState("")
    const [saving, setSaving] = useState(false)

    const submit = async (e) => {
        e.preventDefault()
        if (!email.trim()) {
            setError("Enter the student's account email.")
            return
        }
        setSaving(true)
        setError("")
        try {
            const { ok, data } = await api(`/rooms/${roomId}/students`, { method: "POST", body: { email: email.trim() } })
            if (!ok) {
                setError(errorMessage(data))
                return
            }
            setEmail("")
            onAdded()
        } catch {
            setError("Couldn't reach the server. Check your connection.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card muted as="form" onSubmit={submit} noValidate className="add-student">
            <TextField label="Add a student by email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} error={error} className="grow" autoFocus />
            <div className="row">
                <Button variant="accent" type="submit" icon={UserPlus} loading={saving}>Add</Button>
                <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
            </div>
        </Card>
    )
}

function RoomPage() {
    const { id } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const toast = useToast()
    const [room, setRoom] = useState(null)
    const [loadError, setLoadError] = useState("")
    const [reloadKey, setReloadKey] = useState(0)
    const members = useRoomMembers(id)
    const activeStudentIds = new Set((members?.students || []).filter((m) => m.active).map((m) => m.id))

    const [tab, setTab] = useState("campaigns")
    const [campaignFilter, setCampaignFilter] = useState("all")
    const [campaignQuery, setCampaignQuery] = useState("")
    const [studentQuery, setStudentQuery] = useState("")
    const [showAddStudent, setShowAddStudent] = useState(false)
    const [showCreateCampaign, setShowCreateCampaign] = useState(false)
    const [editingCampaign, setEditingCampaign] = useState(null)
    const [loadingEditId, setLoadingEditId] = useState(null)
    const [viewCampaignId, setViewCampaignId] = useState(null)
    const [showEditRoom, setShowEditRoom] = useState(false)
    const [activeCampaign, setActiveCampaign] = useState(null)
    const [startingId, setStartingId] = useState(null)
    // { kind: "delete" | "unpublish" | "publish" | "removeStudent", target }
    const [confirm, setConfirm] = useState(null)
    const [confirmBusy, setConfirmBusy] = useState(false)
    const [confirmError, setConfirmError] = useState("")

    const refresh = () => setReloadKey((k) => k + 1)

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const { ok, status, data } = await api(`/rooms/${id}`)
                if (cancelled) return
                if (!ok) {
                    if (status === 401) {
                        clearSession()
                        navigate("/")
                        return
                    }
                    setLoadError(status === 403 ? "This room belongs to another teacher." : status === 404 ? "This room doesn't exist anymore." : errorMessage(data))
                    return
                }
                setLoadError("")
                setRoom(data)
            } catch {
                if (!cancelled) setLoadError("Couldn't reach the server. Check your connection and try again.")
            }
        }
        load()
        return () => { cancelled = true }
    }, [id, navigate, reloadKey])

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(room.roomCode)
            toast.success(`Room code ${room.roomCode} copied.`)
        } catch {
            toast.info(`Room code: ${room.roomCode}`, { title: "Copy it manually" })
        }
    }

    // Runs whichever action the confirmation dialog is asking about.
    const runConfirmed = async () => {
        const { kind, target } = confirm
        setConfirmBusy(true)
        setConfirmError("")
        try {
            const request = {
                delete: () => api(`/campaigns/${target.id}`, { method: "DELETE" }),
                // Hides a published campaign from students again. Nothing is deleted - the
                // clues and every recorded play stay, and the teacher can still open it.
                unpublish: () => api(`/campaigns/${target.id}/unpublish`, { method: "PATCH" }),
                publish: () => api(`/campaigns/${target.id}/publish`, { method: "PATCH" }),
                removeStudent: () => api(`/rooms/${id}/students/${target.id}`, { method: "DELETE" }),
            }[kind]
            const { ok, data } = await request()
            if (!ok) {
                setConfirmError(errorMessage(data))
                return
            }
            const messages = {
                delete: `“${target.title}” was deleted.`,
                unpublish: `“${target.title}” is hidden from students.`,
                publish: `“${target.title}” is live for students.`,
                removeStudent: `${target.name} was removed from the room.`,
            }
            toast.success(messages[kind])
            setConfirm(null)
            refresh()
        } catch {
            setConfirmError("Couldn't reach the server. Nothing was changed.")
        } finally {
            setConfirmBusy(false)
        }
    }

    // "Duplicate as new draft" - creates a new unpublished copy (clues included, no
    // attachment) so the original and its play history stay untouched.
    const handleDuplicateCampaign = async (campaign) => {
        try {
            const { ok, data } = await api(`/campaigns/${campaign.id}/duplicate`, { method: "POST" })
            if (!ok) {
                toast.error(errorMessage(data), { title: "Couldn't duplicate" })
                return
            }
            toast.success(`A new draft copy of “${campaign.title}” is ready to edit.`)
            refresh()
        } catch {
            toast.error("Couldn't reach the server.", { title: "Couldn't duplicate" })
        }
    }

    // Mirrors the Student side's Play flow - marks this campaign as the room's
    // active campaign (same endpoint the Student "Play" button calls), then mounts
    // the same game a student would see, so a teacher can preview it exactly.
    const handlePlay = async (campaign) => {
        setStartingId(campaign.id)
        try {
            const { ok, data } = await api(`/rooms/${id}/active-campaign`, { method: "PATCH", body: { campaignId: campaign.id } })
            if (!ok) {
                toast.error(errorMessage(data, "Could not start this campaign."), { title: "Preview didn't start" })
                return
            }
            setActiveCampaign(campaign)
        } catch {
            toast.error("Couldn't reach the server.", { title: "Preview didn't start" })
        } finally {
            setStartingId(null)
        }
    }

    // Arriving from "Create campaign" on the dashboard, or "Play again" on a results page.
    const handled = useRef(false)
    useEffect(() => {
        if (!room || handled.current) return
        const { createCampaign, playCampaignId } = location.state || {}
        if (!createCampaign && !playCampaignId) return
        handled.current = true
        navigate(location.pathname, { replace: true, state: null })
        const t = setTimeout(() => {
            if (createCampaign) setShowCreateCampaign(true)
            const campaign = playCampaignId && room.campaigns?.find((c) => c.id === playCampaignId)
            if (campaign) handlePlay(campaign)
        }, 0)
        return () => clearTimeout(t)
        // handlePlay is recreated each render; this runs once per arrival
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room])

    const handleReturnToRoom = () => {
        setActiveCampaign(null)
        refresh()
    }

    // The game raises this when a run ends (a teacher's preview run too). A saved run opens its
    // results page. If the website could not save it, the teacher is told and returns to the room.
    const handleRunFinished = ({ campaignId, saved }) => {
        if (saved) {
            navigate(`/results/${campaignId}`, { state: { roomId: id } })
            return
        }
        toast.error("The run finished, but the results could not be saved. Check your connection and try again.", { title: "Results not saved" })
        handleReturnToRoom()
    }

    // The room's campaign list doesn't include clues, so editing needs a fresh
    // fetch of the full campaign first (it returns clues with answers for the owner).
    const openEditCampaign = async (campaignId) => {
        setLoadingEditId(campaignId)
        try {
            const { ok, data } = await api(`/campaigns/${campaignId}`)
            if (!ok) {
                toast.error(errorMessage(data), { title: "Couldn't open the editor" })
                return
            }
            setEditingCampaign(data)
        } catch {
            toast.error("Couldn't reach the server.", { title: "Couldn't open the editor" })
        } finally {
            setLoadingEditId(null)
        }
    }

    const handleCampaignSaved = ({ published, title, created, partial }) => {
        refresh()
        if (partial) return
        toast.success(
            published ? `Students can play “${title}” now.` : `“${title}” is saved as a draft.`,
            { title: published ? "Campaign published" : created ? "Draft created" : "Draft saved" }
        )
    }

    if (activeCampaign) {
        return (
            <GameStage
                campaign={activeCampaign}
                roomId={id}
                preview
                onExit={handleReturnToRoom}
                onError={() => {
                    toast.error("Could not load the game. Check your connection and try again.", { title: "Game didn't load" })
                    setActiveCampaign(null)
                }}
                onRunFinished={handleRunFinished}
            />
        )
    }

    const campaigns = room?.campaigns || []
    const students = room?.students || []
    const published = campaigns.filter((c) => c.isPublished).length
    const q = campaignQuery.trim().toLowerCase()
    const visibleCampaigns = campaigns
        .filter((c) => campaignFilter === "all" || (campaignFilter === "published" ? c.isPublished : !c.isPublished))
        .filter((c) => !q || c.title.toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q))
    const sq = studentQuery.trim().toLowerCase()
    const visibleStudents = students.filter((s) => !sq || s.student.name.toLowerCase().includes(sq) || s.student.email.toLowerCase().includes(sq))

    const confirmCopy = confirm && {
        delete: {
            title: `Delete “${confirm.target.title}”?`,
            label: "Delete campaign",
            body: <><p>This also deletes all its entries and every student's play history for it.</p><p className="font-semibold">This can't be undone.</p></>,
        },
        unpublish: {
            title: `Unpublish “${confirm.target.title}”?`,
            label: "Unpublish",
            tone: "primary",
            body: <p>Students will no longer see or play it. Its entries and play history are kept, and you can still view it.</p>,
        },
        publish: {
            title: `Publish “${confirm.target.title}”?`,
            label: "Publish",
            tone: "primary",
            body: <p>Students in this room will see it and can play it right away. Its entries can't be edited while it's published, and once anyone plays it they're locked for good - duplicate it to make changes.</p>,
        },
        removeStudent: {
            title: `Remove ${confirm.target.name}?`,
            label: "Remove student",
            body: <p>They'll lose access to this room's campaigns. Their past results are kept, and they can rejoin with the room code.</p>,
        },
    }[confirm.kind]

    return (
        <div className="page">
            <PageHeader
                breadcrumbs={<Breadcrumbs items={[{ label: "Rooms", to: "/teacher/dashboard" }, { label: room?.name || "Room" }]} />}
                eyebrow="Room"
                title={room ? room.name : loadError ? "Room unavailable" : <Skeleton width={260} height={34} />}
                description={room?.description}
                actions={room && (
                    <>
                        <Button variant="secondary" icon={Pencil} onClick={() => setShowEditRoom(true)}>Edit room</Button>
                        <Button variant="accent" icon={Sparkles} onClick={() => setShowCreateCampaign(true)}>Create campaign</Button>
                    </>
                )}
            >
                {room && (
                    <div className="room-code" style={{ marginTop: 12 }}>
                        <KeyRound size={16} aria-hidden="true" />
                        <span className="text-sm text-muted">Room code</span>
                        <span className="room-code__value mono">{room.roomCode}</span>
                        <Button size="sm" variant="ghost" icon={Copy} onClick={copyCode} aria-label={`Copy room code ${room.roomCode}`}>Copy</Button>
                    </div>
                )}
            </PageHeader>

            {loadError && (
                <Alert tone="danger" title="We couldn't open this room" action={<Button size="sm" to="/teacher/dashboard">Back to rooms</Button>}>
                    {loadError}
                </Alert>
            )}

            {!loadError && (
                <>
                    <div className="stat-grid" style={{ "--cols": 3 }}>
                        <Stat icon={Users} tone="primary" label="Students" value={room ? students.length : "–"} />
                        <Stat icon={BookOpen} tone="success" label="Campaigns" value={room ? campaigns.length : "–"} hint={room ? `${published} published · ${campaigns.length - published} drafts` : undefined} />
                        <Stat icon={Wifi} tone="teacher" label="Students active now" value={members ? activeStudentIds.size : "–"} />
                    </div>

                    <div className="section">
                        <Tabs
                            label="Room sections"
                            value={tab}
                            onChange={setTab}
                            tabs={[
                                { id: "campaigns", label: "Campaigns", icon: BookOpen, count: campaigns.length },
                                { id: "students", label: "Students", icon: Users, count: students.length },
                            ]}
                        >
                            {tab === "campaigns" ? (
                                <div className="stack">
                                    <div className="toolbar">
                                        <TextField
                                            label="Search campaigns"
                                            icon={Search}
                                            type="search"
                                            value={campaignQuery}
                                            onChange={(e) => setCampaignQuery(e.target.value)}
                                            placeholder="Search by title"
                                            className="toolbar__search"
                                        />
                                        <Segmented
                                            label="Filter campaigns"
                                            value={campaignFilter}
                                            onChange={setCampaignFilter}
                                            options={[{ value: "all", label: "All" }, { value: "published", label: "Published" }, { value: "draft", label: "Drafts" }]}
                                        />
                                    </div>

                                    {!room ? (
                                        <SkeletonCards count={2} height={140} />
                                    ) : campaigns.length === 0 ? (
                                        <EmptyState
                                            art={<BooksArt />}
                                            title="No campaigns yet"
                                            action={<Button variant="accent" icon={Sparkles} onClick={() => setShowCreateCampaign(true)}>Create your first campaign</Button>}
                                        >
                                            A campaign is an escape-room game. Pick a scene, write the entries (or draft them with AI from a lesson), then publish.
                                        </EmptyState>
                                    ) : visibleCampaigns.length === 0 ? (
                                        <EmptyState plain icon={Search} title="No campaigns match">Try a different search or filter.</EmptyState>
                                    ) : (
                                        <ul className="campaign-list" role="list">
                                            {visibleCampaigns.map((c) => {
                                                const editable = !c.isPublished && !hasPlayHistory(c)
                                                return (
                                                    <li key={c.id}>
                                                        <Card className="campaign-row" hoverable>
                                                            <div className="campaign-row__main">
                                                                <div className="row" style={{ "--gap": "6px" }}>
                                                                    <StatusChip status={c.isPublished ? "published" : "draft"} />
                                                                    <SceneBadge scene={c.scene} />
                                                                    {c.attachmentFilename && <Badge tone="outline" icon={Paperclip}>Attachment</Badge>}
                                                                </div>
                                                                <h3 className="card__title">
                                                                    <button type="button" className="link-button campaign-row__title" onClick={() => setViewCampaignId(c.id)}>
                                                                        {c.title}
                                                                    </button>
                                                                </h3>
                                                                {c.description && <p className="text-sm text-muted">{c.description}</p>}
                                                                <p className="text-xs text-muted">
                                                                    {plural(c._count?.sessions || 0, "finished run")} · {plural(c._count?.progress || 0, "player")} with saved progress
                                                                </p>
                                                            </div>
                                                            <div className="campaign-row__actions">
                                                                <Button size="sm" variant="secondary" icon={Play} onClick={() => handlePlay(c)} loading={startingId === c.id} disabled={startingId !== null && startingId !== c.id}>
                                                                    Preview<span className="sr-only">: {c.title}</span>
                                                                </Button>
                                                                {editable && (
                                                                    <Button size="sm" variant="soft" icon={Pencil} onClick={() => openEditCampaign(c.id)} loading={loadingEditId === c.id}>
                                                                        Edit<span className="sr-only">: {c.title}</span>
                                                                    </Button>
                                                                )}
                                                                <Menu
                                                                    label={`${c.title} options`}
                                                                    renderTrigger={(props) => <IconButton icon={MoreVertical} size="sm" label={`More options for ${c.title}`} {...props} />}
                                                                    items={[
                                                                        { label: "View entries", icon: Eye, onSelect: () => setViewCampaignId(c.id) },
                                                                        !c.isPublished && { label: "Publish", icon: Rocket, onSelect: () => setConfirm({ kind: "publish", target: c }) },
                                                                        c.isPublished && { label: "Unpublish", icon: EyeOff, onSelect: () => setConfirm({ kind: "unpublish", target: c }) },
                                                                        { label: "Duplicate as new draft", icon: CopyPlus, onSelect: () => handleDuplicateCampaign(c) },
                                                                        { label: "Delete campaign", icon: Trash2, danger: true, separatorBefore: true, onSelect: () => setConfirm({ kind: "delete", target: c }) },
                                                                    ].filter(Boolean)}
                                                                />
                                                            </div>
                                                            {!editable && !c.isPublished && (
                                                                <p className="campaign-row__note text-xs text-muted">Played already, so its entries are locked. Duplicate it to make changes.</p>
                                                            )}
                                                        </Card>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    )}
                                </div>
                            ) : (
                                <div className="stack">
                                    <div className="toolbar">
                                        <TextField
                                            label="Search students"
                                            icon={Search}
                                            type="search"
                                            value={studentQuery}
                                            onChange={(e) => setStudentQuery(e.target.value)}
                                            placeholder="Name or email"
                                            className="toolbar__search"
                                        />
                                        {!showAddStudent && <Button variant="accent" icon={UserPlus} onClick={() => setShowAddStudent(true)}>Add student</Button>}
                                    </div>

                                    {showAddStudent && (
                                        <AddStudentForm
                                            roomId={id}
                                            onCancel={() => setShowAddStudent(false)}
                                            onAdded={() => {
                                                toast.success("Student added to the room.")
                                                refresh()
                                            }}
                                        />
                                    )}

                                    <Alert tone="info">
                                        Students can also join themselves with the room code <strong className="mono">{room?.roomCode}</strong>. Per-student results aren't
                                        available yet - the server has no endpoint for them. Run totals per campaign are on the Campaigns tab.
                                    </Alert>

                                    {!room ? (
                                        <Skeleton height={180} />
                                    ) : students.length === 0 ? (
                                        <EmptyState icon={Users} title="No students yet">Share the room code with your class, or add students by email.</EmptyState>
                                    ) : visibleStudents.length === 0 ? (
                                        <EmptyState plain icon={Search} title="No students match">Try a different name or email.</EmptyState>
                                    ) : (
                                        <Card flush>
                                            <table className="data-table">
                                                <caption className="sr-only">Students in {room.name}</caption>
                                                <thead>
                                                    <tr>
                                                        <th scope="col">Student</th>
                                                        <th scope="col">Email</th>
                                                        <th scope="col">Status</th>
                                                        <th scope="col"><span className="sr-only">Actions</span></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {visibleStudents.map(({ student }) => {
                                                        const online = members ? activeStudentIds.has(student.id) : undefined
                                                        return (
                                                            <tr key={student.id}>
                                                                <td data-primary>
                                                                    <span className="row row-nowrap" style={{ "--gap": "10px" }}>
                                                                        <Avatar name={student.name} size={32} online={online} />
                                                                        <span className="font-semibold">{student.name}</span>
                                                                    </span>
                                                                </td>
                                                                <td data-label="Email" className="break-words">{student.email}</td>
                                                                <td data-label="Status">
                                                                    {online === undefined ? <span className="text-xs text-muted">Checking...</span> : <OnlineIndicator online={online} showOffline />}
                                                                </td>
                                                                <td style={{ textAlign: "right" }}>
                                                                    <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={() => setConfirm({ kind: "removeStudent", target: student })}>
                                                                        Remove<span className="sr-only"> {student.name}</span>
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </Card>
                                    )}
                                </div>
                            )}
                        </Tabs>
                    </div>
                </>
            )}

            {(showCreateCampaign || editingCampaign) && (
                <CampaignEditor
                    roomId={id}
                    campaign={editingCampaign}
                    onClose={() => { setShowCreateCampaign(false); setEditingCampaign(null) }}
                    onSaved={handleCampaignSaved}
                />
            )}

            {viewCampaignId && <CampaignViewer campaignId={viewCampaignId} onClose={() => setViewCampaignId(null)} />}

            {showEditRoom && room && (
                <EditRoomModal
                    room={room}
                    onClose={() => setShowEditRoom(false)}
                    onSaved={() => {
                        setShowEditRoom(false)
                        toast.success("Room details saved.")
                        refresh()
                    }}
                />
            )}

            {confirm && (
                <ConfirmDialog
                    title={confirmCopy.title}
                    confirmLabel={confirmCopy.label}
                    tone={confirmCopy.tone || "danger"}
                    loading={confirmBusy}
                    error={confirmError}
                    onCancel={() => { setConfirm(null); setConfirmError("") }}
                    onConfirm={runConfirmed}
                >
                    {confirmCopy.body}
                </ConfirmDialog>
            )}
        </div>
    )
}

export default RoomPage
