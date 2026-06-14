import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-4">
          <div className="bg-surface border border-white/[0.08] rounded-2xl p-8 max-w-sm w-full text-center flex flex-col gap-4">
            <p className="text-4xl">⚠️</p>
            <h1 className="text-zinc-50 font-extrabold text-xl">Algo salió mal</h1>
            <p className="text-text-muted text-sm leading-relaxed">
              {this.state.error?.message ?? 'Error inesperado. Recarga la página.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="gradient-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
            >
              Recargar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
