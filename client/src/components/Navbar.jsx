import React from 'react'
import logo from "../assets/logo.png";
import { User, LogOut, ChevronDown } from "lucide-react"

function Navbar() {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: "#1C140C", justifyContent: 'space-between', padding: '20px', position: "sticky", top: "0", zIndex: "100"}}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src={logo} alt="logo" style={{width: '70px'}}/>
            <div style={{ display: "flex", flexDirection: "column" }}>
                <p style={{color: "#A37845", fontFamily: "Cinzel, serif",fontSize: "18px",fontWeight: "700",margin: 0}}>THE ARCHIVIST'S LEGACY</p>
                <p style={{color: "#A37845",fontFamily: "Cinzel, serif",fontSize: "10px",margin: 0,letterSpacing: "2px", fontWeight: "600"}}> ← KEEPERS OF THE FORGOTTEN VAULTS →</p>
            </div>
        </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{backgroundColor: "#18110B", border: "2px solid #483420", borderRadius: "35px", padding: "8px 16px", display: "flex", alignItems: "center", gap: "8px", height: "45px"}}>
                    <User size={20} color="#FFFFF3" />
                    <p style={{color: "#FFFFF3", fontFamily: "Poppins, serif", fontSize: "14px"}}>Welcome, Teacher</p>
                    <ChevronDown size={16} color="#FFFFF3" />
                </div>
            <div style={{backgroundColor: "#18110B", border: "2px solid #483420", borderRadius: "20px",padding: "8px 16px", display: "flex", alignItems: "center", gap: "8px"}}>
                <LogOut size={20} color="#AF8553" />
                <p style={{color: "#FFFFF3", fontFamily: "Poppins, serif", fontSize: "14px"}}>Logout</p>
            </div>
        </div>
    </div>
  )
}

export default Navbar