import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { UserPlus, Trash2, BookOpen, Sparkles, Pencil, Wand2, ArrowLeft, Menu, EyeOff, Copy, ChevronDown } from 'lucide-react'
import dashboard_bg from '../../assets/dashboard_bg.png'
import Navbar from '../../components/Navbar'
import EmberField from '../../components/EmberField'
import PortalTransition from '../../components/PortalTransition'
import UnityGame from '../../components/UnityGame'
import SpellBookModal from '../../components/teacher/SpellBookModal'
import CampaignBookViewer from '../../components/teacher/CampaignBookViewer'
import { SceneBadge } from '../../components/SceneIcon'
import { getSceneMeta } from '../../scenes'
import ActiveBadge from '../../components/ActiveBadge'
import useRoomMembers from '../../lib/useRoomMembers'
import { colors, fonts } from '../../theme'

function RoomPage() {

    const {id} = useParams()
    const [room, setRoom] = useState(null)
    const members = useRoomMembers(id)
    const activeStudentIds = new Set((members?.students || []).filter((m) => m.active).map((m) => m.id))
    const [showAddStudent, setShowAddStudent] = useState(false)
    const [studentEmail, setStudentEmail] = useState("")
    const [showCreateCampaign, setShowCreateCampaign] = useState(false)
    const [openCampaignId, setOpenCampaignId] = useState(null)
    const [editingCampaign, setEditingCampaign] = useState(null)
    const [loadingEditId, setLoadingEditId] = useState(null)
    const [portalActive, setPortalActive] = useState(false)
    const [gameLoading, setGameLoading] = useState(false)
    const [activeCampaign, setActiveCampaign] = useState(null)
    const [openMenuId, setOpenMenuId] = useState(null)
    const [roomMenuOpen, setRoomMenuOpen] = useState(false)
    const [showEditRoom, setShowEditRoom] = useState(false)
    const [editRoomName, setEditRoomName] = useState("")
    const [editRoomDescription, setEditRoomDescription] = useState("")
    const [focusedField, setFocusedField] = useState(null)
    const navigate = useNavigate()

    const fetchRoom = async () => {
        const token = localStorage.getItem("token")
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${id}`, {
            headers: { "Authorization": `Bearer ${token}` }
        })
        const data = await res.json()
        setRoom(data)
    }

    useEffect(() => {
        fetchRoom()
    }, [id])

    // A click anywhere else closes the campaign / room dropdown menus (their own
    // buttons stop the click from reaching here).
    useEffect(() => {
        const closeMenus = () => {
            setOpenMenuId(null)
            setRoomMenuOpen(false)
        }
        document.addEventListener("click", closeMenus)
        return () => document.removeEventListener("click", closeMenus)
    }, [])

    const handleOpenEditRoom = () => {
        setRoomMenuOpen(false)
        setEditRoomName(room?.name || "")
        setEditRoomDescription(room?.description || "")
        setShowEditRoom(true)
    }

    const handleSaveRoom = async () => {
        if (!editRoomName.trim()) {
            alert("The room needs a name.")
            return
        }

        const token = localStorage.getItem("token")

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ name: editRoomName.trim(), description: editRoomDescription }),
            })

            const data = await res.json()

            if (!res.ok) {
                alert(data.message)
                return
            }

            setShowEditRoom(false)
            fetchRoom()

        } catch (err) {
            console.error(err)
            alert("Something went wrong.")
        }
    }

    const handleAddStudent = async () => {
        const token = localStorage.getItem("token")

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${id}/students`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ email: studentEmail }),
            })

            const data = await res.json()

            if (!res.ok) {
                alert(data.message)
                return
            }

            setShowAddStudent(false)
            setStudentEmail("")
            fetchRoom()

        } catch (err) {
            console.error(err)
            alert("Something went wrong.")
        }
    }

    const handleRemoveStudent = async (studentId) => {
    const token = localStorage.getItem("token")

    try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${id}/students/${studentId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        })

        const data = await res.json()

        if (!res.ok) {
            alert(data.message)
            return
        }

        setRoom(prev => ({
  ...prev,
  students: prev.students.filter(s => s.student.id !== studentId)
}))

    } catch (err) {
        console.error(err)
        alert("Something went wrong.")
    }
}

    const handleDeleteCampaign = async (campaignId, title) => {
    setOpenMenuId(null)
    if (!confirm(`Delete "${title}"? This also deletes all its clues and any student play history. This can't be undone.`)) return

    const token = localStorage.getItem("token")

    try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${campaignId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        })

        const data = await res.json()

        if (!res.ok) {
            alert(data.message)
            return
        }

        setRoom(prev => ({
            ...prev,
            campaigns: prev.campaigns.filter(c => c.id !== campaignId)
        }))

    } catch (err) {
        console.error(err)
        alert("Something went wrong.")
    }
}

    // Hides a published campaign from students again. Nothing is deleted - the
    // clues and every recorded play stay, and the teacher can still open it.
    const handleUnpublishCampaign = async (campaign) => {
        setOpenMenuId(null)
        if (!confirm(`Unpublish "${campaign.title}"? Students will no longer see or play it. Its clues and play history are kept.`)) return

        const token = localStorage.getItem("token")

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${campaign.id}/unpublish`, {
                method: "PATCH",
                headers: { "Authorization": `Bearer ${token}` }
            })

            const data = await res.json()

            if (!res.ok) {
                alert(data.message)
                return
            }

            setRoom(prev => ({
                ...prev,
                campaigns: prev.campaigns.map(c => c.id === campaign.id ? { ...c, isPublished: false } : c)
            }))

        } catch (err) {
            console.error(err)
            alert("Something went wrong.")
        }
    }

    // "Update campaign" - creates a new unpublished copy (clues included, no
    // attachment) so the original and its play history stay untouched.
    const handleUpdateCampaign = async (campaign) => {
        setOpenMenuId(null)
        const token = localStorage.getItem("token")

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${campaign.id}/duplicate`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            })

            const data = await res.json()

            if (!res.ok) {
                alert(data.message)
                return
            }

            fetchRoom()

        } catch (err) {
            console.error(err)
            alert("Something went wrong.")
        }
    }

    // Mirrors the Student side's Play flow - marks this campaign as the
    // room's active campaign (same endpoint the Student "Play" button
    // calls), then mounts the same UnityGame component the student would
    // see. Lets a teacher preview/test a campaign exactly as a student
    // would experience it.
    const handlePlay = async (campaign) => {
        const token = localStorage.getItem("token")

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${id}/active-campaign`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ campaignId: campaign.id }),
            })

            if (!res.ok) {
                const data = await res.json()
                alert(data.message || "Could not start this campaign.")
                return
            }
        } catch (err) {
            console.error(err)
            alert("Something went wrong starting the campaign.")
            return
        }

        setActiveCampaign(campaign)
        setPortalActive(true)
    }

    const handlePortalComplete = () => {
        setPortalActive(false)
        setGameLoading(true)
    }

    const handleReturnToRoom = () => {
        setGameLoading(false)
        setActiveCampaign(null)
    }

    // The room's campaign list (from GET /api/rooms/:id) doesn't include
    // clues, so editing needs a fresh fetch of the full campaign first —
    // same endpoint CampaignBookViewer uses, which already returns clues
    // (with answers) for the owning teacher.
    const openEditCampaign = async (campaignId) => {
        const token = localStorage.getItem("token")
        setLoadingEditId(campaignId)

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${campaignId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
            const data = await res.json()

            if (!res.ok) {
                alert(data.message)
                return
            }

            setEditingCampaign(data)
        } catch (err) {
            console.error(err)
            alert("Something went wrong.")
        } finally {
            setLoadingEditId(null)
        }
    }

    const menuItemStyle = (danger) => ({
        display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "8px 12px",
        background: "none", border: "none", borderRadius: "8px",
        color: danger ? "#D9786F" : "#E5D5BE",
        fontFamily: fonts.body, fontSize: "12px", fontWeight: "600", textAlign: "left", whiteSpace: "nowrap", cursor: "pointer"
    })

    const dropdownStyle = {
        position: "absolute", right: 0, top: "100%", marginTop: "6px", minWidth: "170px", padding: "4px",
        backgroundColor: colors.obsidian, border: `1px solid ${colors.vaultBorder}`, borderRadius: "12px",
        boxShadow: "0 12px 30px rgba(0,0,0,0.5)", zIndex: 20
    }

    const roomInputStyle = (field) => ({
        width: "100%",
        padding: "11px 14px",
        marginTop: "6px",
        borderRadius: "12px",
        border: `1px solid ${focusedField === field ? colors.ember : colors.parchmentLine}`,
        backgroundColor: colors.parchmentPanel,
        boxSizing: "border-box",
        fontFamily: fonts.body,
        fontSize: "14px",
        color: colors.ink,
        outline: "none",
        boxShadow: focusedField === field ? `0 0 0 3px ${colors.ember}33` : "none",
    })

    if (gameLoading && activeCampaign) {
        const sceneMeta = getSceneMeta(activeCampaign.scene)
        return (
            <div style={{ position: "fixed", inset: 0, backgroundColor: colors.obsidianDeep, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 500 }}>
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 40%, ${sceneMeta.color}33, transparent 60%)`, pointerEvents: "none" }} />

                <sceneMeta.Icon size={54} color={sceneMeta.color} />
                <h1 style={{ fontFamily: fonts.displayDecorative, fontSize: "28px", color: colors.brassBright, margin: "20px 0 6px 0", textAlign: "center" }}>
                    {activeCampaign.title}
                </h1>
                <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.emberBright, opacity: 0.85, margin: "0 0 20px 0" }}>
                    Previewing the {sceneMeta.label}...
                </p>

                <UnityGame
                    token={localStorage.getItem("token")}
                    roomId={id}
                    onError={() => alert("Could not load the game - check the browser console for details.")}
                />

                <button
                    onClick={handleReturnToRoom}
                    style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "8px", background: "transparent", color: colors.brassBright, border: `1px solid ${colors.vaultBorder}`, borderRadius: "16px", padding: "10px 20px", fontFamily: fonts.body, fontWeight: "600", fontSize: "13px", cursor: "pointer" }}
                >
                    <ArrowLeft size={14} /> Return to Room
                </button>
            </div>
        )
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

            {/* Navbar */}
            <Navbar />

            {/* Background div */}
            <div style={{ position: "relative", display: "flex", minHeight: "100vh", backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(60,38,20,0.45), rgba(6,4,2,0.94)), url(${dashboard_bg})`, backgroundSize: "cover", backgroundPosition: "center" }}>

                <EmberField variant="ember" count={22} />

                {/* Obsidian panel */}
                <div style={{ position: "relative", background: `linear-gradient(165deg, ${colors.wood} 0%, ${colors.obsidian} 100%)`, flex: 1, borderRadius: "24px", margin: "20px", boxShadow: "0 20px 60px rgba(0,0,0,0.55)", border: `1px solid ${colors.vaultBorder}` }}>
                    <div style={{ padding: "40px" }}>

                        {/* Breadcrumb */}
                        <p onClick={() => navigate("/teacher/dashboard")} style={{ cursor: "pointer", color: colors.brass, fontFamily: fonts.body, fontSize: "14px", marginBottom: "16px" }}>
                            Rooms &gt; {room ? room.name : ""}
                        </p>

                        {/* Room header */}
                        <div style={{ marginBottom: "32px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                                <h1 style={{ fontFamily: fonts.displayDecorative, fontSize: "32px", color: colors.brassBright, margin: 0 }}>{room?.name}</h1>
                                <div style={{ position: "relative" }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); setRoomMenuOpen(!roomMenuOpen) }}
                                        title="Room options"
                                        style={{ background: "none", border: `1px solid ${colors.vaultBorder}`, borderRadius: "10px", cursor: "pointer", display: "flex", padding: "4px" }}
                                    >
                                        <ChevronDown size={16} color="#C9BBA6" />
                                    </button>
                                    {roomMenuOpen && (
                                        <div style={{ ...dropdownStyle, right: "auto", left: 0 }} onClick={(e) => e.stopPropagation()}>
                                            <button onClick={handleOpenEditRoom} style={menuItemStyle(false)}>
                                                <Pencil size={13} /> Edit room
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <p style={{ fontFamily: fonts.body, fontSize: "14px", color: "#C9BBA6", margin: 0 }}>Room Code: <strong style={{ color: colors.emberBright }}>{room?.roomCode}</strong></p>
                        </div>

                        {/* Two sections side by side */}
                        <div style={{ display: "flex", gap: "24px" }}>

                            {/* Students section */}
                            <div style={{ flex: 1, background: "rgba(255,255,255,0.03)", borderRadius: "24px", padding: "24px", border: `1px solid ${colors.vaultBorder}` }}>

                                {/* Students header */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                    <h2 style={{ fontFamily: fonts.display, color: colors.brassBright, margin: 0, fontSize: "18px" }}>Students</h2>
                                    <button onClick={() => setShowAddStudent(true)} style={{ display: "flex", alignItems: "center", gap: "6px", background: `linear-gradient(160deg, ${colors.emberBright}, ${colors.ember})`, color: "white", border: "none", borderRadius: "18px", padding: "8px 16px", fontFamily: fonts.body, fontWeight: "600", fontSize: "13px", cursor: "pointer" }}>
                                        <UserPlus size={14} /> Add Student
                                    </button>
                                </div>

                                {/* Students list */}
                                {room?.students?.length === 0 ? (
                                    <p style={{ fontFamily: fonts.body, color: "#B9AC96", fontSize: "13px" }}>No students yet</p>
                                ) : (
                                    room?.students?.map((s) => (
                                        <div key={s.student.id} style={{ display: "flex", padding: "10px 0", borderBottom: `1px solid ${colors.vaultBorder}`, justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                    <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.brassBright, margin: 0 }}>{s.student.name}</p>
                                                    <ActiveBadge active={activeStudentIds.has(s.student.id)} />
                                                </div>
                                                <p style={{ fontFamily: fonts.body, fontSize: "12px", color: "#B9AC96", margin: 0 }}>{s.student.email}</p>
                                            </div>
                                            <button onClick={() => handleRemoveStudent(s.student.id)} style={{ background: "none", border: "none", color: colors.inkMuted, cursor: "pointer", display: "flex" }}>
                                                <Trash2 size={15} color="#C9BBA6" />
                                            </button>
                                        </div>
                                    ))
                                )}

                                {/* Add student input */}
                                {showAddStudent && (
                                    <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
                                        <input type="email" placeholder="Enter student email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: "12px", border: `1px solid ${colors.vaultBorder}`, backgroundColor: colors.parchmentPanel, fontFamily: fonts.body, boxSizing: "border-box" }} />
                                        <button onClick={handleAddStudent} style={{ background: `linear-gradient(160deg, ${colors.emberBright}, ${colors.ember})`, color: "white", border: "none", borderRadius: "12px", padding: "8px 16px", fontFamily: fonts.body, fontWeight: "600", cursor: "pointer" }}>Add</button>
                                        <button onClick={() => setShowAddStudent(false)} style={{ backgroundColor: "transparent", color: "#C9BBA6", border: `1px solid ${colors.vaultBorder}`, borderRadius: "12px", padding: "8px 16px", fontFamily: fonts.body, fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                                    </div>
                                )}

                            </div>

                            {/* Campaigns section */}
                            <div style={{ flex: 1, background: "rgba(255,255,255,0.03)", borderRadius: "24px", padding: "24px", border: `1px solid ${colors.vaultBorder}` }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                    <h2 style={{ fontFamily: fonts.display, color: colors.brassBright, margin: 0, fontSize: "18px" }}>Campaigns</h2>
                                    <button onClick={() => setShowCreateCampaign(true)} style={{ display: "flex", alignItems: "center", gap: "6px", background: `linear-gradient(160deg, ${colors.emberBright}, ${colors.ember})`, color: "white", border: "none", borderRadius: "18px", padding: "8px 16px", fontFamily: fonts.body, fontWeight: "600", fontSize: "13px", cursor: "pointer", animation: "glowPulse 3s ease-in-out infinite" }}>
                                        <Sparkles size={14} /> Create Campaign
                                    </button>
                                </div>

                                {/* Campaigns list */}
                                {room?.campaigns?.length === 0 ? (
                                    <p style={{ fontFamily: fonts.body, color: "#B9AC96", fontSize: "13px" }}>No campaigns yet</p>
                                ) : (
                                    room?.campaigns?.map((c) => (
                                        <div
                                            key={c.id}
                                            onClick={() => setOpenCampaignId(c.id)}
                                            style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 0", borderBottom: `1px solid ${colors.vaultBorder}`, cursor: "pointer" }}
                                        >
                                            <BookOpen size={18} color={colors.emberBright} style={{ marginTop: "2px", flexShrink: 0 }} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                                                    <p style={{ fontFamily: fonts.display, fontWeight: "600", fontSize: "15px", color: colors.brassBright, margin: 0 }}>{c.title}</p>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                                                        <span style={{
                                                            fontFamily: fonts.body,
                                                            fontSize: "11px",
                                                            fontWeight: "600",
                                                            padding: "2px 10px",
                                                            borderRadius: "10px",
                                                            color: c.isPublished ? colors.success : colors.draft,
                                                            backgroundColor: c.isPublished ? colors.successBg : colors.draftBg,
                                                            whiteSpace: "nowrap",
                                                        }}>
                                                            {c.isPublished ? "Published" : "Draft"}
                                                        </span>
                                                        {!c.isPublished && !((c._count?.sessions || 0) + (c._count?.progress || 0) > 0) && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openEditCampaign(c.id) }}
                                                                disabled={loadingEditId === c.id}
                                                                title="Edit campaign"
                                                                style={{ background: "none", border: "none", cursor: loadingEditId === c.id ? "default" : "pointer", color: colors.inkMuted, display: "flex", opacity: loadingEditId === c.id ? 0.5 : 1 }}
                                                            >
                                                                <Pencil size={14} color="#C9BBA6" />
                                                            </button>
                                                        )}
                                                        <div style={{ position: "relative", display: "flex" }}>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setRoomMenuOpen(false); setOpenMenuId(openMenuId === c.id ? null : c.id) }}
                                                                title="Campaign options"
                                                                style={{ background: "none", border: "none", cursor: "pointer", color: colors.inkMuted, display: "flex" }}
                                                            >
                                                                <Menu size={16} color="#C9BBA6" />
                                                            </button>
                                                            {openMenuId === c.id && (
                                                                <div style={dropdownStyle} onClick={(e) => e.stopPropagation()}>
                                                                    {c.isPublished && (
                                                                        <button onClick={() => handleUnpublishCampaign(c)} style={menuItemStyle(false)}>
                                                                            <EyeOff size={13} /> Unpublish
                                                                        </button>
                                                                    )}
                                                                    <button onClick={() => handleUpdateCampaign(c)} style={menuItemStyle(false)}>
                                                                        <Copy size={13} /> Update campaign
                                                                    </button>
                                                                    <button onClick={() => handleDeleteCampaign(c.id, c.title)} style={menuItemStyle(true)}>
                                                                        <Trash2 size={13} /> Delete campaign
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handlePlay(c) }}
                                                            title="Preview this campaign as a student would see it"
                                                            style={{ display: "flex", alignItems: "center", gap: "6px", background: `linear-gradient(160deg, ${colors.emberBright}, ${colors.ember})`, color: "white", border: "none", borderRadius: "14px", padding: "6px 12px", fontFamily: fonts.body, fontWeight: "600", fontSize: "12px", cursor: "pointer", flexShrink: 0 }}
                                                        >
                                                            <Wand2 size={12} /> Play
                                                        </button>
                                                    </div>
                                                </div>
                                                <div style={{ marginTop: "6px" }}>
                                                    <SceneBadge scene={c.scene} />
                                                </div>
                                                {c.description && (
                                                    <p style={{ fontFamily: fonts.body, fontSize: "12px", color: "#B9AC96", margin: "6px 0 0 0" }}>{c.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            {(showCreateCampaign || editingCampaign) && (
                <SpellBookModal
                    roomId={id}
                    campaign={editingCampaign}
                    onClose={() => { setShowCreateCampaign(false); setEditingCampaign(null) }}
                    onSaved={fetchRoom}
                />
            )}

            {openCampaignId && (
                <CampaignBookViewer
                    campaignId={openCampaignId}
                    onClose={() => setOpenCampaignId(null)}
                />
            )}

            {showEditRoom && (
                <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(8,5,3,0.72)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999 }}>
                    <div style={{ background: `linear-gradient(165deg, ${colors.vaultBorder}, ${colors.obsidian})`, borderRadius: "24px", padding: "3px", width: "400px", boxShadow: "0 25px 70px rgba(0,0,0,0.6)", animation: "bookOpen 0.4s ease-out" }}>
                        <div style={{ backgroundColor: colors.parchment, borderRadius: "22px", padding: "36px" }}>
                            <h2 style={{ fontFamily: fonts.displayDecorative, color: colors.ink, margin: "0 0 20px 0", fontSize: "26px" }}>Edit Room</h2>

                            <form>
                                <label style={{ fontFamily: fonts.body, color: colors.ink, fontWeight: "600", fontSize: "13px" }}>Room Name</label>
                                <input
                                    type="text"
                                    value={editRoomName}
                                    onChange={(e) => setEditRoomName(e.target.value)}
                                    onFocus={() => setFocusedField("editName")}
                                    onBlur={() => setFocusedField(null)}
                                    style={{ ...roomInputStyle("editName"), marginBottom: "16px" }}
                                />

                                <label style={{ fontFamily: fonts.body, color: colors.ink, fontWeight: "600", fontSize: "13px" }}>Description</label>
                                <input
                                    type="text"
                                    value={editRoomDescription}
                                    onChange={(e) => setEditRoomDescription(e.target.value)}
                                    onFocus={() => setFocusedField("editDescription")}
                                    onBlur={() => setFocusedField(null)}
                                    style={{ ...roomInputStyle("editDescription"), marginBottom: "24px" }}
                                />

                                <div style={{ display: "flex", gap: "12px" }}>
                                    <button type="button" onClick={() => setShowEditRoom(false)} style={{ flex: 1, padding: "12px", backgroundColor: "transparent", color: colors.ink, border: `1px solid ${colors.vaultBorder}66`, borderRadius: "16px", fontFamily: fonts.body, fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                                    <button type="button" onClick={handleSaveRoom} style={{ flex: 1, padding: "12px", background: `linear-gradient(160deg, ${colors.emberBright}, ${colors.ember})`, color: "white", border: "none", borderRadius: "16px", fontFamily: fonts.body, fontWeight: "600", cursor: "pointer" }}>Save</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {portalActive && (
                <PortalTransition
                    label={activeCampaign ? `Entering ${activeCampaign.title}...` : "The vault opens..."}
                    onComplete={handlePortalComplete}
                />
            )}

        </div>
    )
}

export default RoomPage
