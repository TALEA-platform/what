import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { contentWatchPlugin } from './scripts/content-watch-plugin.mjs'

function mapLibreLegacyParsePlugin() {
  return {
    name: 'talea:maplibre-legacy-parse',
    enforce: 'pre',
    transform(code, id) {
      const normalizedId = id.replaceAll('\\', '/')
      if (!normalizedId.endsWith('/maplibre-gl/dist/maplibre-gl.js')) return null

      // MapLibre 5.24 bundles optional MLT int64 decoding with BigInt literal
      // syntax. iOS 13 cannot parse `0n`, even though TALEA's MVT/raster styles
      // never execute that decoder. Constructor calls preserve identical
      // semantics where BigInt exists while keeping the whole bundle parseable.
      return code.replace(/\b(\d+)n\b/g, 'BigInt("$1")')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Il sito vive su https://talea-platform.github.io/what/, non sulla radice del
  // dominio: senza questo, i tag generati puntano a /assets/... e danno 404.
  base: '/what/',
  plugins: [
    react(),
    legacy({
      // iOS 13.3 supports modules, but not the syntax/runtime baseline emitted
      // by Vite 8. The legacy feature probe routes it to a Babel/SystemJS
      // build with usage-driven core-js polyfills; current browsers retain the
      // modern bundle and receive no modern-polyfill payload.
      targets: ['iOS >= 13.3'],
      modernTargets: ['iOS >= 13.3'],
      polyfills: true,
      modernPolyfills: false,
    }),
    mapLibreLegacyParsePlugin(),
    contentWatchPlugin(),
  ],
})
