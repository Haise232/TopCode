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
      style={{ width: size, height: size, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}
    />
  )
  return (
    <div
      className="flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: '8px',
        background: 'rgba(99,102,241,0.12)',
        border: '1px solid rgba(99,102,241,0.2)',
      }}
    >
      <span className="font-bold" style={{ fontSize: size * 0.38, color: '#818cf8' }}>
        {nombre[0]?.toUpperCase() ?? '?'}
      </span>
    </div>
  )
}

function formatTime(ts: string) {
  const d = new Date(ts)
  return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts: string) {
  const d = new Date(ts)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const msgDay = new Date(d)
  msgDay.setHours(0, 0, 0, 0)
  if (msgDay.getTime() === today.getTime()) return 'Hoy'
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (msgDay.getTime() === yesterday.getTime()) return 'Ayer'
  return d.toLocaleDateString('es', { day: 'numeric', month: 'long' })
}

function LoadingDots() {
  return (
    <div className="flex items-center justify-center flex-1 py-12">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: '#6366f1', animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
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
    await supabase.from('mensajes').insert({
      usuario_id: usuario.id,
      autor: usuario.nombre,
      texto: t,
    })
    inputRef.current?.focus()
  }

  let lastDate = ''

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-1.5">
        {loading ? (
          <LoadingDots />
        ) : mensajes.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center py-16">
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <MessageCircle size={24} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: '#f1f5f9' }}>Sin mensajes todavía</p>
              <p className="text-sm mt-1" style={{ color: '#64748b' }}>¡Sé el primero en escribir!</p>
            </div>
          </div>
        ) : (
          mensajes.map(msg => {
            const isMine = msg.usuario_id === usuario.id
            const dateLabel = formatDate(msg.created_at)
            const showDate = dateLabel !== lastDate
            lastDate = dateLabel
            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                    <span
                      className="text-xs font-medium px-3 py-1 rounded-full"
                      style={{ background: '#1e2130', color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      {dateLabel}
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                  </div>
                )}
                <div className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : 'flex-row'} items-end`}>
                  {!isMine && (
                    <div className="mb-1 shrink-0">
                      <Avatar nombre={msg.autor} size={28} />
                    </div>
                  )}
                  <div className={`flex flex-col gap-1 max-w-[72%] ${isMine ? 'items-end' : 'items-start'}`}>
                    {!isMine && (
                      <span className="text-xs font-semibold ml-1" style={{ color: '#94a3b8' }}>
                        {msg.autor}
                      </span>
                    )}
                    <div
                      className="px-3.5 py-2.5 text-sm leading-relaxed"
                      style={isMine ? {
                        borderRadius: '14px 14px 4px 14px',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: 'white',
                      } : {
                        borderRadius: '14px 14px 14px 4px',
                        background: '#1e2130',
                        border: '1px solid rgba(255,255,255,0.07)',
                        color: '#f1f5f9',
                      }}
                    >
                      {msg.texto}
                    </div>
                    <span className="text-xs mx-1.5" style={{ color: '#64748b' }}>{formatTime(msg.created_at)}</span>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={enviar}
        className="px-4 py-3 flex gap-2.5 items-center"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: '#1a1d27' }}
      >
        <div className="flex-1">
          <input
            ref={inputRef}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="input-base"
          />
        </div>
        <button
          type="submit"
          disabled={!texto.trim()}
          className="w-10 h-10 flex items-center justify-center rounded-xl active:scale-95 transition-all duration-150 shrink-0"
          style={{
            background: texto.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${texto.trim() ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
            opacity: texto.trim() ? 1 : 0.5,
          }}
        >
          <Send size={14} style={{ color: texto.trim() ? 'white' : '#64748b', transform: 'translateX(1px)' }} />
        </button>
      </form>
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
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-1.5">
        {loading ? (
          <LoadingDots />
        ) : mensajes.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center py-16">
            <Avatar nombre={peer.nombre} url={peer.avatar_url} size={56} />
            <div>
              <p className="font-semibold" style={{ color: '#f1f5f9' }}>Conversación nueva</p>
              <p className="text-sm mt-1" style={{ color: '#64748b' }}>Envía el primer mensaje a {peer.nombre}</p>
            </div>
          </div>
        ) : (
          mensajes.map(msg => {
            const isMine = msg.de_id === usuario.id
            return (
              <div key={msg.id} className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : 'flex-row'} items-end`}>
                <div className={`flex flex-col gap-1 max-w-[72%] ${isMine ? 'items-end' : 'items-start'}`}>
                  <div
                    className="px-3.5 py-2.5 text-sm leading-relaxed"
                    style={isMine ? {
                      borderRadius: '14px 14px 4px 14px',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      color: 'white',
                    } : {
                      borderRadius: '14px 14px 14px 4px',
                      background: '#1e2130',
                      border: '1px solid rgba(255,255,255,0.07)',
                      color: '#f1f5f9',
                    }}
                  >
                    {msg.texto}
                  </div>
                  <span className="text-xs mx-1.5" style={{ color: '#64748b' }}>{formatTime(msg.created_at)}</span>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={enviar}
        className="px-4 py-3 flex gap-2.5 items-center"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: '#1a1d27' }}
      >
        <input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder={`Mensaje a ${peer.nombre}...`}
          className="input-base flex-1"
        />
        <button
          type="submit"
          disabled={!texto.trim()}
          className="w-10 h-10 flex items-center justify-center rounded-xl active:scale-95 transition-all duration-150 shrink-0"
          style={{
            background: texto.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${texto.trim() ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
            opacity: texto.trim() ? 1 : 0.5,
          }}
        >
          <Send size={14} style={{ color: texto.trim() ? 'white' : '#64748b', transform: 'translateX(1px)' }} />
        </button>
      </form>
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
          <div className="w-14 h-14 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Users size={24} style={{ color: '#64748b' }} />
          </div>
          <p className="text-sm" style={{ color: '#64748b' }}>No hay otros usuarios</p>
        </div>
      ) : (
        <div className="p-3 flex flex-col gap-1">
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => onSelect(u)}
              className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-xl transition-all duration-150 hover:bg-white/5"
              style={{ border: '1px solid transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'transparent' }}
            >
              <div className="shrink-0">
                <Avatar nombre={u.nombre} url={u.avatar_url} size={40} />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>{u.nombre}</p>
                <p className="text-xs truncate" style={{ color: '#64748b' }}>{u.email}</p>
              </div>
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                style={u.rol === 'admin' ? {
                  background: 'rgba(99,102,241,0.15)',
                  color: '#818cf8',
                  border: '1px solid rgba(99,102,241,0.25)',
                } : {
                  background: 'rgba(255,255,255,0.06)',
                  color: '#64748b',
                  border: '1px solid rgba(255,255,255,0.08)',
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

// ── Main screen ──────────────────────────────────────────────────────────────
export default function Chat() {
  const { usuario } = useAuth()
  const [subTab, setSubTab] = useState<SubTab>('publico')
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null)

  if (!usuario) return null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-4 py-4 shrink-0"
        style={{ background: '#1a1d27', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="max-w-[1100px] mx-auto flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {subTab === 'privado' && selectedUser && (
              <button
                onClick={() => setSelectedUser(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/5"
                style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}
              >
                <ArrowLeft size={15} />
              </button>
            )}
            <div className="flex-1">
              {subTab === 'privado' && selectedUser ? (
                <div className="flex items-center gap-2.5">
                  <Avatar nombre={selectedUser.nombre} url={selectedUser.avatar_url} size={32} />
                  <div>
                    <p className="font-semibold text-base leading-none" style={{ color: '#f1f5f9' }}>{selectedUser.nombre}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Lock size={9} style={{ color: '#64748b' }} />
                      <p className="text-xs" style={{ color: '#64748b' }}>Conversación privada</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-base leading-none" style={{ color: '#f1f5f9' }}>
                    {subTab === 'publico' ? 'Chat General' : 'Mensajes Privados'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                    {subTab === 'publico' ? 'Sala abierta · todos los alumnos' : 'Selecciona un usuario'}
                  </p>
                </div>
              )}
            </div>
            {subTab === 'publico' && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10b981' }} />
                <span className="text-xs font-semibold" style={{ color: '#10b981' }}>En vivo</span>
              </div>
            )}
          </div>

          {/* Segmented control */}
          <div
            className="flex p-0.5 gap-1 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            {(['publico', 'privado'] as SubTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => { setSubTab(tab); if (tab === 'publico') setSelectedUser(null) }}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all duration-150"
                style={subTab === tab ? {
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))',
                  border: '1px solid rgba(99,102,241,0.3)',
                  color: '#818cf8',
                } : {
                  background: 'transparent',
                  border: '1px solid transparent',
                  color: '#64748b',
                }}
              >
                {tab === 'publico' ? <MessageCircle size={14} /> : <Lock size={14} />}
                {tab === 'publico' ? 'Público' : 'Privado'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
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
