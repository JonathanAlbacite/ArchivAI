import React from 'react'
import Navbar from '../../components/Navbar'
import dashboard_bg from '../../assets/dashboard_bg.png'
import { useState, useEffect } from 'react'
import { useNavigate } from "react-router-dom";

function TeacherDashboard() {

  const [showModal, setShowModal] = useState(false)
  const [roomName, setRoomName] = useState("")
  const [roomDescription, setRoomDescription] = useState("")
  const [rooms, setRooms] = useState([])
  const navigate = useNavigate();

  // Fetch rooms from API
  const fetchRooms = async () => {
    const token = localStorage.getItem("token")
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
    const data = await res.json()
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

  return (
    // Outer wrapper - full page
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      {/* Top navbar */}
      <Navbar />

      {/* Below navbar - content area with background */}
      <div style={{ display: "flex", minHeight: "100vh", backgroundImage: `url(${dashboard_bg})`, backgroundSize: "cover", backgroundPosition: "center" }}>

        {/* Main cream panel */}
        <div style={{ backgroundColor: "#E5D5BE", flex: 1, borderRadius: "24px", margin: "20px", boxShadow: "0 20px 50px rgba(0,0,0,0.25)", border: "1px solid #D8C7AA" }}>

          {/* Content padding wrapper */}
          <div style={{ padding: "40px" }}>

            {/* Header row - title + create room button */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>

              {/* Title and subtitle */}
              <div>
                <h1 style={{ fontFamily: "Cinzel, serif", fontSize: "32px", color: "#3A2A20", margin: 0 }}>ROOMS</h1>
                <p style={{ color: "#5D5145", fontFamily: "Poppins, sans-serif", fontSize: "14px", margin: 0 }}>Manage your rooms – each has its own students & campaigns.</p>
              </div>

              {/* Create room button */}
              <button onClick={() => setShowModal(true)} style={{ backgroundColor: "#A95B2C", color: "#FFFFFF", border: "none", borderRadius: "18px", padding: "12px 24px", fontFamily: "Poppins, sans-serif", fontWeight: "600", fontSize: "16px", cursor: "pointer" }}>+ Create Room</button>

            </div>

            {/* Room cards grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px", marginTop: "24px" }}>

              {/* Existing room cards */}
              {rooms.map((room) => (
            <div key={room.id} style={{ backgroundColor: "#FFF9EF", borderRadius: "24px", border: "1px solid #E7DCC7", padding: "24px", minHeight: "200px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}>

    {/* Room info */}
    <div>
      <p style={{ fontFamily: "Cinzel, serif", fontWeight: "600", fontSize: "16px", color: "#3A2A20", margin: "0 0 8px 0" }}>{room.name}</p>
      <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "13px", color: "#5D5145", margin: "0 0 8px 0" }}>{room.description}</p>
      <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "13px", color: "#5D5145", margin: 0 }}>{room._count?.students} Students</p>
    </div>

    {/* Enter room button */}
    <button onClick={() => navigate(`/teacher/room/${room.id}`)}
    style={{ width: "100%", padding: "10px", backgroundColor: "#A95B2C", color: "white", border: "none", borderRadius: "18px", fontFamily: "Poppins, sans-serif", fontWeight: "600", fontSize: "14px", cursor: "pointer", marginTop: "16px" }}>
      Enter Room →
    </button>

  </div>
))}

              {/* New room card */}
              <div onClick={() => setShowModal(true)} style={{ backgroundColor: "#FFF9EF", borderRadius: "24px", border: "2px dashed #D8C7AA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", cursor: "pointer", minHeight: "200px" }}>
                <p style={{ fontSize: "32px", color: "#B8864B", margin: 0 }}>+</p>
                <p style={{ fontFamily: "Cinzel, serif", fontWeight: "600", color: "#B8864B", margin: "8px 0 0 0" }}>NEW ROOM</p>
                <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "12px", color: "#5D5145", margin: "4px 0 0 0", textAlign: "center" }}>Start a new room for your students</p>
              </div>

            </div>

            {/* Create Room Modal */}
            {showModal && (
              <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999 }}>

                {/* Modal box */}
                <div style={{ backgroundColor: "#F3E9D7", borderRadius: "24px", padding: "40px", width: "400px", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
                  <h2 style={{ fontFamily: "Cinzel, serif", color: "#3A2A20", margin: "0 0 20px 0" }}>Create Room</h2>

                  <form>
                    {/* Room name input */}
                    <label style={{ fontFamily: "Poppins, sans-serif", color: "#3A2A20", fontWeight: "600" }}>Room Name</label>
                    <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} style={{ width: "100%", padding: "10px", marginTop: "6px", marginBottom: "16px", borderRadius: "12px", border: "1px solid #D8C7AA", boxSizing: "border-box" }} />

                    {/* Description input */}
                    <label style={{ fontFamily: "Poppins, sans-serif", color: "#3A2A20", fontWeight: "600" }}>Description</label>
                    <input type="text" value={roomDescription} onChange={(e) => setRoomDescription(e.target.value)} style={{ width: "100%", padding: "10px", marginTop: "6px", marginBottom: "24px", borderRadius: "12px", border: "1px solid #D8C7AA", boxSizing: "border-box" }} />

                    {/* Buttons */}
                    <div style={{ display: "flex", gap: "12px" }}>
                      <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: "12px", backgroundColor: "#5D5145", color: "white", border: "none", borderRadius: "18px", fontFamily: "Poppins, sans-serif", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                      <button type="button" onClick={handleCreateRoom} style={{ flex: 1, padding: "12px", backgroundColor: "#A95B2C", color: "white", border: "none", borderRadius: "18px", fontFamily: "Poppins, sans-serif", fontWeight: "600", cursor: "pointer" }}>Create</button>
                    </div>
                  </form>

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