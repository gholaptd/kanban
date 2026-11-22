import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import Scene from './Scene.jsx'
import './styles.css'
createRoot(document.getElementById('root')).render(<><Scene /><App /></>)
