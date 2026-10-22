import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Coins, MessageSquare, Zap, X, Search, Users } from 'lucide-react'
import { ABUSE_MINUTES, abuseText, bancaCall, eur, type Abuse, type AbuseMode, type AbuseScope, type Jugador } from './banca'
import { cn } from '../../components/ui/cn'
import './banca.css'

type Tab = 'dinero' | 'mensaje' | 'abuso'
const QUICK = [1000, 5000, 10000, 50000]
const ALL = 'todos'

// Panel del master: dar dinero, escribir a nombre de la banca y activar el Admin Abuse. El servidor comprueba que eres el
// master; aquí solo se enseña el botón a quien lo es.
export default function BancaPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('dinero')
  const [people, setPeople] = useState<Jugador[]>([])
  const [to, setTo] = useState<string>(ALL)
  const [query, setQuery] = useState('')
  const [amount, setAmount] = useState(1000)
  const [text, setText] = useState('')
  const [abuse, setAbuse] = useState<Abuse | null>(null)
  const [mode, setMode] = useState<AbuseMode>('x2')
  const [scope, setScope] = useState<AbuseScope>('todo')
  const [minutes, setMinutes] = useState<number>(10)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    bancaCall({ t: 'banca_gente' })
      .then(({ banca }) => setPeople(banca?.gente ?? []))
      .catch((e: Error) => setNote({ ok: false, text: e.message }))
    bancaCall({ t: 'banca' })
      .then(({ banca }) => setAbuse(banca?.abuso ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people
  }, [people, query])
  const target = to === ALL ? null : people.find((p) => p.id === to) ?? null
  const targetName = target ? target.name : `todos (${people.length})`

  const run = async (msg: Record<string, unknown>, done: string) => {
    setBusy(true)
    setNote(null)
    try {
      const { banca } = await bancaCall(msg)
      if (msg.t === 'banca_abuso') setAbuse(banca?.abuso ?? null)
      if (msg.t === 'banca_dar') {
        const { banca: g } = await bancaCall({ t: 'banca_gente' })
        setPeople(g?.gente ?? [])
      }
      if (msg.t === 'banca_mensaje') setText('')
      setNote({ ok: true, text: done })
    } catch (e) {
      setNote({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const give = () => run({ t: 'banca_dar', para: to, importe: amount, texto: text.trim() || undefined }, `Enviados ${eur(amount)} a ${targetName}.`)
  const send = () => run({ t: 'banca_mensaje', para: to, texto: text.trim() }, `Mensaje enviado a ${targetName}.`)
  const startAbuse = () => run({ t: 'banca_abuso', modo: mode, ambito: scope, minutos: minutes }, '¡Admin Abuse activado!')
  const stopAbuse = () => run({ t: 'banca_abuso', modo: null }, 'Admin Abuse desactivado.')

  const active = abuse && abuse.hasta > Date.now() ? abuse : null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="banca-panel-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-lg max-h-[92vh] flex-col overflow-hidden rounded-2xl border border-amber/30 bg-surface shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <header className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-light to-amber-dark text-lg font-black text-black">€</div>
          <div className="min-w-0 flex-1">
            <h2 id="banca-panel-title" className="text-base font-bold text-text-primary">
              La banca
            </h2>
            <p className="text-xs text-text-muted">Solo tú (master) ves esto.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-text-muted hover:bg-overlay-6 hover:text-text-primary" aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <nav className="grid grid-cols-3 gap-1 border-b border-white/10 p-2" role="tablist">
          {(
            [
              ['dinero', 'Dar dinero', Coins],
              ['mensaje', 'Mensaje', MessageSquare],
              ['abuso', 'Admin Abuse', Zap],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id)
                setNote(null)
              }}
              className={cn(
                'flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors',
                tab === id ? (id === 'abuso' ? 'bg-rose/20 text-rose-light' : 'bg-amber/15 text-amber-light') : 'text-text-secondary hover:bg-overlay-5',
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab !== 'abuso' && (
            <section className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Para</p>
              <button
                type="button"
                onClick={() => setTo(ALL)}
                className={cn(
                  'mb-2 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm',
                  to === ALL ? 'border-amber/60 bg-amber/10 text-amber-light' : 'border-white/10 text-text-secondary hover:bg-overlay-4',
                )}
              >
                <Users size={16} /> Todos los jugadores ({people.length})
              </button>
              <label className="relative mb-2 block">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar a alguien…"
                  className="w-full rounded-xl border border-white/10 bg-input py-2 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-amber/50 focus:outline-none"
                />
              </label>
              <ul className="max-h-44 space-y-1 overflow-y-auto pr-1">
                {shown.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setTo(p.id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm',
                        to === p.id ? 'bg-amber/15 text-amber-light' : 'text-text-secondary hover:bg-overlay-4',
                      )}
                    >
                      {p.avatar ? (
                        <img src={p.avatar} alt="" className="h-7 w-7 rounded-md object-cover" />
                      ) : (
                        <span className="grid h-7 w-7 place-items-center rounded-md bg-overlay-8 text-xs font-bold">{p.name[0]?.toUpperCase()}</span>
                      )}
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <span className="text-xs tabular-nums text-text-muted">{p.balance === null ? 'sin jugar' : eur(p.balance)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === 'dinero' && (
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Cantidad</p>
              <div className="grid grid-cols-4 gap-2">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmount(q)}
                    className={cn('min-h-10 rounded-lg border text-sm font-semibold', amount === q ? 'border-amber/60 bg-amber/15 text-amber-light' : 'border-white/10 text-text-secondary hover:bg-overlay-4')}
                  >
                    {q >= 1000 ? `${q / 1000}k` : q}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={1000000}
                step={100}
                value={amount}
                onChange={(e) => setAmount(Math.max(1, Math.min(1000000, Math.floor(Number(e.target.value) || 0))))}
                className="w-full rounded-xl border border-white/10 bg-input px-3 py-2.5 text-sm tabular-nums text-text-primary focus:border-amber/50 focus:outline-none"
                aria-label="Cantidad en euros"
              />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 300))}
                rows={2}
                placeholder="Mensaje opcional («¡Por ganar el torneo!»)"
                className="w-full resize-none rounded-xl border border-white/10 bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-amber/50 focus:outline-none"
              />
              <button
                type="button"
                disabled={busy || amount < 1}
                onClick={give}
                className="min-h-12 w-full rounded-xl bg-gradient-to-b from-amber-light to-amber-dark text-sm font-bold text-black disabled:opacity-50"
              >
                Dar {eur(amount)} a {targetName}
              </button>
            </section>
          )}

          {tab === 'mensaje' && (
            <section className="space-y-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 300))}
                rows={4}
                placeholder="Escribe el mensaje de la banca…"
                className="w-full resize-none rounded-xl border border-white/10 bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-amber/50 focus:outline-none"
              />
              <p className="text-right text-xs text-text-muted">{text.length}/300</p>
              <button
                type="button"
                disabled={busy || !text.trim()}
                onClick={send}
                className="min-h-12 w-full rounded-xl bg-gradient-to-b from-primary-light to-primary-dark text-sm font-bold text-white disabled:opacity-50"
              >
                Enviar a {targetName}
              </button>
            </section>
          )}

          {tab === 'abuso' && (
            <section className="space-y-4">
              {active && (
                <div className="rounded-xl border border-rose/40 bg-rose/10 p-3 text-sm">
                  <p className="font-bold text-rose-light">⚡ Activo: {abuseText(active).big}</p>
                  <p className="text-text-secondary">Hasta las {new Date(active.hasta).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.</p>
                  <button type="button" disabled={busy} onClick={stopAbuse} className="mt-2 min-h-10 w-full rounded-lg border border-rose/50 font-semibold text-rose-light hover:bg-rose/15 disabled:opacity-50">
                    Desactivar ya
                  </button>
                </div>
              )}
              <Choice
                label="Qué"
                value={mode}
                onChange={setMode}
                options={[
                  ['x2', 'Probabilidad ×2'],
                  ['x3', 'Probabilidad ×3'],
                  ['gratis', 'Todo gratis'],
                ]}
              />
              <Choice
                label="Dónde"
                value={scope}
                onChange={setScope}
                options={[
                  ['todo', 'Todos los juegos'],
                  ['poker', 'Solo póker'],
                ]}
              />
              <Choice label="Cuánto dura" value={minutes} onChange={setMinutes} options={ABUSE_MINUTES.map((m) => [m, `${m} min`] as const)} />
              <p className="rounded-lg bg-overlay-4 px-3 py-2 text-xs text-text-secondary">{abuseText({ modo: mode, ambito: scope }).small}</p>
              <button
                type="button"
                disabled={busy}
                onClick={startAbuse}
                className="min-h-14 w-full rounded-xl bg-gradient-to-b from-rose-light to-rose-dark text-base font-black tracking-wider text-white shadow-[0_0_30px_rgba(244,63,94,0.45)] disabled:opacity-50"
              >
                {active ? 'CAMBIAR ADMIN ABUSE' : 'ACTIVAR ADMIN ABUSE'}
              </button>
            </section>
          )}

          {note && (
            <p role="status" className={cn('mt-4 rounded-lg px-3 py-2 text-sm', note.ok ? 'bg-success/15 text-secondary-light' : 'bg-rose/15 text-rose-light')}>
              {note.text}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Choice<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: readonly (readonly [T, string])[]
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, text]) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn('min-h-10 flex-1 rounded-lg border px-3 text-sm font-semibold', value === v ? 'border-rose/60 bg-rose/15 text-rose-light' : 'border-white/10 text-text-secondary hover:bg-overlay-4')}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}
