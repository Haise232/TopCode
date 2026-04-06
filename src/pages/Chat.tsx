import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import {
  Send, ArrowLeft, MessageCircle, Lock, Users,
  Hash, Search, ChevronRight,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Mensaje, MensajePrivado, Usuario } from '../lib/types'

type SubTab = 'publico' | 'privado'

// ── Helpers ──────────────────────────────────────────────────────────────────

function getHue(nombre: string) {
  return nombre.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts: string) {
  const d = new Date(ts)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const msgDay = new Date(d); msgDay.setHours(0, 0, 0, 0)
  if (msgDay.getTime() === today.getTime()) return 'Hoy'
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  if (msgDay.getTime() === yesterday.getTime()) return 'Ayer'
  return d.toLocaleDateString('es', { day: 'numeric', month: 'long' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ nombre, url, size = 32 }: { nombre: string; url?: string | null; size?: number }) {
  if (url) return (
    <img
      src={url}
      alt={nombre}
      className="object-cover shrink-0"
      style={{ width: size, height: size, borderRadius: '10px', border: '1.5px solid rgba(255,255,255,0.08)' }}
    />
  )
  const hue = getHue(nombre)
  return (
    <div
      className="flex items-center justify-center shrink-0 font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: size > 40 ? '14px' : '10px',
        background: `hsla(${hue}, 55%, 20%, 0.95)`,
        border: `1.5px solid hsla(${hue}, 55%, 40%, 0.35)`,
        color: `hsla(${hue}, 75%, 75%, 1)`,
        fontSize: size * 0.38,
      }}
    >
      {nombre[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

function LoadingDots() {
  return (
    <div className="flex items-center justify-center flex-1 py-16">
      <div className="flex gap-2">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              background: '#6366f1',
              animation: 'dot-bounce 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-5">
      <div
        className="flex-1 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.07))' }}
      />
      <span
        className="text-xs font-semibold px-3 py-1 rounded-full shrink-0"
        style={{
          background: 'rgba(99,102,241,0.06)',
          color: '#6366f1',
          border: '1px solid rgba(99,102,241,0.18)',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
      <div
        className="flex-1 h-px"
        style={{ background: 'linear-gradient(to left, transparent, rgba(255,255,255,0.07))' }}
      />
    </div>
  )
}

function MessageInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  inputRef,
  accentColor = '#6366f1',
  accentGlow = 'rgba(99,102,241,0.08)',
  accentBorder = 'rgba(99,102,241,0.4)',
  gradientFrom = '#6366f1',
  gradientTo = '#8b5cf6',
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  placeholder: string
  inputRef?: React.RefObject<HTMLInputElement>
  accentColor?: string
  accentGlow?: string
  accentBorder?: string
  gradientFrom?: string
  gradientTo?: string
}) {
  const active = value.trim().length > 0
  return (
    <form
      onSubmit={onSubmit}
      className="px-4 py-3 shrink-0"
      style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: '#14161f' }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all duration-200"
        style={{
          background: '#1a1d27',
          border: active ? `1px solid ${accentBorder}` : '1px solid rgba(255,255,255,0.07)',
          boxShadow: active ? `0 0 0 3px ${accentGlow}` : 'none',
        }}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600"
          style={{ color: '#f1f5f9' }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (active) onSubmit(e as unknown as React.FormEvent)
            }
          }}
        />
        <button
          type="submit"
          disabled={!active}
          className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150 shrink-0 active:scale-90"
          style={{
            background: active
              ? `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`
              : 'rgba(255,255,255,0.04)',
            boxShadow: active ? `0 2px 8px ${accentGlow}` : 'none',
            opacity: active ? 1 : 0.4,
          }}
          aria-label="Enviar"
        >
          <Send size={13} style={{ color: active ? 'white' : '#64748b', transform: 'translateX(1px)' }} />
        </button>
      </div>
    </form>
  )
}

// ── Bubble row ────────────────────────────────────────────────────────────────
// Shared between PublicChat and PrivateChat to keep bubble styles consistent.
interface BubbleRowProps {
  isMine: boolean
  isGrouped: boolean
  isLastInGroup: boolean
  showAuthor: boolean
  autor: string
  avatarUrl?: string | null
  texto: string
  time: string
}

