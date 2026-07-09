import React from 'react'
import Navbar from '../../components/Navbar'
import dashboard_bg from '../../assets/dashboard_bg.png'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function StudentDashboard() {
    const [rooms, setRooms] = useState([])
    const [showJoinModal, setShowJoinModal] = useState(false)
    const [roomCode, setRoomCode] = useState("")
    const navigate = useNavigate()

    const fetchRooms = async () => {
        const token = localStorage.getItem("token")
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms`, {
            headers: { "Authorization": `Bearer ${token}` }
        })
        const data = await res.json()
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
            <div style={{ display: "flex", minHeight: "100vh", backgroundImage: `url(${dashboard_bg})`, backgroundSize: "cover", backgroundPosition: "center" }}>

                {/* Cream panel */}
                <div style={{ backgroundColor: "#E5D5BE", flex: 1, borderRadius: "24px", margin: "20px", boxShadow: "0 20px 50px rgba(0,0,0,0.25)", border: "1px solid #D8C7AA" }}>
                    <div style={{ padding: "40px" }}>

                        {/* Header row */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <h1 style={{ fontFamily: "Cinzel, serif", fontSize: "32px", color: "#3A2A20", margin: 0 }}>MY ROOMS</h1>
                                <p style={{ color: "#5D5145", fontFamily: "Poppins, sans-serif", fontSize: "14px", margin: 0 }}>Rooms you are enrolled in</p>
                            </div>
                            <button onClick={() => setShowJoinModal(true)} style={{ backgroundColor: "#A95B2C", color: "#FFFFFF", border: "none", borderRadius: "18px", padding: "12px 24px", fontFamily: "Poppins, sans-serif", fontWeight: "600", fontSize: "16px", cursor: "pointer" }}>+ Join Room</button>
                        </div>

                        {/* Room cards grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px", marginTop: "24px" }}>
                            {rooms.map((room) => (
                                <div key={room.id} style={{ backgroundColor: "#FFF9EF", borderRadius: "24px", border: "1px solid #E7DCC7", padding: "24px", minHeight: "200px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}>
                                    <div>
                                        <p style={{ fontFamily: "Cinzel, serif", fontWeight: "600", fontSize: "16px", color: "#3A2A20", margin: "0 0 8px 0" }}>{room.name}</p>
                                        <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "13px", color: "#5D5145", margin: 0 }}>{room.description}</p>
                                    </div>
                                    <button onClick={() => navigate(`/student/room/${room.id}`)} style={{ width: "100%", padding: "10px", backgroundColor: "#A95B2C", color: "white", border: "none", borderRadius: "18px", fontFamily: "Poppins, sans-serif", fontWeight: "600", fontSize: "14px", cursor: "pointer", marginTop: "16px" }}>Enter Room →</button>
                                </div>
                            ))}
                        </div>

                        {/* Join Room Modal */}
                        {showJoinModal && (
                            <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999 }}>
                                <div style={{ backgroundColor: "#F3E9D7", borderRadius: "24px", padding: "40px", width: "400px", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
                                    <h2 style={{ fontFamily: "Cinzel, serif", color: "#3A2A20", margin: "0 0 20px 0" }}>Join Room</h2>
                                    <label style={{ fontFamily: "Poppins, sans-serif", color: "#3A2A20", fontWeight: "600" }}>Room Code</label>
                                    <input type="text" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} placeholder="Enter room code" style={{ width: "100%", padding: "10px", marginTop: "6px", marginBottom: "24px", borderRadius: "12px", border: "1px solid #D8C7AA", boxSizing: "border-box" }} />
                                    <div style={{ display: "flex", gap: "12px" }}>
                                        <button onClick={() => setShowJoinModal(false)} style={{ flex: 1, padding: "12px", backgroundColor: "#5D5145", color: "white", border: "none", borderRadius: "18px", fontFamily: "Poppins, sans-serif", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                                        <button onClick={handleJoinRoom} style={{ flex: 1, padding: "12px", backgroundColor: "#A95B2C", color: "white", border: "none", borderRadius: "18px", fontFamily: "Poppins, sans-serif", fontWeight: "600", cursor: "pointer" }}>Join</button>
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