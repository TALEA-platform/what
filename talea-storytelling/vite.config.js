import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Il sito vive su https://talea-platform.github.io/what/, non sulla radice del
  // dominio: senza questo, i tag generati puntano a /assets/... e danno 404.
  base: '/what/',
  plugins: [react()],
})
