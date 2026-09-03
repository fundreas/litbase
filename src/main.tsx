import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/App'
import '@/index.css'

/**
 * No context menu on images.
 *
 * A long press on a player portrait is a tap that went slightly long, not a
 * request to save the picture — but Android Chrome answers it with a "download
 * image / copy image" sheet, and a right-click does the same on desktop. CSS
 * can suppress Safari's callout and the drag ghost (see `index.css`) but has
 * no say over the menu, so it is cancelled here. Everything else — text,
 * links, the page itself — keeps its menu.
 */
document.addEventListener('contextmenu', (event) => {
  if (event.target instanceof HTMLImageElement) event.preventDefault()
})

const container = document.getElementById('root')
if (container === null) {
  throw new Error('Root element #root is missing from index.html.')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
