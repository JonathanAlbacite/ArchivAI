import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, DoorOpen, Sparkles } from "lucide-react";
import Navbar from "../../components/Navbar";
import EmberField from "../../components/EmberField";
import dashboard_bg from "../../assets/dashboard_bg.png";
import { colors, fonts } from "../../theme";

function TeacherDashboard() {
  const [showModal, setShowModal] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [rooms, setRooms] = useState([]);
  const [hoveredRoomId, setHoveredRoomId] = useState(null);
  const [newCardHover, setNewCardHover] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const navigate = useNavigate();

  // Fetch rooms from API
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

  // Fetch rooms on page load
  useEffect(() => {
    fetchRooms()
  }, [])

  // Create room handler
  const handleCreateRoom = async () => {
    const token = localStorage.getItem("token")

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: roomName, description: roomDescription }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message);
        return;
      }

      // Close modal and refresh rooms list
      setShowModal(false);
      setRoomName("");
      setRoomDescription("");
      fetchRooms();

    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    }
  }

  const inputStyle = (field) => ({
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
    transition: "border-color 0.2s, box-shadow 0.2s",
  });

  return (
    // Outer wrapper - full page
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      {/* Top navbar */}
      <Navbar />

      {/* Below navbar - content area with dark vignette background */}
      <div
        style={{
          position: "relative",
          display: "flex",
          minHeight: "100vh",
          backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(60,38,20,0.45), rgba(6,4,2,0.94)), url(${dashboard_bg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <EmberField variant="ember" count={26} />

        {/* Main obsidian panel */}
        <div
          style={{
            position: "relative",
            background: `linear-gradient(165deg, ${colors.wood} 0%, ${colors.obsidian} 100%)`,
            flex: 1,
            borderRadius: "24px",
            margin: "20px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
            border: `1px solid ${colors.vaultBorder}`,
          }}
        >

          {/* Content padding wrapper */}
          <div style={{ padding: "40px" }}>

            {/* Header row - title + create room button */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>

              {/* Title and subtitle */}
              <div>
                <p style={{ margin: "0 0 4px 0", fontFamily: fonts.flourish, fontSize: "12px", letterSpacing: "3px", color: colors.brass }}>
                  KEEPER'S HALL
                </p>
                <h1 style={{ fontFamily: fonts.displayDecorative, fontSize: "34px", color: colors.brassBright, margin: 0 }}>Your Vaults</h1>
                <p style={{ color: "#C9BBA6", fontFamily: fonts.body, fontSize: "14px", margin: "6px 0 0 0" }}>Manage your rooms – each has its own students & campaigns.</p>
              </div>

              {/* Create room button */}
              <button
                onClick={() => setShowModal(true)}
                style={{
                  background: `linear-gradient(160deg, ${colors.emberBright}, ${colors.ember})`,
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "18px",
                  padding: "13px 26px",
                  fontFamily: fonts.body,
                  fontWeight: "600",
                  fontSize: "15px",
                  cursor: "pointer",
                  animation: "glowPulse 3s ease-in-out infinite",
                }}
              >
                + Create Room
              </button>

            </div>

            {/* Room cards grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px", marginTop: "28px" }}>

              {/* Existing room cards */}
              {rooms.map((room) => {
                const hovered = hoveredRoomId === room.id;
                return (
                  <div
                    key={room.id}
                    onMouseEnter={() => setHoveredRoomId(room.id)}
                    onMouseLeave={() => setHoveredRoomId(null)}
                    style={{
                      background: `linear-gradient(165deg, #241A10 0%, ${colors.obsidian} 100%)`,
                      borderRadius: "20px",
                      border: `1px solid ${hovered ? colors.emberBright : colors.vaultBorder}`,
                      padding: "22px",
                      minHeight: "190px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      boxShadow: hovered ? `0 10px 34px rgba(0,0,0,0.5), 0 0 22px ${colors.emberBright}44` : "0 10px 24px rgba(0,0,0,0.4)",
                      transition: "border-color 0.25s, box-shadow 0.25s",
                    }}
                  >
                    <div>
                      <DoorOpen size={22} color={hovered ? colors.emberBright : colors.brass} style={{ marginBottom: "10px" }} />
                      <p style={{ fontFamily: fonts.display, fontWeight: "600", fontSize: "16px", color: colors.brassBright, margin: "0 0 8px 0" }}>{room.name}</p>
                      <p style={{ fontFamily: fonts.body, fontSize: "13px", color: "#B9AC96", margin: "0 0 10px 0" }}>{room.description}</p>
                      <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.brass, margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                        <Users size={13} /> {room._count?.students} Students
                      </p>
                    </div>

                    <button
                      onClick={() => navigate(`/teacher/room/${room.id}`)}
                      style={{
                        width: "100%",
                        padding: "10px",
                        background: hovered ? `linear-gradient(160deg, ${colors.emberBright}, ${colors.ember})` : "transparent",
                        color: hovered ? "white" : colors.brassBright,
                        border: `1px solid ${colors.ember}`,
                        borderRadius: "18px",
                        fontFamily: fonts.body,
                        fontWeight: "600",
                        fontSize: "14px",
                        cursor: "pointer",
                        marginTop: "16px",
                        transition: "background 0.25s, color 0.25s",
                      }}
                    >
                      Enter Vault →
                    </button>

                  </div>
                );
              })}

              {/* New room card */}
              <div
                onClick={() => setShowModal(true)}
                onMouseEnter={() => setNewCardHover(true)}
                onMouseLeave={() => setNewCardHover(false)}
                style={{
                  backgroundColor: "rgba(255,255,255,0.02)",
                  borderRadius: "20px",
                  border: `2px dashed ${newCardHover ? colors.emberBright : colors.vaultBorder}`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "40px",
                  cursor: "pointer",
                  minHeight: "190px",
                  transition: "border-color 0.25s",
                }}
              >
                <Sparkles size={30} color={newCardHover ? colors.emberBright : colors.brass} />
                <p style={{ fontFamily: fonts.display, fontWeight: "600", color: newCardHover ? colors.emberBright : colors.brass, margin: "10px 0 0 0" }}>NEW VAULT</p>
                <p style={{ fontFamily: fonts.body, fontSize: "12px", color: "#B9AC96", margin: "4px 0 0 0", textAlign: "center" }}>Start a new room for your students</p>
              </div>

            </div>

            {/* Create Room Modal */}
            {showModal && (
              <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(8,5,3,0.72)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999 }}>

                {/* Modal box */}
                <div
                  style={{
                    background: `linear-gradient(165deg, ${colors.vaultBorder}, ${colors.obsidian})`,
                    borderRadius: "24px",
                    padding: "3px",
                    width: "400px",
                    boxShadow: "0 25px 70px rgba(0,0,0,0.6)",
                    animation: "bookOpen 0.4s ease-out",
                  }}
                >
                  <div style={{ backgroundColor: colors.parchment, borderRadius: "22px", padding: "36px" }}>
                    <h2 style={{ fontFamily: fonts.displayDecorative, color: colors.ink, margin: "0 0 20px 0", fontSize: "26px" }}>Create Vault</h2>

                    <form>
                      {/* Room name input */}
                      <label style={{ fontFamily: fonts.body, color: colors.ink, fontWeight: "600", fontSize: "13px" }}>Room Name</label>
                      <input
                        type="text"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        onFocus={() => setFocusedField("name")}
                        onBlur={() => setFocusedField(null)}
                        style={{ ...inputStyle("name"), marginBottom: "16px" }}
                      />

                      {/* Description input */}
                      <label style={{ fontFamily: fonts.body, color: colors.ink, fontWeight: "600", fontSize: "13px" }}>Description</label>
                      <input
                        type="text"
                        value={roomDescription}
                        onChange={(e) => setRoomDescription(e.target.value)}
                        onFocus={() => setFocusedField("description")}
                        onBlur={() => setFocusedField(null)}
                        style={{ ...inputStyle("description"), marginBottom: "24px" }}
                      />

                      {/* Buttons */}
                      <div style={{ display: "flex", gap: "12px" }}>
                        <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: "12px", backgroundColor: "transparent", color: colors.ink, border: `1px solid ${colors.vaultBorder}66`, borderRadius: "16px", fontFamily: fonts.body, fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                        <button type="button" onClick={handleCreateRoom} style={{ flex: 1, padding: "12px", background: `linear-gradient(160deg, ${colors.emberBright}, ${colors.ember})`, color: "white", border: "none", borderRadius: "16px", fontFamily: fonts.body, fontWeight: "600", cursor: "pointer" }}>Create</button>
                      </div>
                    </form>
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

export default TeacherDashboard
