import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

// Tras un despliegue nuevo, una pestaña abierta antes sigue pidiendo los trozos de JS de la versión anterior, que ya no
// existen («Failed to fetch dynamically imported module»). Se recarga una vez para coger la versión nueva; si vuelve a
// fallar enseguida, no se insiste (así no entra en bucle) y lo muestra el ErrorBoundary.
const RELOAD_KEY = 'topcode:recarga-version'
window.addEventListener('vite:preloadError', (event) => {
  let last = 0
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0
  } catch {
    // sin sessionStorage: se recarga igual
  }
  if (Date.now() - last < 30000) return
  event.preventDefault()
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // ignorar
  }
  window.location.reload()
})

// React.StrictMode monta los componentes dos veces en desarrollo,
// lo que provoca que Supabase intente adquirir el lock de auth
// en paralelo → timeout de 5s → carga infinita.
// Se mantiene fuera de StrictMode por compatibilidad con Supabase Auth.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </ErrorBoundary>,
)
