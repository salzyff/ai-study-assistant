import AppRecovery from "./components/AppRecovery"
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './style-fixes.css'
import './chat-layout.css'
import './workspace-pages.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppRecovery><App /></AppRecovery>
  </StrictMode>,
)

