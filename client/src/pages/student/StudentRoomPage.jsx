import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import dashboard_bg from '../../assets/dashboard_bg.png'
import Navbar from '../../components/Navbar'

function StudentRoomPage() {
    const { id } = useParams()
    const [room, setRoom] = useState(null)
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

    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <Navbar />

            {/* Background div */}
            <div style={{ display: "flex", minHeight: "100vh", backgroundImage: `url(${dashboard_bg})`, backgroundSize: "cover", backgroundPosition: "center" }}>

                {/* Cream panel */}
                <div style={{ backgroundColor: "#E5D5BE", flex: 1, borderRadius: "24px", margin: "20px", boxShadow: "0 20px 50px rgba(0,0,0,0.25)", border: "1px solid #D8C7AA" }}>
                    <div style={{ padding: "40px" }}>

                        {/* Breadcrumb */}
                        <p onClick={() => navigate("/student/dashboard")} style={{ cursor: "pointer", color: "#A95B2C", fontFamily: "Poppins, sans-serif", fontSize: "14px", marginBottom: "16px" }}>
                            My Rooms &gt; {room ? room.name : ""}
                        </p>

                        {/* Room header */}
                        <div style={{ marginBottom: "32px" }}>
                            <h1 style={{ fontFamily: "Cinzel, serif", fontSize: "32px", color: "#3A2A20", margin: "0 0 8px 0" }}>{room?.name}</h1>
                            <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "14px", color: "#5D5145", margin: 0 }}>{room?.description}</p>
                        </div>

                        {/* Campaigns section */}
                        <h2 style={{ fontFamily: "Cinzel, serif", color: "#3A2A20", margin: "0 0 16px 0" }}>Campaigns</h2>

                        {room?.campaigns?.length === 0 ? (
                            <p style={{ fontFamily: "Poppins, sans-serif", color: "#5D5145" }}>No campaigns available yet.</p>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px" }}>
                                {room?.campaigns?.map((campaign) => (
                                    <div key={campaign.id} style={{ backgroundColor: "#FFF9EF", borderRadius: "24px", border: "1px solid #E7DCC7", padding: "24px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}>
                                        <div>
                                            <p style={{ fontFamily: "Cinzel, serif", fontWeight: "600", fontSize: "16px", color: "#3A2A20", margin: "0 0 8px 0" }}>{campaign.title}</p>
                                            <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "13px", color: "#5D5145", margin: "0 0 8px 0" }}>{campaign.description}</p>
                                            <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "12px", color: "#A95B2C", margin: 0 }}>{campaign.scene}</p>
                                        </div>
                                        <button style={{ width: "100%", padding: "10px", backgroundColor: "#A95B2C", color: "white", border: "none", borderRadius: "18px", fontFamily: "Poppins, sans-serif", fontWeight: "600", fontSize: "14px", cursor: "pointer", marginTop: "16px" }}>
                                            Play →
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    )
}

export default StudentRoomPage