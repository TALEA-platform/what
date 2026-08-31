import './styles/theme.css'
import './styles/layout.css'
import './styles/story.css'
import './styles/rifugio-model3d.css'
import './styles/maps.css'
import './styles/mobile-typography.css'

// Keep this entry deliberately small. ESM-capable iOS 13 does not execute a
// nomodule legacy bundle, so missing runtime APIs must be filled before the
// React/data graph is imported and evaluated.
const needsLegacySafariRuntime =
  typeof Array.prototype.at !== 'function' ||
  typeof String.prototype.replaceAll !== 'function' ||
  typeof Promise.allSettled !== 'function' ||
  typeof Object.fromEntries !== 'function' ||
  typeof Object.hasOwn !== 'function' ||
  typeof window.ResizeObserver !== 'function' ||
  typeof window.queueMicrotask !== 'function' ||
  typeof window.matchMedia('(max-width: 1px)').addEventListener !== 'function'

const compatibilityReady = needsLegacySafariRuntime
  ? import('./lib/legacySafariPolyfills.js')
  : Promise.resolve()

compatibilityReady
  .then(() => import('./bootstrapApp.jsx'))
  .then(({ mountTaleaApp }) => mountTaleaApp())
  .catch((error) => {
    console.error('[talea] bootstrap failed', error)
  })
