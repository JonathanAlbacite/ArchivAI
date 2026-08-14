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
    const [showCreateCampaign, setShowCreateCampaign] = useState(false)
    const [campaignTitle, setCampaignTitle] = useState("")
    const [campaignDescription, setCampaignDescription] = useState("")
    const [clues, setClues] = useState([{ question: "", answer: "" }])
    const [selectedCampaign, setSelectedCampaign] = useState(null)
    const [campaignLoading, setCampaignLoading] = useState(false)
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

    const handleClueChange = (index, field, value) => {
        setClues(clues.map((c, i) => i === index ? { ...c, [field]: value } : c))
    }

    const handleAddClueRow = () => {
        setClues([...clues, { question: "", answer: "" }])
    }

    const handleRemoveClueRow = (index) => {
        setClues(clues.filter((_, i) => i !== index))
    }

    const handleOpenCampaign = async (campaignId) => {
        const token = localStorage.getItem("token")
        setCampaignLoading(true)

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${campaignId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            })

            const data = await res.json()

            if (!res.ok) {
                alert(data.message)
                return
            }

            setSelectedCampaign(data)

        } catch (err) {
            console.error(err)
            alert("Something went wrong.")
        } finally {
            setCampaignLoading(false)
        }
    }

    const closeCreateCampaign = () => {
        setShowCreateCampaign(false)
        setCampaignTitle("")
        setCampaignDescription("")
        setClues([{ question: "", answer: "" }])
    }

    const handleCreateCampaign = async () => {
        const token = localStorage.getItem("token")

        if (!campaignTitle) {
            alert("Title is required.")
            return
        }

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ title: campaignTitle, description: campaignDescription, roomId: id }),
            })

            const data = await res.json()

            if (!res.ok) {
                alert(data.message)
                return
            }

            const newCampaignId = data.id

            const filledClues = clues.filter(c => c.question && c.answer)

            if (filledClues.length > 0) {
                const cluesRes = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${newCampaignId}/clues`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({ clues: filledClues }),
                })

                const cluesData = await cluesRes.json()

                if (!cluesRes.ok) {
                    alert(cluesData.message)
                    return
                }
            }

            const publishRes = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${newCampaignId}/publish`, {
                method: "PATCH",
                headers: { "Authorization": `Bearer ${token}` },
            })

            const publishData = await publishRes.json()

            if (!publishRes.ok) {
                alert(publishData.message)
                return
            }

            closeCreateCampaign()
            fetchRoom()

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
                                    <button onClick={() => setShowCreateCampaign(true)} style={{ backgroundColor: "#A95B2C", color: "white", border: "none", borderRadius: "18px", padding: "8px 16px", fontFamily: "Poppins, sans-serif", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}>+ Create Campaign</button>
                                </div>

                                {/* Campaigns list */}
                                {room?.campaigns?.length === 0 ? (
                                    <p style={{ fontFamily: "Poppins, sans-serif", color: "#5D5145" }}>No campaigns yet</p>
                                ) : (
                                    room?.campaigns?.map((c) => (
                                        <div key={c.id} onClick={() => handleOpenCampaign(c.id)} style={{ padding: "12px 0", borderBottom: "1px solid #E7DCC7", cursor: "pointer" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                                                <p style={{ fontFamily: "Cinzel, serif", fontWeight: "600", fontSize: "15px", color: "#3A2A20", margin: 0 }}>{c.title}</p>
                                                <span style={{
                                                    fontFamily: "Poppins, sans-serif",
                                                    fontSize: "11px",
                                                    fontWeight: "600",
                                                    padding: "2px 10px",
                                                    borderRadius: "10px",
                                                    color: c.isPublished ? "#3A6B35" : "#8A6D3B",
                                                    backgroundColor: c.isPublished ? "#DCEEDA" : "#F1E4C6",
                                                    whiteSpace: "nowrap",
                                                }}>
                                                    {c.isPublished ? "Published" : "Draft"}
                                                </span>
                                            </div>
                                            {c.description && (
                                                <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "12px", color: "#5D5145", margin: "4px 0 0 0" }}>{c.description}</p>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                        </div>

                        {/* Create Campaign Modal */}
                        {showCreateCampaign && (
                            <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999 }}>

                                {/* Modal box */}
                                <div style={{ backgroundColor: "#F3E9D7", borderRadius: "24px", padding: "40px", width: "480px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
                                    <h2 style={{ fontFamily: "Cinzel, serif", color: "#3A2A20", margin: "0 0 20px 0" }}>Create Campaign</h2>

                                    <form>
                                        {/* Title input */}
                                        <label style={{ fontFamily: "Poppins, sans-serif", color: "#3A2A20", fontWeight: "600" }}>Title</label>
                                        <input type="text" value={campaignTitle} onChange={(e) => setCampaignTitle(e.target.value)} style={{ width: "100%", padding: "10px", marginTop: "6px", marginBottom: "16px", borderRadius: "12px", border: "1px solid #D8C7AA", boxSizing: "border-box", fontFamily: "Poppins, sans-serif" }} />

                                        {/* Description input */}
                                        <label style={{ fontFamily: "Poppins, sans-serif", color: "#3A2A20", fontWeight: "600" }}>Description</label>
                                        <input type="text" value={campaignDescription} onChange={(e) => setCampaignDescription(e.target.value)} style={{ width: "100%", padding: "10px", marginTop: "6px", marginBottom: "24px", borderRadius: "12px", border: "1px solid #D8C7AA", boxSizing: "border-box", fontFamily: "Poppins, sans-serif" }} />

                                        {/* Clues */}
                                        <label style={{ fontFamily: "Poppins, sans-serif", color: "#3A2A20", fontWeight: "600" }}>Clues</label>

                                        {clues.map((clue, index) => (
                                            <div key={index} style={{ marginTop: "10px", padding: "12px", backgroundColor: "#FFF9EF", borderRadius: "16px", border: "1px solid #E7DCC7" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                                    <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "12px", color: "#5D5145", margin: 0 }}>Clue {index + 1}</p>
                                                    <button type="button" onClick={() => handleRemoveClueRow(index)} style={{ backgroundColor: "transparent", color: "#A95B2C", border: "none", fontFamily: "Poppins, sans-serif", fontSize: "12px", cursor: "pointer" }}>Remove</button>
                                                </div>
                                                <input type="text" placeholder="Question" value={clue.question} onChange={(e) => handleClueChange(index, "question", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "8px", borderRadius: "12px", border: "1px solid #D8C7AA", boxSizing: "border-box", fontFamily: "Poppins, sans-serif" }} />
                                                <input type="text" placeholder="Answer" value={clue.answer} onChange={(e) => handleClueChange(index, "answer", e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "12px", border: "1px solid #D8C7AA", boxSizing: "border-box", fontFamily: "Poppins, sans-serif" }} />
                                            </div>
                                        ))}

                                        <button type="button" onClick={handleAddClueRow} style={{ marginTop: "12px", marginBottom: "24px", backgroundColor: "transparent", color: "#A95B2C", border: "1px dashed #A95B2C", borderRadius: "12px", padding: "8px 16px", fontFamily: "Poppins, sans-serif", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}>+ Add Clue</button>

                                        {/* Buttons */}
                                        <div style={{ display: "flex", gap: "12px" }}>
                                            <button type="button" onClick={closeCreateCampaign} style={{ flex: 1, padding: "12px", backgroundColor: "#5D5145", color: "white", border: "none", borderRadius: "18px", fontFamily: "Poppins, sans-serif", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                                            <button type="button" onClick={handleCreateCampaign} style={{ flex: 1, padding: "12px", backgroundColor: "#A95B2C", color: "white", border: "none", borderRadius: "18px", fontFamily: "Poppins, sans-serif", fontWeight: "600", cursor: "pointer" }}>Create</button>
                                        </div>
                                    </form>

                                </div>
                            </div>
                        )}

                        {/* Campaign Detail Modal */}
                        {(campaignLoading || selectedCampaign) && (
                            <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999 }}>

                                {/* Modal box */}
                                <div style={{ backgroundColor: "#F3E9D7", borderRadius: "24px", padding: "40px", width: "520px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>

                                    {campaignLoading ? (
                                        <p style={{ fontFamily: "Poppins, sans-serif", color: "#5D5145" }}>Loading...</p>
                                    ) : (
                                        <>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                                                <h2 style={{ fontFamily: "Cinzel, serif", color: "#3A2A20", margin: 0 }}>{selectedCampaign.title}</h2>
                                                <span style={{
                                                    fontFamily: "Poppins, sans-serif",
                                                    fontSize: "11px",
                                                    fontWeight: "600",
                                                    padding: "2px 10px",
                                                    borderRadius: "10px",
                                                    color: selectedCampaign.isPublished ? "#3A6B35" : "#8A6D3B",
                                                    backgroundColor: selectedCampaign.isPublished ? "#DCEEDA" : "#F1E4C6",
                                                    whiteSpace: "nowrap",
                                                }}>
                                                    {selectedCampaign.isPublished ? "Published" : "Draft"}
                                                </span>
                                            </div>

                                            {selectedCampaign.description && (
                                                <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "13px", color: "#5D5145", margin: "0 0 20px 0" }}>{selectedCampaign.description}</p>
                                            )}

                                            <label style={{ fontFamily: "Poppins, sans-serif", color: "#3A2A20", fontWeight: "600" }}>Clues</label>

                                            {selectedCampaign.clues?.length === 0 ? (
                                                <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "13px", color: "#5D5145", marginTop: "8px" }}>No clues yet</p>
                                            ) : (
                                                selectedCampaign.clues?.map((clue) => (
                                                    <div key={clue.id} style={{ marginTop: "10px", padding: "12px", backgroundColor: "#FFF9EF", borderRadius: "16px", border: "1px solid #E7DCC7" }}>
                                                        <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "11px", fontWeight: "600", color: "#A95B2C", margin: "0 0 4px 0" }}>Clue {clue.orderNumber}</p>
                                                        <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "14px", color: "#3A2A20", margin: "0 0 4px 0" }}><strong>Q:</strong> {clue.question}</p>
                                                        <p style={{ fontFamily: "Poppins, sans-serif", fontSize: "14px", color: "#3A2A20", margin: 0 }}><strong>A:</strong> {clue.answer}</p>
                                                    </div>
                                                ))
                                            )}

                                            <button type="button" onClick={() => setSelectedCampaign(null)} style={{ width: "100%", marginTop: "24px", padding: "12px", backgroundColor: "#5D5145", color: "white", border: "none", borderRadius: "18px", fontFamily: "Poppins, sans-serif", fontWeight: "600", cursor: "pointer" }}>Close</button>
                                        </>
                                    )}

                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    )
}

export default RoomPage