function BubbleRow({ isMine, isGrouped, isLastInGroup, showAuthor, autor, avatarUrl, texto, time }: BubbleRowProps) {
  return (
    <div
      className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : 'flex-row'} items-end`}
      style={{ marginBottom: isGrouped ? '2px' : '8px' }}
    >
      {/* Avatar — se oculta en mensajes agrupados pero mantiene el espacio */}
      {!isMine && (
        <div className="shrink-0" style={{ width: 28, opacity: isGrouped ? 0 : 1 }}>
          <Avatar nombre={autor} url={avatarUrl} size={28} />
        </div>
      )}
      <div className={`flex flex-col gap-0.5 max-w-[72%] ${isMine ? 'items-end' : 'items-start'}`}>
        {!isMine && showAuthor && (
          <span
            className="text-xs font-semibold ml-1 mb-0.5"
            style={{ color: `hsla(${getHue(autor)}, 65%, 65%, 1)` }}
          >
            {autor}
          </span>
        )}
        <div
          className="px-3.5 py-2.5 text-sm leading-relaxed"
          style={isMine ? {
            borderRadius: isGrouped ? '18px 4px 4px 18px' : '18px 4px 18px 18px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white',
            boxShadow: '0 2px 10px rgba(99,102,241,0.28)',
          } : {
            borderRadius: isGrouped ? '4px 18px 18px 4px' : '4px 18px 18px 18px',
            background: '#1e2233',
            border: '1px solid rgba(255,255,255,0.07)',
            color: '#e2e8f0',
          }}
        >
          {texto}
        </div>
        {isLastInGroup && (
          <span className="text-xs mx-1.5 mt-0.5" style={{ color: '#374151' }}>
            {time}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Empty state SVG ───────────────────────────────────────────────────────────
function EmptyPublicChat() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center py-16 px-6">
      <div
        className="relative w-20 h-20 flex items-center justify-center rounded-3xl"
        style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}
      >
        {/* Simple SVG illustration */}
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="4" y="8" width="32" height="20" rx="5" fill="rgba(99,102,241,0.25)" stroke="#6366f1" strokeWidth="1.5"/>
          <circle cx="12" cy="18" r="2.5" fill="#818cf8"/>
          <circle cx="20" cy="18" r="2.5" fill="#818cf8"/>
          <circle cx="28" cy="18" r="2.5" fill="#818cf8"/>
          <path d="M16 28 L16 33 L22 28" fill="rgba(99,102,241,0.25)" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
        {/* Decorative glow */}
        <div
          className="absolute inset-0 rounded-3xl"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)' }}
        />
      </div>
      <div>
        <p className="font-semibold" style={{ color: '#f1f5f9' }}>El canal está tranquilo por ahora</p>
        <p className="text-sm mt-1.5 max-w-[240px]" style={{ color: '#4b5563', lineHeight: 1.5 }}>
          Sé el primero en escribir algo y empieza la conversación
        </p>
      </div>
    </div>
  )
}

// ── Public chat ──────────────────────────────────────────────────────────────
function PublicChat({ usuario }: { usuario: Usuario }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const [avatares, setAvatares] = useState<Record<string, string | null>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => {
    const [msgsRes, usersRes] = await Promise.all([
      supabase.from('mensajes').select('*').order('created_at', { ascending: true }).limit(100),
      supabase.from('usuarios').select('id, avatar_url'),
    ])
    if (msgsRes.data) setMensajes(msgsRes.data)
    if (usersRes.data) {
      const map: Record<string, string | null> = {}
      usersRes.data.forEach((u: { id: string; avatar_url: string | null }) => { map[u.id] = u.avatar_url })
      setAvatares(map)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    cargar()
    const channel = supabase
      .channel('public-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, payload => {
        setMensajes(prev => [...prev, payload.new as Mensaje])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [cargar])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    const t = texto.trim()
    setTexto('')
    await supabase.from('mensajes').insert({ usuario_id: usuario.id, autor: usuario.nombre, texto: t })
    inputRef.current?.focus()
  }

  // Count today's messages
  const todayCount = useMemo(() => {
    const todayStr = new Date().toDateString()
    return mensajes.filter(m => new Date(m.created_at).toDateString() === todayStr).length
  }, [mensajes])

  let lastDate = ''

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Channel header */}
      <div
        className="px-5 py-3.5 shrink-0 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#14161f' }}
      >
        <div
          className="w-8 h-8 flex items-center justify-center rounded-xl shrink-0"
          style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <Hash size={14} style={{ color: '#818cf8' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight" style={{ color: '#f1f5f9' }}>general</p>
          <p className="text-xs mt-0.5" style={{ color: '#4b5563' }}>
            {loading ? 'Cargando...' : `${todayCount} mensaje${todayCount !== 1 ? 's' : ''} hoy`}
          </p>
        </div>
        {/* Live badge */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shrink-0"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: '#10b981', animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
          />
          <span className="text-xs font-semibold" style={{ color: '#10b981' }}>En vivo</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-0">
        {loading ? (
          <LoadingDots />
        ) : mensajes.length === 0 ? (
          <EmptyPublicChat />
        ) : (
          mensajes.map((msg, idx) => {
            const isMine = msg.usuario_id === usuario.id
            const dateLabel = formatDate(msg.created_at)
            const showDate = dateLabel !== lastDate
            lastDate = dateLabel
            const prevMsg = mensajes[idx - 1]
            const nextMsg = mensajes[idx + 1]
            const isGrouped = !!(prevMsg && prevMsg.usuario_id === msg.usuario_id && !showDate)
            const isLastInGroup = !nextMsg || nextMsg.usuario_id !== msg.usuario_id

            return (
              <div key={msg.id} className="animate-fade-in">
                {showDate && <DateSeparator label={dateLabel} />}
                <BubbleRow
                  isMine={isMine}
                  isGrouped={isGrouped}
                  isLastInGroup={isLastInGroup}
                  showAuthor={!isMine && !isGrouped}
                  autor={msg.autor}
                  avatarUrl={avatares[msg.usuario_id]}
                  texto={msg.texto}
                  time={formatTime(msg.created_at)}
                />
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <MessageInput
        value={texto}
        onChange={setTexto}
        onSubmit={enviar}
        placeholder="Escribe algo en #general..."
        inputRef={inputRef}
      />
    </div>
  )
}

// ── Private chat ─────────────────────────────────────────────────────────────
function PrivateChat({ usuario, peer }: { usuario: Usuario; peer: Usuario }) {
  const [mensajes, setMensajes] = useState<MensajePrivado[]>([])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('mensajes_privados')
      .select('*')
      .or(`and(de_id.eq.${usuario.id},para_id.eq.${peer.id}),and(de_id.eq.${peer.id},para_id.eq.${usuario.id})`)
      .order('created_at', { ascending: true })
    if (data) setMensajes(data)
    setLoading(false)
  }, [usuario.id, peer.id])

  useEffect(() => {
    cargar()
    const channel = supabase
      .channel(`private-${[usuario.id, peer.id].sort().join('-')}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_privados' }, payload => {
        const msg = payload.new as MensajePrivado
        if (
          (msg.de_id === usuario.id && msg.para_id === peer.id) ||
          (msg.de_id === peer.id && msg.para_id === usuario.id)
        ) {
          setMensajes(prev => [...prev, msg])
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [cargar, usuario.id, peer.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    const t = texto.trim()
    setTexto('')
    await supabase.from('mensajes_privados').insert({
      de_id: usuario.id,
      de_nombre: usuario.nombre,
      para_id: peer.id,
      texto: t,
    })
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Conversation header */}
      <div
        className="px-5 py-3.5 shrink-0 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#14161f' }}
      >
        <Avatar nombre={peer.nombre} url={peer.avatar_url} size={38} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight" style={{ color: '#f1f5f9' }}>{peer.nombre}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Lock size={9} style={{ color: '#14b8a6' }} />
            <p className="text-xs" style={{ color: '#4b5563' }}>Conversación privada</p>
          </div>
        </div>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
          style={peer.rol === 'admin' ? {
            background: 'rgba(99,102,241,0.12)',
            color: '#818cf8',
            border: '1px solid rgba(99,102,241,0.25)',
          } : {
            background: 'rgba(20,184,166,0.08)',
            color: '#2dd4bf',
            border: '1px solid rgba(20,184,166,0.2)',
          }}
        >
          {peer.rol === 'admin' ? 'Admin' : 'Alumno'}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-0">
        {loading ? (
          <LoadingDots />
        ) : mensajes.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center py-16">
            <div
              className="relative"
              style={{ animation: 'float 3s ease-in-out infinite' }}
            >
              <div
                className="absolute inset-0 rounded-2xl blur-xl"
                style={{ background: 'rgba(20,184,166,0.15)', transform: 'scale(1.2)' }}
              />
              <div className="relative">
                <Avatar nombre={peer.nombre} url={peer.avatar_url} size={64} />
              </div>
            </div>
            <div>
              <p className="font-semibold" style={{ color: '#f1f5f9' }}>
                Hola, ¡empieza la conversación!
              </p>
              <p className="text-sm mt-1.5 max-w-[220px]" style={{ color: '#4b5563', lineHeight: 1.5 }}>
                Envía tu primer mensaje a {peer.nombre}
              </p>
            </div>
          </div>
        ) : (
          mensajes.map((msg, idx) => {
            const isMine = msg.de_id === usuario.id
            const prevMsg = mensajes[idx - 1]
            const nextMsg = mensajes[idx + 1]
            const isGrouped = !!(prevMsg && prevMsg.de_id === msg.de_id)
            const isLastInGroup = !nextMsg || nextMsg.de_id !== msg.de_id

            return (
              <div key={msg.id} className="animate-fade-in">
                <BubbleRow
                  isMine={isMine}
                  isGrouped={isGrouped}
                  isLastInGroup={isLastInGroup}
                  showAuthor={false}
                  autor={msg.de_nombre}
                  texto={msg.texto}
                  time={formatTime(msg.created_at)}
                />
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <MessageInput
        value={texto}
        onChange={setTexto}
        onSubmit={enviar}
        placeholder={`Mensaje a ${peer.nombre}...`}
        inputRef={inputRef}
        accentColor="#14b8a6"
        accentGlow="rgba(20,184,166,0.08)"
        accentBorder="rgba(20,184,166,0.4)"
        gradientFrom="#14b8a6"
        gradientTo="#6366f1"
      />
    </div>
  )
}

// ── User list (shared between sidebar desktop + mobile full screen) ───────────
function UserList({
  usuario,
  onSelect,
  selectedId,
  compact = false,
}: {
  usuario: Usuario
  onSelect: (u: Usuario) => void
  selectedId?: string | null
  compact?: boolean
}) {
  const [users, setUsers] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    supabase.from('usuarios').select('*').neq('id', usuario.id).order('nombre')
      .then(({ data }) => { if (data) setUsers(data); setLoading(false) })
  }, [usuario.id])

  const filtered = useMemo(() => {
    if (!query.trim()) return users
    const q = query.toLowerCase()
    return users.filter(u =>
      u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  }, [users, query])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Search bar */}
      <div className="px-3 py-2.5 shrink-0">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <Search size={13} style={{ color: '#4b5563', flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar usuario..."
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-slate-600"
            style={{ color: '#f1f5f9' }}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <LoadingDots />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-4">
            <div
              className="w-12 h-12 flex items-center justify-center rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <Users size={20} style={{ color: '#374151' }} />
            </div>
            <p className="text-xs" style={{ color: '#4b5563' }}>
              {query ? 'Sin resultados' : 'No hay otros usuarios'}
            </p>
          </div>
        ) : (
          <div className="px-2 py-1 flex flex-col gap-0.5">
            {!compact && (
              <p className="text-xs font-semibold uppercase tracking-wider px-2 py-1.5" style={{ color: '#374151' }}>
                {filtered.length} usuario{filtered.length !== 1 ? 's' : ''}
              </p>
            )}
            {filtered.map(u => {
              const isSelected = u.id === selectedId
              return (
                <button
                  key={u.id}
                  onClick={() => onSelect(u)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2.5 text-left rounded-xl transition-all duration-150"
                  style={{
                    background: isSelected ? 'rgba(20,184,166,0.1)' : 'transparent',
                    border: isSelected ? '1px solid rgba(20,184,166,0.2)' : '1px solid transparent',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = 'rgba(255,255,255,0.04)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = 'transparent'
                    }
                  }}
                >
                  <div className="shrink-0">
                    <Avatar nombre={u.nombre} url={u.avatar_url} size={compact ? 32 : 38} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-semibold truncate"
                      style={{ color: isSelected ? '#2dd4bf' : '#e2e8f0', fontSize: compact ? 12 : 13 }}
                    >
                      {u.nombre}
                    </p>
                    {!compact && (
                      <p className="text-xs truncate mt-0.5" style={{ color: '#374151' }}>{u.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={u.rol === 'admin' ? {
                        background: 'rgba(99,102,241,0.12)',
                        color: '#818cf8',
                        border: '1px solid rgba(99,102,241,0.22)',
                      } : {
                        background: 'rgba(20,184,166,0.08)',
                        color: '#2dd4bf',
                        border: '1px solid rgba(20,184,166,0.18)',
                      }}
                    >
                      {u.rol === 'admin' ? 'Admin' : 'Alumno'}
                    </span>
                    {isSelected && <ChevronRight size={12} style={{ color: '#14b8a6' }} />}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Desktop sidebar ───────────────────────────────────────────────────────────
function DesktopSidebar({
  usuario,
  subTab,
  setSubTab,
  selectedUser,
  onSelectUser,
}: {
  usuario: Usuario
  subTab: SubTab
  setSubTab: (t: SubTab) => void
  selectedUser: Usuario | null
  onSelectUser: (u: Usuario) => void
}) {
  return (
    <div
      className="hidden md:flex flex-col shrink-0 h-full"
      style={{
        width: 280,
        background: '#0f1117',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Sidebar header */}
      <div
        className="px-4 py-4 shrink-0 flex items-center gap-2.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          <MessageCircle size={13} style={{ color: 'white' }} />
        </div>
        <span className="font-bold text-sm" style={{ color: '#f1f5f9' }}>TopCode Chat</span>
      </div>

      {/* General section */}
      <div className="px-2 pt-3 pb-1 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-wider px-2 mb-1.5" style={{ color: '#374151' }}>
          Canales
        </p>
        <button
          onClick={() => setSubTab('publico')}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-150"
          style={{
            background: subTab === 'publico' ? 'rgba(99,102,241,0.12)' : 'transparent',
            border: subTab === 'publico' ? '1px solid rgba(99,102,241,0.22)' : '1px solid transparent',
          }}
        >
          <div
            className="w-6 h-6 flex items-center justify-center rounded-lg shrink-0"
            style={{
              background: subTab === 'publico' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
            }}
          >
            <Hash size={11} style={{ color: subTab === 'publico' ? '#818cf8' : '#4b5563' }} />
          </div>
          <span
            className="text-sm font-medium"
            style={{ color: subTab === 'publico' ? '#818cf8' : '#6b7280' }}
          >
            general
          </span>
          {subTab === 'publico' && (
            <div
              className="w-1.5 h-1.5 rounded-full ml-auto"
              style={{ background: '#10b981', animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
            />
          )}
        </button>
      </div>

      {/* Divider */}
      <div className="mx-4 my-2 shrink-0" style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />

      {/* Private messages section */}
      <div className="px-2 pb-1 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-wider px-2 mb-1" style={{ color: '#374151' }}>
          Mensajes Directos
        </p>
      </div>
      <div
        className="flex-1 min-h-0 flex flex-col"
        onClick={() => subTab !== 'privado' && setSubTab('privado')}
      >
        <UserList
          usuario={usuario}
          onSelect={u => { setSubTab('privado'); onSelectUser(u) }}
          selectedId={selectedUser?.id}
          compact
        />
      </div>
    </div>
  )
}

// ── Mobile tab bar ────────────────────────────────────────────────────────────
function MobileTabBar({
  subTab,
  setSubTab,
  selectedUser,
  onBack,
}: {
  subTab: SubTab
  setSubTab: (t: SubTab) => void
  selectedUser: Usuario | null
  onBack: () => void
}) {
  return (
    <div
      className="md:hidden px-4 py-3 shrink-0"
      style={{
        background: 'rgba(15,17,23,0.97)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center gap-3">
        {subTab === 'privado' && selectedUser && (
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/5 shrink-0"
            style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}
          >
            <ArrowLeft size={15} />
          </button>
        )}

        <div className="flex-1 min-w-0">
          {subTab === 'privado' && selectedUser ? (
            <div className="flex items-center gap-2.5">
              <Avatar nombre={selectedUser.nombre} url={selectedUser.avatar_url} size={30} />
              <div>
                <p className="font-semibold text-sm leading-tight" style={{ color: '#f1f5f9' }}>
                  {selectedUser.nombre}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Lock size={9} style={{ color: '#14b8a6' }} />
                  <p className="text-xs" style={{ color: '#4b5563' }}>Privado</p>
                </div>
              </div>
            </div>
          ) : (
            /* Segmented control */
            <div
              className="flex p-0.5 gap-0.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {(['publico', 'privado'] as SubTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSubTab(tab)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all duration-200"
                  style={subTab === tab ? {
                    background: tab === 'publico' ? 'rgba(99,102,241,0.15)' : 'rgba(20,184,166,0.12)',
                    border: tab === 'publico' ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(20,184,166,0.22)',
                    color: tab === 'publico' ? '#818cf8' : '#2dd4bf',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  } : {
                    background: 'transparent',
                    border: '1px solid transparent',
                    color: '#4b5563',
                  }}
                >
                  {tab === 'publico' ? <Hash size={12} /> : <Lock size={12} />}
                  {tab === 'publico' ? 'General' : 'Privado'}
                </button>
              ))}
            </div>
          )}
        </div>

        {subTab === 'publico' && (
          <div
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-full shrink-0"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#10b981', animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
            />
            <span className="text-xs font-semibold" style={{ color: '#10b981' }}>Live</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Keyframe styles injected once ─────────────────────────────────────────────
const globalStyles = `
  @keyframes dot-bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-6px); }
  }
  .animate-fade-in {
    animation: fadeSlideIn 0.2s ease-out both;
  }
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Chat() {
  const { usuario } = useAuth()
  const [subTab, setSubTab] = useState<SubTab>('publico')
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null)

  if (!usuario) return null

  function handleSetSubTab(tab: SubTab) {
    setSubTab(tab)
    if (tab === 'publico') setSelectedUser(null)
  }

  return (
    <>
      {/* Inject keyframes once */}
      <style>{globalStyles}</style>

      <div className="flex h-full overflow-hidden" style={{ background: '#0f1117' }}>

        {/* Desktop sidebar */}
        <DesktopSidebar
          usuario={usuario}
          subTab={subTab}
          setSubTab={handleSetSubTab}
          selectedUser={selectedUser}
          onSelectUser={setSelectedUser}
        />

        {/* Main panel */}
        <div className="flex flex-col flex-1 min-w-0 h-full">

          {/* Mobile header */}
          <MobileTabBar
            subTab={subTab}
            setSubTab={handleSetSubTab}
            selectedUser={selectedUser}
            onBack={() => setSelectedUser(null)}
          />

          {/* Content area */}
          <div
            className="flex-1 min-h-0 flex flex-col"
            style={{ background: '#14161f' }}
          >
            {subTab === 'publico' ? (
              <PublicChat usuario={usuario} />
            ) : selectedUser ? (
              <PrivateChat usuario={usuario} peer={selectedUser} />
            ) : (
              /* Mobile: full screen user list — desktop: this never shows because sidebar handles it */
              <div className="flex flex-col flex-1 min-h-0 md:hidden">
                <div
                  className="px-5 py-3.5 shrink-0"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#14161f' }}
                >
                  <p className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>Mensajes Directos</p>
                  <p className="text-xs mt-0.5" style={{ color: '#4b5563' }}>Selecciona un usuario para chatear</p>
                </div>
                <UserList
                  usuario={usuario}
                  onSelect={setSelectedUser}
                  selectedId={null}
                />
              </div>
            )}

            {/* Desktop: when in privado tab but no user selected, show a placeholder */}
            {subTab === 'privado' && !selectedUser && (
              <div
                className="hidden md:flex flex-col items-center justify-center flex-1 gap-4 text-center"
                style={{ color: '#374151' }}
              >
                <div
                  className="w-16 h-16 flex items-center justify-center rounded-2xl"
                  style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.12)' }}
                >
                  <MessageCircle size={28} style={{ color: '#115e59' }} />
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: '#6b7280' }}>
                    Selecciona una conversación
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#374151' }}>
                    Elige un usuario del panel izquierdo
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
