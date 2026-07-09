import React from 'react'
import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import dashboard_bg from '../../assets/dashboard_bg.png'
import Navbar from '../../components/Navbar'
import { useNavigate } from 'react-router-dom'

function RoomPage() {

    const {id} = useParams()
    const [room, setRoom] = useState(null)
    const [showAddStudent, setShowAddStudent] = useState(false)
    const [studentEmail, setStudentEmail] = useState("")
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
            <div style={{ display: "flex", minHeight: "100vh", backgroundImage: `url(${dashboard_bg})`, backgroundSize: "cover", backgroundPosition: "center" }}>

                {/* Cream panel */}
                <div style={{ backgroundColor: "#E5D5BE", flex: 1, borderRadius: "24px", margin: "20px", boxShadow: "0 20px 50px rgba(0,0,0,0.25)", border: "1px solid #D8C7AA" }}>
                    <div style={{ padding: "40px" }}>

                        {/* Breadcrumb */}
                        <p onClick={() => navigate("/teacher/dashboard")} style={{ cursor: "pointer", color: "#A95B2C", fontFamily: "Poppins, sans-serif", fontSize: "14px", marginBottom: "16px" }}>
                            Rooms &gt; {room ? room.name : ""}
                        </p>

                        {/* Room header */}
                        <div style={{ marginBottom: "32px" }}>
                            <h1 style={{ fontFamily: "Cinzel, serif", fontSize: "32px", color: "#3A2A20", margin: "0 0 8px 0" }}>{room?.name}</h1>
                            <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "14px", color: "#5D5145", margin: 0 }}>Room Code: <strong>{room?.roomCode}</strong></p>
                        </div>

                        {/* Two sections side by side */}
                        <div style={{ display: "flex", gap: "24px" }}>

                            {/* Students section */}
                            <div style={{ flex: 1, backgroundColor: "#FFF9EF", borderRadius: "24px", padding: "24px", border: "1px solid #E7DCC7" }}>

                                {/* Students header */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                    <h2 style={{ fontFamily: "Cinzel, serif", color: "#3A2A20", margin: 0 }}>Students</h2>
                                    <button onClick={() => setShowAddStudent(true)} style={{ backgroundColor: "#A95B2C", color: "white", border: "none", borderRadius: "18px", padding: "8px 16px", fontFamily: "Poppins, sans-serif", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}>+ Add Student</button>
                                </div>

                                {/* Students list */}
                                {room?.students?.length === 0 ? (
                                    <p style={{ fontFamily: "Poppins, sans-serif", color: "#5D5145" }}>No students yet</p>
                                ) : (
                                    room?.students?.map((s) => (
                                        <div key={s.student.id} style={{ display: "flex", padding: "10px 0", borderBottom: "1px solid #E7DCC7", justifyContent: "space-between"}}>
                                            <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "14px", color: "#3A2A20", margin: 0 }}>{s.student.name}</p>
                                            <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "12px", color: "#5D5145", margin: 0 }}>{s.student.email}</p>
                                            <div>
                                                <button onClick={() => handleRemoveStudent(s.student.id)}>Remove</button>
                                            </div>
                                        </div>
                                    ))
                                )}

                                {/* Add student input */}
                                {showAddStudent && (
                                    <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
                                        <input type="email" placeholder="Enter student email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: "12px", border: "1px solid #D8C7AA", fontFamily: "Poppins, sans-serif" }} />
                                        <button onClick={handleAddStudent} style={{ backgroundColor: "#A95B2C", color: "white", border: "none", borderRadius: "12px", padding: "8px 16px", fontFamily: "Poppins, sans-serif", fontWeight: "600", cursor: "pointer" }}>Add</button>
                                        <button onClick={() => setShowAddStudent(false)} style={{ backgroundColor: "#5D5145", color: "white", border: "none", borderRadius: "12px", padding: "8px 16px", fontFamily: "Poppins, sans-serif", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                                    </div>
                                )}

                            </div>

                            {/* Campaigns section */}
                            <div style={{ flex: 1, backgroundColor: "#FFF9EF", borderRadius: "24px", padding: "24px", border: "1px solid #E7DCC7" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                    <h2 style={{ fontFamily: "Cinzel, serif", color: "#3A2A20", margin: 0 }}>Campaigns</h2>
                                    <button style={{ backgroundColor: "#A95B2C", color: "white", border: "none", borderRadius: "18px", padding: "8px 16px", fontFamily: "Poppins, sans-serif", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}>+ Create Campaign</button>
                                </div>
                                <p style={{ fontFamily: "Poppins, sans-serif", color: "#5D5145" }}>No campaigns yet</p>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RoomPage