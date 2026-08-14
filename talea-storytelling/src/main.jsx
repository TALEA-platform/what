import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import './styles/layout.css'
import './styles/story.css'
import './styles/rifugio-model3d.css'
import './styles/maps.css'
import App from './App.jsx'
import { ContentProvider } from './content'

// index.html sets these gates before the bundle loads; avoid mounting hidden maps.
if (!window.__taleaMobileGate && !window.__taleaViewportFrameShell) {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ContentProvider>
        <App />
      </ContentProvider>
    </StrictMode>,
  )

  // Two frames mean React has committed and the browser has painted beneath the loader.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => window.__taleaBoot?.ready('app')),
  )
}
