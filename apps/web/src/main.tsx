import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { getTheme } from './lib/session'

// Apply saved theme before first render to avoid a flash.
document.documentElement.classList.toggle('dark', getTheme() === 'dark')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
