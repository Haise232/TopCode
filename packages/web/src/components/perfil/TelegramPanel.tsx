import { Check, Copy, ExternalLink, Send } from 'lucide-react'
import { Badge, Button, Spinner } from '../ui'
import { cn } from '../ui/cn'
import { Seccion } from '../ui/Seccion'
import { FOCO } from '../ui/estilos'
import { Panel } from './campos'

export interface TelegramPanelProps {
  cargando: boolean
  vinculado: boolean
  vinculadoDesde?: string | null
  cuenta: string
  codigo: string | null
  comando: string
  mm: string
  ss: string
  botUsername?: string
  error?: string | null
  generando: boolean
  desvinculando: boolean
  confirmando: boolean
  copiado: boolean
  onGenerar: () => void
  onCopiar: () => void
  onPedirDesvincular: () => void
  onCancelarDesvincular: () => void
  onDesvincular: () => void
}

/** Presentación del vínculo con Telegram; la lógica (códigos, temporizador, sondeo) vive en pages/Profile.tsx. */
export default function TelegramPanel(p: TelegramPanelProps) {
  return (
    <Seccion titulo="Telegram" subtitulo="Crea eventos del calendario escribiéndole al bot">
      <Panel>
        {p.cargando && !p.codigo && !p.vinculado ? (
          <Spinner size="sm" />
        ) : p.vinculado ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="success"><Send size={10} aria-hidden="true" />Vinculado</Badge>
              {p.vinculadoDesde && (
                <span className="text-xs text-text-muted">
                  desde {new Date(p.vinculadoDesde).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              )}
            </div>
            <p className="text-sm text-text-primary">
              Cuenta vinculada: <span className="font-semibold">{p.cuenta}</span>
            </p>
            <p className="text-sm text-text-secondary">Puedes crear eventos del calendario escribiéndole al bot.</p>
            <p className="text-xs text-text-muted">Si no reconoces esta cuenta, desvincúlala.</p>
            {p.confirmando ? (
              <div className="flex gap-2">
                <Button variant="danger" size="sm" loading={p.desvinculando} onClick={p.onDesvincular}>Confirmar</Button>
                <Button variant="ghost" size="sm" disabled={p.desvinculando} onClick={p.onCancelarDesvincular}>Cancelar</Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="w-fit" onClick={p.onPedirDesvincular}>Desvincular</Button>
            )}
          </div>
        ) : p.codigo ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">Envía este mensaje al bot de Telegram:</p>
            <div className="text-center text-4xl font-black tracking-[0.3em] tabular-nums text-text-primary py-2" aria-label="Código de vinculación">
              {p.codigo}
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate bg-input border border-ov/[0.08] rounded-xl px-4 py-3 text-sm text-text-primary">{p.comando}</code>
              <Button variant="ghost" size="sm" onClick={p.onCopiar} icon={p.copiado ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}>
                {p.copiado ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            <p className="text-xs text-text-muted tabular-nums" role="timer">Caduca en {p.mm}:{p.ss}</p>
            {p.botUsername && (
              <a
                href={`https://t.me/${encodeURIComponent(p.botUsername)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('flex items-center gap-1.5 rounded-md text-sm font-semibold text-primary-light hover:underline underline-offset-4 w-fit', FOCO)}
              >
                <ExternalLink size={13} aria-hidden="true" /> Abrir @{p.botUsername}
              </a>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">Vincula tu cuenta de Telegram para crear eventos del calendario desde el bot.</p>
            <Button onClick={p.onGenerar} loading={p.generando} icon={<Send size={14} aria-hidden="true" />} className="w-full sm:w-fit">
              Vincular Telegram
            </Button>
          </div>
        )}
        {p.error && <p className="mt-3 text-xs text-rose-600 dark:text-rose-300" role="alert">{p.error}</p>}
      </Panel>
    </Seccion>
  )
}
