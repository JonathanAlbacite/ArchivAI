import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Compass, Sparkles } from 'lucide-react'
import Navbar from '../../components/Navbar'
import EmberField from '../../components/EmberField'
import dashboard_bg from '../../assets/dashboard_bg.png'
import { colors, fonts } from '../../theme'

function StudentDashboard() {
    const [rooms, setRooms] = useState([])
    const [showJoinModal, setShowJoinModal] = useState(false)
    const [roomCode, setRoomCode] = useState("")
    const [focusedField, setFocusedField] = useState(null)
    const [hoveredRoomId, setHoveredRoomId] = useState(null)
    const navigate = useNavigate()

    const fetchRooms = async () => {
        const token = localStorage.getItem("token")
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms`, {
            headers: { "Authorization": `Bearer ${token}` }
        })
        const data = await res.json()

        if (!res.ok) {
            if (res.status === 401) {
                localStorage.removeItem("token")
                localStorage.removeItem("role")
                localStorage.removeItem("name")
                navigate("/")
                return
            }
            alert(data.message)
            return
        }

        setRooms(data)
    }

    useEffect(() => {
        fetchRooms()
    }, [])

    const handleJoinRoom = async () => {
    const token = localStorage.getItem("token")

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ roomCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message);
        return;
      }

      // Close modal and refresh rooms list
        setShowJoinModal(false);
        setRoomCode("");
        fetchRooms();

    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    }
  }

    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <Navbar />

            {/* Background div */}
            <div style={{ position: "relative", display: "flex", minHeight: "100vh", backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(139,111,179,0.25), rgba(243,233,215,0.85)), url(${dashboard_bg})`, backgroundSize: "cover", backgroundPosition: "center" }}>

                <EmberField variant="sparkle" count={26} />

                {/* Cream panel */}
                <div style={{ position: "relative", backgroundColor: colors.parchmentDark, flex: 1, borderRadius: "24px", margin: "20px", boxShadow: "0 20px 50px rgba(0,0,0,0.25)", border: `1px solid ${colors.magicViolet}55` }}>
                    <div style={{ padding: "40px" }}>

                        {/* Header row */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <p style={{ margin: "0 0 4px 0", fontFamily: fonts.flourish, fontSize: "12px", letterSpacing: "3px", color: colors.magicViolet }}>
                                    ARCHIVIST'S JOURNAL
                                </p>
                                <h1 style={{ fontFamily: fonts.displayDecorative, fontSize: "32px", color: colors.ink, margin: 0 }}>My Rooms</h1>
                                <p style={{ color: colors.inkMuted, fontFamily: fonts.body, fontSize: "14px", margin: "6px 0 0 0" }}>Rooms you are enrolled in</p>
                            </div>
                            <button
                                onClick={() => setShowJoinModal(true)}
                                style={{ display: "flex", alignItems: "center", gap: "8px", background: `linear-gradient(160deg, ${colors.magicVioletBright}, ${colors.magicViolet})`, color: "#FFFFFF", border: "none", borderRadius: "18px", padding: "12px 24px", fontFamily: fonts.body, fontWeight: "600", fontSize: "16px", cursor: "pointer" }}
                            >
                                <Sparkles size={16} /> Join Room
                            </button>
                        </div>

                        {/* Room cards grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px", marginTop: "28px" }}>
                            {rooms.map((room) => {
                                const hovered = hoveredRoomId === room.id
                                return (
                                    <div
                                        key={room.id}
                                        onMouseEnter={() => setHoveredRoomId(room.id)}
                                        onMouseLeave={() => setHoveredRoomId(null)}
                                        style={{
                                            backgroundColor: colors.parchmentPanel,
                                            borderRadius: "24px",
                                            border: `1px solid ${hovered ? colors.magicViolet : colors.parchmentLine}`,
                                            padding: "24px",
                                            minHeight: "200px",
                                            display: "flex",
                                            flexDirection: "column",
                                            justifyContent: "space-between",
                                            boxShadow: hovered ? `0 12px 34px rgba(139,111,179,0.28)` : "0 10px 30px rgba(0,0,0,0.12)",
                                            transition: "border-color 0.25s, box-shadow 0.25s",
                                        }}
                                    >
                                        <div>
                                            <Compass size={20} color={colors.magicViolet} style={{ marginBottom: "8px" }} />
                                            <p style={{ fontFamily: fonts.display, fontWeight: "600", fontSize: "16px", color: colors.ink, margin: "0 0 8px 0" }}>{room.name}</p>
                                            <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.inkMuted, margin: 0 }}>{room.description}</p>
                                        </div>
                                        <button
                                            onClick={() => navigate(`/student/room/${room.id}`)}
                                            style={{ width: "100%", padding: "10px", background: `linear-gradient(160deg, ${colors.magicVioletBright}, ${colors.magicViolet})`, color: "white", border: "none", borderRadius: "18px", fontFamily: fonts.body, fontWeight: "600", fontSize: "14px", cursor: "pointer", marginTop: "16px" }}
                                        >
                                            Enter Room →
                                        </button>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Join Room Modal */}
                        {showJoinModal && (
                            <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(43,28,63,0.55)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999 }}>
                                <div style={{ background: `linear-gradient(160deg, ${colors.magicVioletBright}, ${colors.magicViolet})`, borderRadius: "26px", padding: "3px", boxShadow: "0 20px 60px rgba(0,0,0,0.35)", animation: "bookOpen 0.4s ease-out" }}>
                                    <div style={{ backgroundColor: colors.parchment, borderRadius: "24px", padding: "40px", width: "380px", boxSizing: "border-box" }}>
                                        <p style={{ margin: "0 0 4px 0", fontFamily: fonts.flourish, fontSize: "11px", letterSpacing: "2px", color: colors.magicViolet, textAlign: "center" }}>AN INVITATION AWAITS</p>
                                        <h2 style={{ fontFamily: fonts.displayDecorative, color: colors.ink, margin: "0 0 20px 0", textAlign: "center", fontSize: "24px" }}>Join Room</h2>
                                        <label style={{ fontFamily: fonts.body, color: colors.ink, fontWeight: "600", fontSize: "13px" }}>Room Code</label>
                                        <input
                                            type="text"
                                            value={roomCode}
                                            onChange={(e) => setRoomCode(e.target.value)}
                                            onFocus={() => setFocusedField("code")}
                                            onBlur={() => setFocusedField(null)}
                                            placeholder="Enter room code"
                                            style={{
                                                width: "100%",
                                                padding: "11px 14px",
                                                marginTop: "6px",
                                                marginBottom: "24px",
                                                borderRadius: "12px",
                                                border: `1px solid ${focusedField === "code" ? colors.magicViolet : colors.parchmentLine}`,
                                                backgroundColor: colors.parchmentPanel,
                                                boxSizing: "border-box",
                                                fontFamily: fonts.body,
                                                outline: "none",
                                                boxShadow: focusedField === "code" ? `0 0 0 3px ${colors.magicViolet}33` : "none",
                                                transition: "border-color 0.2s, box-shadow 0.2s",
                                            }}
                                        />
                                        <div style={{ display: "flex", gap: "12px" }}>
                                            <button onClick={() => setShowJoinModal(false)} style={{ flex: 1, padding: "12px", backgroundColor: "transparent", color: colors.ink, border: `1px solid ${colors.parchmentLine}`, borderRadius: "16px", fontFamily: fonts.body, fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                                            <button onClick={handleJoinRoom} style={{ flex: 1, padding: "12px", background: `linear-gradient(160deg, ${colors.magicVioletBright}, ${colors.magicViolet})`, color: "white", border: "none", borderRadius: "16px", fontFamily: fonts.body, fontWeight: "600", cursor: "pointer" }}>Join</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    )
}

export default StudentDashboard
