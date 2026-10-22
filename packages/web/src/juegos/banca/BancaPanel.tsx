import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Coins, MessageSquare, Zap, X, Search, Users, Check, Clock } from 'lucide-react'
import {
  ABUSE_MINUTES,
  abusePerks,
  abuseText,
  bancaCall,
  eur,
  type Abuse,
  type AbuseMode,
  type AbuseScope,
  type Jugador,
  type Movimiento,
} from './banca'
import './banca-panel.css'

type Tab = 'dinero' | 'mensaje' | 'abuso'
const ALL = 'todos'
const CHIPS = [100, 1000, 10000, 50000]
const MAX = 1_000_000
const TEMPLATES = ['¡Torneo de póker en 5 minutos!', '¡Felicidades al ganador de la semana!', 'La banca cierra en 10 minutos.', 'Hoy invita la casa 🎉']
const MODES: { id: AbuseMode; big: string; label: string }[] = [
  { id: 'x2', big: '×2', label: 'Probabilidad ×2' },
  { id: 'x3', big: '×3', label: 'Probabilidad ×3' },
  { id: 'gratis', big: '0 €', label: 'Todo gratis' },
]

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const ago = (at: number) => {
  const min = Math.max(0, Math.round((Date.now() - at) / 60000))
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`
}
const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase()

function Face({ person, size = 34 }: { person: Pick<Jugador, 'name' | 'avatar'>; size?: number }) {
  return person.avatar ? (
    <img className="bp-face" src={person.avatar} alt="" style={{ width: size, height: size }} />
  ) : (
    <span className="bp-face bp-face--letter" style={{ width: size, height: size }} aria-hidden="true">
      {initial(person.name)}
    </span>
  )
}

// Panel del master: dar dinero, escribir a nombre de la banca y activar el Admin Abuse. El servidor comprueba que eres el
// master; aquí solo se enseña el botón a quien lo es.
export default function BancaPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('dinero')
  const [people, setPeople] = useState<Jugador[]>([])
  const [history, setHistory] = useState<Movimiento[]>([])
  const [to, setTo] = useState<string>(ALL)
  const [query, setQuery] = useState('')
  const [amount, setAmount] = useState(1000)
  const [gift, setGift] = useState('')
  const [text, setText] = useState('')
  const [abuse, setAbuse] = useState<Abuse | null>(null)
  const [mode, setMode] = useState<AbuseMode>('x2')
  const [scope, setScope] = useState<AbuseScope>('todo')
  const [minutes, setMinutes] = useState<number>(10)
  const [busy, setBusy] = useState(false)
  const [armed, setArmed] = useState(false) // dar a todos pide pulsar dos veces
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [, setTick] = useState(0)

  const loadPeople = useCallback(async () => {
    const { banca } = await bancaCall({ t: 'banca_gente' })
    setPeople(banca?.gente ?? [])
    setHistory(banca?.historial ?? [])
  }, [])

  useEffect(() => {
    loadPeople().catch((e: Error) => setNote({ ok: false, text: e.message }))
    bancaCall({ t: 'banca' })
      .then(({ banca }) => setAbuse(banca?.abuso ?? null))
      .catch(() => {})
  }, [loadPeople])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const timer = setInterval(() => setTick((n) => n + 1), 1000)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearInterval(timer)
    }
  }, [onClose])

  useEffect(() => setArmed(false), [to, amount, tab])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people
  }, [people, query])
  const target = to === ALL ? null : (people.find((p) => p.id === to) ?? null)
  const targetName = target ? target.name : 'todos'
  const count = target ? 1 : people.length
  const active = abuse && abuse.hasta > Date.now() ? abuse : null
  const inCirculation = people.reduce((sum, p) => sum + (p.balance ?? 0), 0)

  const run = async (msg: Record<string, unknown>, done: string) => {
    setBusy(true)
    setNote(null)
    try {
      const { banca } = await bancaCall(msg)
      if (msg.t === 'banca_abuso') setAbuse(banca?.abuso ?? null)
      if (msg.t === 'banca_mensaje') setText('')
      if (msg.t === 'banca_dar') setGift('')
      setNote({ ok: true, text: done })
      setArmed(false)
      await loadPeople().catch(() => {})
    } catch (e) {
      setNote({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const give = () => {
    if (!target && !armed) {
      setArmed(true)
      return
    }
    run({ t: 'banca_dar', para: to, importe: amount, texto: gift.trim() || undefined }, `Enviados ${eur(amount)} a ${targetName}.`)
  }
  const send = () => run({ t: 'banca_mensaje', para: to, texto: text.trim() }, `Mensaje enviado a ${targetName}.`)
  const startAbuse = () => run({ t: 'banca_abuso', modo: mode, ambito: scope, minutos: minutes }, '¡Admin Abuse activado! Todos lo están viendo.')
  const stopAbuse = () => run({ t: 'banca_abuso', modo: null }, 'Admin Abuse desactivado.')
  const setClamped = (n: number) => setAmount(Math.max(1, Math.min(MAX, Math.floor(n) || 1)))

  return createPortal(
    <div className="bp" role="dialog" aria-modal="true" aria-labelledby="bp-title">
      <div className="bp__backdrop" onClick={onClose} />
      <div className="bp__panel">
        <header className="bp__head">
          <div className="bp__vault" aria-hidden="true">
            <span>€</span>
          </div>
          <div className="bp__titles">
            <h2 id="bp-title">La banca</h2>
            <p>Panel del master · solo tú lo ves</p>
          </div>
          <button type="button" className="bp__close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <div className="bp__stats">
          <div>
            <small>Jugadores</small>
            <b>{people.length}</b>
          </div>
          <div>
            <small>Dinero en juego</small>
            <b>{eur(inCirculation)}</b>
          </div>
          <div className={active ? 'is-hot' : ''}>
            <small>Admin Abuse</small>
            <b>{active ? `${active.modo === 'gratis' ? 'Gratis' : active.modo === 'x3' ? '×3' : '×2'} · ${clock(active.hasta - Date.now())}` : 'Apagado'}</b>
          </div>
        </div>

        <nav className="bp__tabs" role="tablist">
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
              className={`bp__tab bp__tab--${id}`}
              onClick={() => {
                setTab(id)
                setNote(null)
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        <div className="bp__body">
          {tab !== 'abuso' && (
            <section className="bp__who" aria-label="Para quién">
              <button type="button" className={`bp-all ${to === ALL ? 'is-on' : ''}`} onClick={() => setTo(ALL)}>
                <span className="bp-all__icon">
                  <Users size={18} />
                </span>
                <span>
                  <b>Todos</b>
                  <small>{people.length} jugadores</small>
                </span>
                {to === ALL && <Check size={18} className="bp-check" />}
              </button>
              <label className="bp-search">
                <Search size={14} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar a alguien…" />
              </label>
              <ul className="bp-people">
                {shown.map((p) => (
                  <li key={p.id}>
                    <button type="button" className={`bp-person ${to === p.id ? 'is-on' : ''}`} onClick={() => setTo(p.id)}>
                      <Face person={p} />
                      <span className="bp-person__name">{p.name}</span>
                      <span className="bp-person__money">{p.balance === null ? 'sin jugar' : eur(p.balance)}</span>
                    </button>
                  </li>
                ))}
                {shown.length === 0 && <li className="bp-muted">Nadie con ese nombre.</li>}
              </ul>
            </section>
          )}

          <section className="bp__action">
            {tab === 'dinero' && (
              <>
                <div className="bp-amount">
                  <small>Cantidad para {targetName}</small>
                  <label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX}
                      value={amount}
                      onChange={(e) => setClamped(Number(e.target.value))}
                      aria-label="Cantidad en euros"
                    />
                    <span>€</span>
                  </label>
                  {!target && people.length > 1 && <small>En total: {eur(amount * people.length)}</small>}
                </div>
                <div className="bp-chips" aria-label="Sumar a la cantidad">
                  {CHIPS.map((c, i) => (
                    <button key={c} type="button" className="bp-chip" style={{ '--chip': ['#e9e1cf', '#2f7be0', '#c2332c', '#1b1b1f'][i] } as CSSProperties} onClick={() => setClamped(amount + c)}>
                      +{c >= 1000 ? `${c / 1000}k` : c}
                    </button>
                  ))}
                  <button type="button" className="bp-chip bp-chip--reset" onClick={() => setAmount(100)}>
                    Borrar
                  </button>
                </div>
                <textarea className="bp-text" value={gift} onChange={(e) => setGift(e.target.value.slice(0, 300))} rows={2} placeholder="Mensaje opcional («¡Por ganar el torneo!»)" />
                <Preview>
                  <p className="bp-prev__from">La banca</p>
                  <p className="bp-prev__big">
                    ¡Has recibido <b>{eur(amount)}</b> de la banca!
                  </p>
                  {gift.trim() && <p className="bp-prev__small">«{gift.trim()}»</p>}
                </Preview>
                <button type="button" className={`bp-go bp-go--gold ${armed ? 'is-armed' : ''}`} disabled={busy || amount < 1 || count === 0} onClick={give}>
                  {armed ? `Confirmar: ${eur(amount)} a cada uno (${count})` : `Dar ${eur(amount)} a ${targetName}`}
                </button>
              </>
            )}

            {tab === 'mensaje' && (
              <>
                <textarea className="bp-text" value={text} onChange={(e) => setText(e.target.value.slice(0, 300))} rows={4} placeholder="Escribe el mensaje de la banca…" />
                <div className="bp-templates">
                  {TEMPLATES.map((t) => (
                    <button key={t} type="button" onClick={() => setText(t)}>
                      {t}
                    </button>
                  ))}
                </div>
                <p className="bp-count">{text.length}/300</p>
                <Preview>
                  <p className="bp-prev__from">{target ? 'Mensaje de la banca' : 'Mensaje de la banca para todos'}</p>
                  <p className="bp-prev__big bp-prev__big--msg">{text.trim() || 'Tu mensaje aparecerá aquí.'}</p>
                </Preview>
                <button type="button" className="bp-go bp-go--teal" disabled={busy || !text.trim()} onClick={send}>
                  Enviar a {targetName}
                </button>
              </>
            )}

            {tab === 'abuso' && (
              <>
                {active && (
                  <div className="bp-live">
                    <span className="bp-live__dot" aria-hidden="true" />
                    <div>
                      <b>{abuseText(active).big}</b>
                      <small>
                        <Clock size={12} /> Quedan {clock(active.hasta - Date.now())}
                      </small>
                    </div>
                    <button type="button" disabled={busy} onClick={stopAbuse}>
                      Desactivar
                    </button>
                  </div>
                )}
                <div className="bp-modes" role="radiogroup" aria-label="Qué activa">
                  {MODES.map((m) => (
                    <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={`bp-mode bp-mode--${m.id}`} onClick={() => setMode(m.id)}>
                      <b>{m.big}</b>
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
                <div className="bp-row">
                  <span className="bp-label">Dónde</span>
                  <div className="bp-seg" role="radiogroup">
                    {(
                      [
                        ['todo', 'Todos los juegos'],
                        ['poker', 'Solo póker'],
                      ] as const
                    ).map(([id, label]) => (
                      <button key={id} type="button" role="radio" aria-checked={scope === id} onClick={() => setScope(id)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bp-row">
                  <span className="bp-label">Cuánto dura</span>
                  <div className="bp-seg" role="radiogroup">
                    {ABUSE_MINUTES.map((m) => (
                      <button key={m} type="button" role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)}>
                        {m} min
                      </button>
                    ))}
                  </div>
                </div>
                <ul className="bp-perks">
                  {abusePerks({ modo: mode, ambito: scope }).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <button type="button" className={`bp-go bp-go--abuse bp-go--${mode}`} disabled={busy} onClick={startAbuse}>
                  <Zap size={18} /> {active ? 'CAMBIAR ADMIN ABUSE' : 'ACTIVAR ADMIN ABUSE'}
                </button>
              </>
            )}

            {note && (
              <p role="status" className={`bp-note ${note.ok ? 'is-ok' : 'is-err'}`}>
                {note.text}
              </p>
            )}
          </section>
        </div>

        {history.length > 0 && (
          <footer className="bp__history">
            <h3>Últimos movimientos</h3>
            <ul>
              {history.map((h) => (
                <li key={h.id}>
                  <span className={`bp-hist__icon bp-hist__icon--${h.tipo}`} aria-hidden="true">
                    {h.tipo === 'dinero' ? '€' : '✉'}
                  </span>
                  <span className="bp-hist__what">
                    {h.tipo === 'dinero' ? <b>{eur(h.importe ?? 0)}</b> : <q>{h.texto}</q>} → {h.para ?? 'todos'}
                  </span>
                  <small>{ago(h.at)}</small>
                </li>
              ))}
            </ul>
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}

// Así lo verá quien lo reciba (en pequeño).
function Preview({ children }: { children: ReactNode }) {
  return (
    <div className="bp-prev">
      <small className="bp-prev__label">Así lo verán</small>
      <div className="bp-prev__card">{children}</div>
    </div>
  )
}
