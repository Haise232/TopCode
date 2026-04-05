import { useEffect, useState, useRef, useCallback } from 'react'
import { Send, ArrowLeft, MessageCircle, Lock, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Mensaje, MensajePrivado, Usuario } from '../lib/types'

type SubTab = 'publico' | 'privado'

function Avatar({ nombre, url, size = 32 }: { nombre: string; url?: string | null; size?: number }) {
  if (url) return (
    <img
      src={url}
      alt={nombre}
      className="object-cover shrink-0"
      style={{ width: size, height: size, borderRadius: '10px', border: '1.5px solid rgba(255,255,255,0.08)' }}
    />
  )
  // Deterministic color from name
  const hue = nombre.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div
      className="flex items-center justify-center shrink-0 font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: '10px',
        background: `hsla(${hue}, 55%, 25%, 0.9)`,
        border: `1.5px solid hsla(${hue}, 55%, 45%, 0.3)`,
        color: `hsla(${hue}, 75%, 75%, 1)`,
        fontSize: size * 0.38,
      }}
    >
      {nombre[0]?.toUpperCase() ?? '?'}
    </div>
  )
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
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
      <span
        className="text-xs font-medium px-3 py-1 rounded-full"
        style={{
          background: 'rgba(255,255,255,0.04)',
          color: '#4b5563',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
    </div>
  )
}

function MessageInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  inputRef,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  placeholder: string
  inputRef?: React.RefObject<HTMLInputElement>
}) {
  const active = value.trim().length > 0
  return (
    <form
      onSubmit={onSubmit}
      className="px-4 py-3 shrink-0"
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#1a1d27' }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-2xl transition-all duration-200"
        style={{
          background: '#141720',
          border: active ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.07)',
          boxShadow: active ? '0 0 0 3px rgba(99,102,241,0.08)' : 'none',
        }}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none"
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
            background: active ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.04)',
            boxShadow: active ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
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

