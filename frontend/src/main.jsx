import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Monitoreo de Datadog (Descomentar para activar, ver src/monitoring/datadog.js)
// import './monitoring/datadog';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
