import React from 'react'
import { Home } from 'lucide-react'

function Sidebar() {
  return (
    <div style={{ padding: "20px",}}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#B8864B", borderRadius: "16px", padding: "12px 16px", cursor: "pointer", }}>
        <Home size={20} color="#FFF5E7" />
        <p style={{ color: "#FFF5E7", fontFamily: "Poppins, sans-serif", fontSize: "16px", margin: 0, fontWeight: "600" }}>Rooms</p>
      </div>
    </div>
  )
}

export default Sidebar