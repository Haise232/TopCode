import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

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
