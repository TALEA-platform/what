import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import './styles/layout.css'
import './styles/story.css'
import './styles/rifugio-model3d.css'
import './styles/maps.css'
import App from './App.jsx'

// Su schermi touch piccoli la storia non si monta affatto: al suo posto c'è il cancello
// dipinto in index.html, che alza questa bandiera prima ancora che il bundle
// arrivi. Montare l'app dietro a un pannello opaco vorrebbe dire scaricare il
// video dell'hero, accendere le mappe e mettere in ascolto gli osservatori di
// scroll per una pagina che nessuno vedrà. Da togliere insieme al cancello,
// quando la versione per schermi piccoli sarà pronta.
if (!window.__taleaMobileGate && !window.__taleaViewportFrameShell) {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

  // Uno dei tre cancelli della schermata d'ingresso (vedi index.html). Il doppio
  // rAF serve a dire "montato E dipinto": il primo scatta a fine commit di React,
  // il secondo dopo che il browser ha effettivamente disegnato quel frame. Senza,
  // il loader si toglierebbe di mezzo un attimo prima che ci sia qualcosa sotto.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => window.__taleaBoot?.ready('app')),
  )
}
