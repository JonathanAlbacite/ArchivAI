import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { UserPlus, Trash2, BookOpen, Sparkles } from 'lucide-react'
import dashboard_bg from '../../assets/dashboard_bg.png'
import Navbar from '../../components/Navbar'
import EmberField from '../../components/EmberField'
import SpellBookModal from '../../components/teacher/SpellBookModal'
import CampaignBookViewer from '../../components/teacher/CampaignBookViewer'
import { SceneBadge } from '../../components/SceneIcon'
import { colors, fonts } from '../../theme'

function RoomPage() {

    const {id} = useParams()
    const [room, setRoom] = useState(null)
    const [showAddStudent, setShowAddStudent] = useState(false)
    const [studentEmail, setStudentEmail] = useState("")
    const [showCreateCampaign, setShowCreateCampaign] = useState(false)
    const [openCampaignId, setOpenCampaignId] = useState(null)
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
                            Vaults &gt; {room ? room.name : ""}
                        </p>

                        {/* Room header */}
                        <div style={{ marginBottom: "32px" }}>
                            <h1 style={{ fontFamily: fonts.displayDecorative, fontSize: "32px", color: colors.brassBright, margin: "0 0 8px 0" }}>{room?.name}</h1>
                            <p style={{ fontFamily: fonts.body, fontSize: "14px", color: "#C9BBA6", margin: 0 }}>Room Code: <strong style={{ color: colors.emberBright }}>{room?.roomCode}</strong></p>
                        </div>

                        {/* Two sections side by side */}
                        <div style={{ display: "flex", gap: "24px" }}>

                            {/* Students section */}
                            <div style={{ flex: 1, background: "rgba(255,255,255,0.03)", borderRadius: "24px", padding: "24px", border: `1px solid ${colors.vaultBorder}` }}>

                                {/* Students header */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                    <h2 style={{ fontFamily: fonts.display, color: colors.brassBright, margin: 0, fontSize: "18px" }}>Roster Scroll</h2>
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
                                                <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.brassBright, margin: 0 }}>{s.student.name}</p>
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
                                    <h2 style={{ fontFamily: fonts.display, color: colors.brassBright, margin: 0, fontSize: "18px" }}>Spellbook Shelf</h2>
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

            {showCreateCampaign && (
                <SpellBookModal
                    roomId={id}
                    onClose={() => setShowCreateCampaign(false)}
                    onCreated={fetchRoom}
                />
            )}

            {openCampaignId && (
                <CampaignBookViewer
                    campaignId={openCampaignId}
                    onClose={() => setOpenCampaignId(null)}
                />
            )}

        </div>
    )
}

export default RoomPage