// ── Public chat ──────────────────────────────────────────────────────────────
function PublicChat({ usuario }: { usuario: Usuario }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('mensajes')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100)
    if (data) setMensajes(data)
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

  let lastDate = ''

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-0.5">
        {loading ? (
          <LoadingDots />
        ) : mensajes.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center py-16">
            <div
              className="w-14 h-14 flex items-center justify-center rounded-2xl"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.18)' }}
            >
              <MessageCircle size={24} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: '#f1f5f9' }}>Sin mensajes todavía</p>
              <p className="text-sm mt-1" style={{ color: '#64748b' }}>¡Sé el primero en escribir algo!</p>
            </div>
          </div>
        ) : (
          mensajes.map((msg, idx) => {
            const isMine = msg.usuario_id === usuario.id
            const dateLabel = formatDate(msg.created_at)
            const showDate = dateLabel !== lastDate
            lastDate = dateLabel

            // Group consecutive messages from same author
            const prevMsg = mensajes[idx - 1]
            const isGrouped = prevMsg && prevMsg.usuario_id === msg.usuario_id && !showDate

            return (
              <div key={msg.id}>
                {showDate && <DateSeparator label={dateLabel} />}
                <div
                  className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : 'flex-row'} items-end`}
                  style={{ marginBottom: isGrouped ? '2px' : '6px' }}
                >
                  {/* Avatar — only show on last in group */}
                  {!isMine && (
                    <div className="mb-0.5 shrink-0" style={{ opacity: isGrouped ? 0 : 1 }}>
                      <Avatar nombre={msg.autor} size={28} />
                    </div>
                  )}
                  <div className={`flex flex-col gap-0.5 max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
                    {!isMine && !isGrouped && (
                      <span className="text-xs font-semibold ml-1" style={{ color: '#64748b' }}>
                        {msg.autor}
                      </span>
                    )}
                    <div
                      className="px-3.5 py-2.5 text-sm leading-relaxed"
                      style={isMine ? {
                        borderRadius: isGrouped ? '18px 4px 4px 18px' : '18px 4px 18px 18px',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: 'white',
                        boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
                      } : {
                        borderRadius: isGrouped ? '4px 18px 18px 4px' : '4px 18px 18px 18px',
                        background: '#1e2130',
                        border: '1px solid rgba(255,255,255,0.06)',
                        color: '#e2e8f0',
                      }}
                    >
                      {msg.texto}
                    </div>
                    {/* Show time only on last grouped message */}
                    {(() => {
                      const nextMsg = mensajes[idx + 1]
                      const isLastInGroup = !nextMsg || nextMsg.usuario_id !== msg.usuario_id
                      return isLastInGroup ? (
                        <span className="text-xs mx-1.5 mt-0.5" style={{ color: '#4b5563' }}>
                          {formatTime(msg.created_at)}
                        </span>
                      ) : null
                    })()}
                  </div>
                </div>
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
        placeholder="Escribe un mensaje..."
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
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-0.5">
        {loading ? (
          <LoadingDots />
        ) : mensajes.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center py-16">
            <Avatar nombre={peer.nombre} url={peer.avatar_url} size={56} />
            <div>
              <p className="font-semibold" style={{ color: '#f1f5f9' }}>Conversación nueva</p>
              <p className="text-sm mt-1" style={{ color: '#64748b' }}>
                Envía el primer mensaje a {peer.nombre}
              </p>
            </div>
          </div>
        ) : (
          mensajes.map((msg, idx) => {
            const isMine = msg.de_id === usuario.id
            const prevMsg = mensajes[idx - 1]
            const isGrouped = prevMsg && prevMsg.de_id === msg.de_id
            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? 'flex-row-reverse' : 'flex-row'} items-end gap-2.5`}
                style={{ marginBottom: isGrouped ? '2px' : '6px' }}
              >
                <div className={`flex flex-col gap-0.5 max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
                  <div
                    className="px-3.5 py-2.5 text-sm leading-relaxed"
                    style={isMine ? {
                      borderRadius: isGrouped ? '18px 4px 4px 18px' : '18px 4px 18px 18px',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      color: 'white',
                      boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
                    } : {
                      borderRadius: isGrouped ? '4px 18px 18px 4px' : '4px 18px 18px 18px',
                      background: '#1e2130',
                      border: '1px solid rgba(255,255,255,0.06)',
                      color: '#e2e8f0',
                    }}
                  >
                    {msg.texto}
                  </div>
                  {(() => {
                    const nextMsg = mensajes[idx + 1]
                    const isLast = !nextMsg || nextMsg.de_id !== msg.de_id
                    return isLast ? (
                      <span className="text-xs mx-1.5 mt-0.5" style={{ color: '#4b5563' }}>
                        {formatTime(msg.created_at)}
                      </span>
                    ) : null
                  })()}
                </div>
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
      />
    </div>
  )
}

// ── User list ────────────────────────────────────────────────────────────────
function UserList({ usuario, onSelect }: { usuario: Usuario; onSelect: (u: Usuario) => void }) {
  const [users, setUsers] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('usuarios').select('*').neq('id', usuario.id).order('nombre')
      .then(({ data }) => { if (data) setUsers(data); setLoading(false) })
  }, [usuario.id])

  return (
    <div className="flex-1 overflow-y-auto">
      {loading ? (
        <LoadingDots />
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div
            className="w-14 h-14 flex items-center justify-center rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <Users size={24} style={{ color: '#4b5563' }} />
          </div>
          <p className="text-sm" style={{ color: '#64748b' }}>No hay otros usuarios</p>
        </div>
      ) : (
        <div className="p-3 flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider px-2 mb-2" style={{ color: '#4b5563' }}>
            {users.length} usuario{users.length !== 1 ? 's' : ''}
          </p>
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => onSelect(u)}
              className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-xl transition-all duration-150 group"
              style={{ border: '1px solid transparent' }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'rgba(255,255,255,0.04)'
                el.style.borderColor = 'rgba(255,255,255,0.06)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'transparent'
                el.style.borderColor = 'transparent'
              }}
            >
              <div className="shrink-0">
                <Avatar nombre={u.nombre} url={u.avatar_url} size={40} />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>{u.nombre}</p>
                <p className="text-xs truncate mt-0.5" style={{ color: '#4b5563' }}>{u.email}</p>
              </div>
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                style={u.rol === 'admin' ? {
                  background: 'rgba(99,102,241,0.12)',
                  color: '#818cf8',
                  border: '1px solid rgba(99,102,241,0.22)',
                } : {
                  background: 'rgba(255,255,255,0.05)',
                  color: '#4b5563',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {u.rol === 'admin' ? 'Admin' : 'Alumno'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Chat() {
  const { usuario } = useAuth()
  const [subTab, setSubTab] = useState<SubTab>('publico')
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null)

  if (!usuario) return null

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div
        className="px-4 py-4 shrink-0"
        style={{
          background: 'rgba(26,29,39,0.95)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="max-w-[1100px] mx-auto flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {subTab === 'privado' && selectedUser && (
              <button
                onClick={() => setSelectedUser(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/5 shrink-0"
                style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}
              >
                <ArrowLeft size={15} />
              </button>
            )}
            <div className="flex-1 min-w-0">
              {subTab === 'privado' && selectedUser ? (
                <div className="flex items-center gap-2.5">
                  <Avatar nombre={selectedUser.nombre} url={selectedUser.avatar_url} size={32} />
                  <div>
                    <p className="font-semibold text-sm leading-tight" style={{ color: '#f1f5f9' }}>
                      {selectedUser.nombre}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Lock size={9} style={{ color: '#4b5563' }} />
                      <p className="text-xs" style={{ color: '#4b5563' }}>Conversación privada</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-sm leading-tight" style={{ color: '#f1f5f9' }}>
                    {subTab === 'publico' ? 'Chat General' : 'Mensajes Privados'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#4b5563' }}>
                    {subTab === 'publico' ? 'Sala abierta · todos los alumnos' : 'Selecciona un usuario para chatear'}
                  </p>
                </div>
              )}
            </div>
            {subTab === 'publico' && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shrink-0"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}
              >
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10b981' }} />
                <span className="text-xs font-semibold" style={{ color: '#10b981' }}>En vivo</span>
              </div>
            )}
          </div>

          {/* Segmented control */}
          <div
            className="flex p-0.5 gap-0.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {(['publico', 'privado'] as SubTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => { setSubTab(tab); if (tab === 'publico') setSelectedUser(null) }}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all duration-200"
                style={subTab === tab ? {
                  background: 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(99,102,241,0.25)',
                  color: '#818cf8',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                } : {
                  background: 'transparent',
                  border: '1px solid transparent',
                  color: '#4b5563',
                }}
              >
                {tab === 'publico' ? <MessageCircle size={13} /> : <Lock size={13} />}
                {tab === 'publico' ? 'General' : 'Privado'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-h-0 flex flex-col max-w-[1100px] w-full mx-auto">
        {subTab === 'publico' ? (
          <PublicChat usuario={usuario} />
        ) : selectedUser ? (
          <PrivateChat usuario={usuario} peer={selectedUser} />
        ) : (
          <UserList usuario={usuario} onSelect={setSelectedUser} />
        )}
      </div>
    </div>
  )
}
