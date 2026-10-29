import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { applyThemeVars } from './theme'
import { readStoredTheme } from './lib/themeMode'

// Paint with the right palette from the very first frame (ThemeProvider
// keeps it in sync afterwards).
applyThemeVars(readStoredTheme())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
