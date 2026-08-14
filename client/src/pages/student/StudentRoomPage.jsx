import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Wand2, ArrowLeft } from 'lucide-react'
import dashboard_bg from '../../assets/dashboard_bg.png'
import Navbar from '../../components/Navbar'
import EmberField from '../../components/EmberField'
import PortalTransition from '../../components/PortalTransition'
import { SceneBadge, SceneIcon } from '../../components/SceneIcon'
import { getSceneMeta } from '../../scenes'
import { colors, fonts } from '../../theme'

function StudentRoomPage() {
    const { id } = useParams()
    const [room, setRoom] = useState(null)
    const [portalActive, setPortalActive] = useState(false)
    const [gameLoading, setGameLoading] = useState(false)
    const [activeCampaign, setActiveCampaign] = useState(null)
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

    const handlePlay = (campaign) => {
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

    if (gameLoading && activeCampaign) {
        const sceneMeta = getSceneMeta(activeCampaign.scene)
        return (
            <div style={{ position: "fixed", inset: 0, backgroundColor: colors.obsidianDeep, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 500 }}>
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 40%, ${sceneMeta.color}33, transparent 60%)` }} />

                <sceneMeta.Icon size={54} color={sceneMeta.color} />
                <h1 style={{ fontFamily: fonts.displayDecorative, fontSize: "28px", color: colors.softGold, margin: "20px 0 6px 0", textAlign: "center" }}>
                    {activeCampaign.title}
                </h1>
                <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.brassBright, opacity: 0.85, margin: "0 0 28px 0" }}>
                    Entering the {sceneMeta.label}...
                </p>

                {/* Unity WebGL build mounts here once exported (see /public and index.js loader) */}
                <div style={{ width: "260px", height: "6px", borderRadius: "6px", backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <div style={{ width: "60%", height: "100%", background: `linear-gradient(90deg, ${colors.magicVioletBright}, ${colors.softGold})`, animation: "shimmerSweep 1.6s ease-in-out infinite" }} />
                </div>

                <button
                    onClick={handleReturnToRoom}
                    style={{ marginTop: "36px", display: "flex", alignItems: "center", gap: "8px", background: "transparent", color: colors.brassBright, border: `1px solid ${colors.vaultBorder}`, borderRadius: "16px", padding: "10px 20px", fontFamily: fonts.body, fontWeight: "600", fontSize: "13px", cursor: "pointer" }}
                >
                    <ArrowLeft size={14} /> Return to Room
                </button>
            </div>
        )
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <Navbar />

            {/* Background div */}
            <div style={{ position: "relative", display: "flex", minHeight: "100vh", backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(139,111,179,0.25), rgba(243,233,215,0.85)), url(${dashboard_bg})`, backgroundSize: "cover", backgroundPosition: "center" }}>

                <EmberField variant="sparkle" count={22} />

                {/* Cream panel */}
                <div style={{ position: "relative", backgroundColor: colors.parchmentDark, flex: 1, borderRadius: "24px", margin: "20px", boxShadow: "0 20px 50px rgba(0,0,0,0.25)", border: `1px solid ${colors.magicViolet}55` }}>
                    <div style={{ padding: "40px" }}>

                        {/* Breadcrumb */}
                        <p onClick={() => navigate("/student/dashboard")} style={{ cursor: "pointer", color: colors.magicViolet, fontFamily: fonts.body, fontSize: "14px", marginBottom: "16px" }}>
                            My Rooms &gt; {room ? room.name : ""}
                        </p>

                        {/* Room header */}
                        <div style={{ marginBottom: "32px" }}>
                            <h1 style={{ fontFamily: fonts.displayDecorative, fontSize: "32px", color: colors.ink, margin: "0 0 8px 0" }}>{room?.name}</h1>
                            <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.inkMuted, margin: 0 }}>{room?.description}</p>
                        </div>

                        {/* Campaigns section */}
                        <p style={{ margin: "0 0 4px 0", fontFamily: fonts.flourish, fontSize: "12px", letterSpacing: "3px", color: colors.magicViolet }}>
                            AWAITING RIDDLES
                        </p>
                        <h2 style={{ fontFamily: fonts.display, color: colors.ink, margin: "0 0 16px 0" }}>Campaigns</h2>

                        {room?.campaigns?.length === 0 ? (
                            <p style={{ fontFamily: fonts.body, color: colors.inkMuted }}>No campaigns available yet.</p>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px" }}>
                                {room?.campaigns?.map((campaign) => (
                                    <div key={campaign.id} style={{ backgroundColor: colors.parchmentPanel, borderRadius: "24px", border: `1px solid ${colors.parchmentLine}`, padding: "24px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 10px 30px rgba(0,0,0,0.12)" }}>
                                        <div>
                                            <SceneIcon scene={campaign.scene} size={20} />
                                            <p style={{ fontFamily: fonts.display, fontWeight: "600", fontSize: "16px", color: colors.ink, margin: "10px 0 8px 0" }}>{campaign.title}</p>
                                            <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.inkMuted, margin: "0 0 10px 0" }}>{campaign.description}</p>
                                            <SceneBadge scene={campaign.scene} />
                                        </div>
                                        <button
                                            onClick={() => handlePlay(campaign)}
                                            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%", padding: "10px", background: `linear-gradient(160deg, ${colors.magicVioletBright}, ${colors.magicViolet})`, color: "white", border: "none", borderRadius: "18px", fontFamily: fonts.body, fontWeight: "600", fontSize: "14px", cursor: "pointer", marginTop: "16px" }}
                                        >
                                            <Wand2 size={14} /> Play
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>
                </div>
            </div>

            {portalActive && (
                <PortalTransition
                    label={activeCampaign ? `Entering ${activeCampaign.title}...` : "The vault opens..."}
                    onComplete={handlePortalComplete}
                />
            )}
        </div>
    )
}

export default StudentRoomPage
