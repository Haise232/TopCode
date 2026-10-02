import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Send, ArrowLeft, MessageCircle, Lock, Users,
  Hash, Search, ChevronRight, Pencil, Trash2, Check, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePublicMensajes, usePrivateMensajes, type Usuario, type UsuarioPublico } from '@topcode/shared'
import { markChatVisited } from '../hooks/useUnreadCounts'

type SubTab = 'publico' | 'privado'

interface CanalInfo {
  id: string
  label: string
  desc: string
  color: string
}

function getCanalesDisponibles(): CanalInfo[] {
  return [
    { id: 'general', label: 'General', desc: 'Todos los alumnos', color: '#3d9f89' },
  ]
}

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
      loading="lazy"
      decoding="async"
      className="object-cover shrink-0"
      style={{ width: size, height: size, borderRadius: '10px', border: '1.5px solid var(--overlay-08)' }}
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
              background: '#3d9f89',
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
        style={{ background: 'linear-gradient(to right, transparent, var(--overlay-07))' }}
      />
      <span
        className="text-xs font-semibold px-3 py-1 rounded-full shrink-0"
        style={{
          background: 'rgba(61,159,137,0.06)',
          color: '#3d9f89',
          border: '1px solid rgba(61,159,137,0.18)',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
      <div
        className="flex-1 h-px"
        style={{ background: 'linear-gradient(to left, transparent, var(--overlay-07))' }}
      />
    </div>
  )
}

function MessageInput({
  value,
  onChange,
  onSubmit,
  onTyping,
  placeholder,
  inputRef,
  accentColor: _accentColor = '#3d9f89',
  accentGlow = 'rgba(61,159,137,0.08)',
  accentBorder = 'rgba(61,159,137,0.4)',
  gradientFrom = '#3d9f89',
  gradientTo = '#2c8178',
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  onTyping?: () => void
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
      style={{ borderTop: '1px solid var(--overlay-05)', background: 'var(--color-surface-2)' }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all duration-200"
        style={{
          background: 'var(--color-surface)',
          border: active ? `1px solid ${accentBorder}` : '1px solid var(--overlay-07)',
          boxShadow: active ? `0 0 0 3px ${accentGlow}` : 'none',
        }}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={e => { onChange(e.target.value); if (e.target.value.trim()) onTyping?.() }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600"
          style={{ color: 'var(--color-text)' }}
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
              : 'var(--overlay-04)',
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
interface BubbleRowProps {
  isMine: boolean
  isGrouped: boolean
  isLastInGroup: boolean
  showAuthor: boolean
  autor: string
  avatarUrl?: string | null
  texto: string
  time: string
  editado?: boolean
  eliminado?: boolean
  isEditing?: boolean
  canEdit?: boolean
  onOpenProfile?: () => void
  onStartEdit?: () => void
  onCancelEdit?: () => void
  onConfirmEdit?: (text: string) => void
  onDelete?: () => void
}

function BubbleRow({
  isMine, isGrouped, isLastInGroup, showAuthor, autor, avatarUrl,
  texto, time, editado, eliminado, isEditing, canEdit,
  onStartEdit, onCancelEdit, onConfirmEdit, onDelete,
  onOpenProfile,
}: BubbleRowProps) {
  const [editText, setEditText] = useState(texto)
  const [hovered, setHovered] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      setEditText(texto)
      setTimeout(() => editInputRef.current?.focus(), 50)
    }
  }, [isEditing, texto])

  if (eliminado) {
    return (
      <div
        className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : 'flex-row'} items-end`}
        style={{ marginBottom: isGrouped ? '2px' : '8px' }}
      >
        {!isMine && <div className="shrink-0" style={{ width: 28 }} />}
        <div className={`flex flex-col gap-0.5 max-w-[72%] ${isMine ? 'items-end' : 'items-start'}`}>
          <div
            className="px-3.5 py-2 text-xs italic"
            style={{
              borderRadius: '12px',
              background: 'var(--overlay-03)',
              border: '1px solid var(--overlay-06)',
              color: '#4b5563',
            }}
          >
            Mensaje eliminado
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : 'flex-row'} items-end group/bubble`}
      style={{ marginBottom: isGrouped ? '2px' : '8px' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!isMine && (
        <div className="shrink-0" style={{ width: 28, opacity: isGrouped ? 0 : 1 }}>
          <button
            type="button"
            onClick={onOpenProfile}
            className="rounded-lg transition-opacity hover:opacity-80"
            aria-label={`Ver perfil de ${autor}`}
          >
            <Avatar nombre={autor} url={avatarUrl} size={28} />
          </button>
        </div>
      )}

      <div className={`flex items-end gap-1.5 max-w-[72%] ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Menú de acciones (solo mis mensajes, en hover) */}
        {canEdit && hovered && !isEditing && (
          <div
            className="flex items-center gap-1 shrink-0 mb-1"
            style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}
          >
            <button
              onClick={onStartEdit}
              className="w-6 h-6 flex items-center justify-center rounded-lg transition-all"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--overlay-08)', color: '#94a3b8' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#3d9f89' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}
              title="Editar"
            >
              <Pencil size={10} />
            </button>
            <button
              onClick={onDelete}
              className="w-6 h-6 flex items-center justify-center rounded-lg transition-all"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--overlay-08)', color: '#94a3b8' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f43f5e' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}
              title="Eliminar"
            >
              <Trash2 size={10} />
            </button>
          </div>
        )}

        <div className={`flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
          {!isMine && showAuthor && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="text-xs font-semibold ml-1 mb-0.5 hover:underline"
              style={{ color: `hsla(${getHue(autor)}, 65%, 65%, 1)` }}
            >
              {autor}
            </button>
          )}

          {isEditing ? (
            /* Modo edición */
            <div
              className="flex items-center gap-2 px-3 py-2"
              style={{
                borderRadius: '14px',
                background: 'rgba(61,159,137,0.1)',
                border: '1.5px solid rgba(61,159,137,0.4)',
                minWidth: '180px',
              }}
            >
              <input
                ref={editInputRef}
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onConfirmEdit?.(editText) }
                  if (e.key === 'Escape') onCancelEdit?.()
                }}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'white', minWidth: 0 }}
              />
              <button onClick={() => onConfirmEdit?.(editText)}
                className="w-5 h-5 flex items-center justify-center rounded-md transition-all"
                style={{ background: 'rgba(61,159,137,0.3)', color: 'white' }}>
                <Check size={10} />
              </button>
              <button onClick={onCancelEdit}
                className="w-5 h-5 flex items-center justify-center rounded-md transition-all"
                style={{ color: '#64748b' }}>
                <X size={10} />
              </button>
            </div>
          ) : (
            <div
              className="px-3.5 py-2.5 text-sm leading-relaxed"
              style={isMine ? {
                borderRadius: isGrouped ? '18px 4px 4px 18px' : '18px 4px 18px 18px',
                background: 'linear-gradient(135deg, #3d9f89, #2c8178)',
                color: 'white',
                boxShadow: '0 2px 10px rgba(61,159,137,0.28)',
              } : {
                borderRadius: isGrouped ? '4px 18px 18px 4px' : '4px 18px 18px 18px',
                background: '#1e2233',
                border: '1px solid var(--overlay-07)',
                color: '#e2e8f0',
              }}
            >
              {texto}
            </div>
          )}

          {isLastInGroup && !isEditing && (
            <span className="text-xs mx-1.5 mt-0.5 flex items-center gap-1.5" style={{ color: '#374151' }}>
              {time}
              {editado && <span style={{ color: '#4b5563', fontSize: 10 }}>(editado)</span>}
            </span>
          )}
        </div>
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
        style={{ background: 'rgba(61,159,137,0.08)', border: '1px solid rgba(61,159,137,0.18)' }}
      >
        {/* Simple SVG illustration */}
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="4" y="8" width="32" height="20" rx="5" fill="rgba(61,159,137,0.25)" stroke="#3d9f89" strokeWidth="1.5"/>
          <circle cx="12" cy="18" r="2.5" fill="#75b9aa"/>
          <circle cx="20" cy="18" r="2.5" fill="#75b9aa"/>
          <circle cx="28" cy="18" r="2.5" fill="#75b9aa"/>
          <path d="M16 28 L16 33 L22 28" fill="rgba(61,159,137,0.25)" stroke="#3d9f89" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
        {/* Decorative glow */}
        <div
          className="absolute inset-0 rounded-3xl"
          style={{ background: 'radial-gradient(circle, rgba(61,159,137,0.12) 0%, transparent 70%)' }}
        />
      </div>
      <div>
        <p className="font-semibold" style={{ color: 'var(--color-text)' }}>El canal está tranquilo por ahora</p>
        <p className="text-sm mt-1.5 max-w-[240px]" style={{ color: '#4b5563', lineHeight: 1.5 }}>
          Sé el primero en escribir algo y empieza la conversación
        </p>
      </div>
    </div>
  )
}

// ── Public chat ──────────────────────────────────────────────────────────────
function PublicChat({ usuario }: { usuario: Usuario }) {
  const navigate = useNavigate()
  const canales = getCanalesDisponibles()
  const [canalActivo, setCanalActivo] = useState(canales[0].id)
  const canalInfo = canales.find(c => c.id === canalActivo) ?? canales[0]

  const {
    mensajes, avatares, loading,
    typingUsers,
    enviar: enviarMensaje,
    editarMensaje,
    eliminarMensaje,
    emitirTyping,
  } = usePublicMensajes(canalActivo)
  const [texto, setTexto] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce typing: emitir máximo una vez cada 2s mientras escribe
  const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleTyping = useCallback(() => {
    if (typingDebounce.current) return
    emitirTyping(usuario.nombre)
    typingDebounce.current = setTimeout(() => { typingDebounce.current = null }, 2000)
  }, [emitirTyping, usuario.nombre])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    const t = texto.trim()
    setTexto('')
    const { error } = await enviarMensaje(t, usuario.id, usuario.nombre)
    // Si no se envió, devolver el texto al input para no perderlo
    if (error) setTexto(prev => prev || t)
    inputRef.current?.focus()
  }

  const todayCount = useMemo(() => {
    const todayStr = new Date().toDateString()
    return mensajes.filter(m => new Date(m.created_at).toDateString() === todayStr).length
  }, [mensajes])

  // Usuarios escribiendo que NO soy yo
  const othersTyping = typingUsers.filter(n => n !== usuario.nombre)

  let lastDate = ''

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Channel header + selector */}
      <div
        className="shrink-0"
        style={{ borderBottom: '1px solid var(--overlay-05)', background: 'var(--color-surface-2)' }}
      >
        {/* Header row */}
        <div className="px-5 py-3 flex items-center gap-3">
          <div
            className="w-8 h-8 flex items-center justify-center rounded-xl shrink-0"
            style={{
              background: `color-mix(in srgb, ${canalInfo.color} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${canalInfo.color} 25%, transparent)`,
            }}
          >
            <Hash size={14} style={{ color: canalInfo.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--color-text)' }}>
              {canalInfo.label}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#4b5563' }}>
              {loading ? 'Cargando...' : `${todayCount} mensaje${todayCount !== 1 ? 's' : ''} hoy · ${canalInfo.desc}`}
            </p>
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shrink-0"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#2f8f75', animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
            />
            <span className="text-xs font-semibold" style={{ color: '#2f8f75' }}>En vivo</span>
          </div>
        </div>

        {/* Canal tabs */}
        {canales.length > 1 && (
        <div className="px-3 pb-2.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {canales.map(c => {
            const active = c.id === canalActivo
            return (
              <button
                key={c.id}
                onClick={() => { setCanalActivo(c.id); setTexto(''); setEditandoId(null) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all duration-150"
                style={{
                  background: active ? `color-mix(in srgb, ${c.color} 14%, transparent)` : 'var(--overlay-03)',
                  border: active ? `1px solid color-mix(in srgb, ${c.color} 30%, transparent)` : '1px solid transparent',
                  color: active ? c.color : '#6b7280',
                }}
              >
                <Hash size={10} />
                {c.label}
              </button>
            )
          })}
        </div>
        )}
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
                  onOpenProfile={() => navigate(`/profile/${msg.usuario_id}`)}
                  texto={msg.texto}
                  time={formatTime(msg.created_at)}
                  editado={msg.editado}
                  eliminado={msg.eliminado}
                  isEditing={editandoId === msg.id}
                  canEdit={isMine}
                  onStartEdit={() => setEditandoId(msg.id)}
                  onCancelEdit={() => setEditandoId(null)}
                  onConfirmEdit={async (text) => {
                    setEditandoId(null)
                    await editarMensaje(msg.id, text)
                  }}
                  onDelete={() => eliminarMensaje(msg.id)}
                />
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      {othersTyping.length > 0 && (
        <div
          className="px-5 py-2 shrink-0 flex items-center gap-2"
          style={{ borderTop: '1px solid var(--overlay-04)', background: 'var(--color-surface-2)' }}
        >
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#3d9f89', animation: 'dot-bounce 1.4s ease-in-out infinite', animationDelay: `${i * 0.18}s` }} />
            ))}
          </div>
          <span className="text-xs" style={{ color: '#4b5563' }}>
            {othersTyping.length === 1
              ? `${othersTyping[0]} está escribiendo…`
              : `${othersTyping.slice(0, 2).join(', ')} están escribiendo…`}
          </span>
        </div>
      )}

      <MessageInput
        value={texto}
        onChange={setTexto}
        onSubmit={enviar}
        onTyping={handleTyping}
        placeholder="Escribe algo en #general..."
        inputRef={inputRef}
      />
    </div>
  )
}

// ── Private chat ─────────────────────────────────────────────────────────────
function PrivateChat({ usuario, peer }: { usuario: Usuario; peer: UsuarioPublico }) {
  const navigate = useNavigate()
  const { mensajes, loading, enviar: enviarMensaje } = usePrivateMensajes({ meId: usuario.id, peerId: peer.id })
  const [texto, setTexto] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    const t = texto.trim()
    setTexto('')
    const { error } = await enviarMensaje(t, usuario.nombre)
    if (error) setTexto(prev => prev || t)
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Conversation header */}
      <div
        className="px-5 py-3.5 shrink-0 flex items-center gap-3"
        style={{ borderBottom: '1px solid var(--overlay-05)', background: 'var(--color-surface-2)' }}
      >
        <button type="button" onClick={() => navigate(`/profile/${peer.id}`)} aria-label={`Ver perfil de ${peer.nombre}`}>
          <Avatar nombre={peer.nombre} url={peer.avatar_url} size={38} />
        </button>
        <div className="flex-1 min-w-0">
          <button type="button" onClick={() => navigate(`/profile/${peer.id}`)} className="font-semibold text-sm leading-tight hover:underline" style={{ color: 'var(--color-text)' }}>{peer.nombre}</button>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Lock size={9} style={{ color: '#14b8a6' }} />
            <p className="text-xs" style={{ color: '#4b5563' }}>Conversación privada</p>
          </div>
        </div>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
          style={peer.rol === 'admin' ? {
            background: 'rgba(61,159,137,0.12)',
            color: '#75b9aa',
            border: '1px solid rgba(61,159,137,0.25)',
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
              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
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
                  onOpenProfile={() => navigate(`/profile/${msg.de_id}`)}
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
        gradientTo="#3d9f89"
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
  onSelect: (u: UsuarioPublico) => void
  selectedId?: string | null
  compact?: boolean
}) {
  const [users, setUsers] = useState<UsuarioPublico[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    Promise.resolve(
      supabase
        .from('usuarios_publicos')
        .select('id, nombre, avatar_url')
        .neq('id', usuario.id)
        .order('nombre')
    )
      .then(({ data, error: queryError }) => {
        if (!active) return
        if (queryError) setError(true)
        if (data) setUsers(data as UsuarioPublico[])
      })
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [usuario.id])

  const filtered = useMemo(() => {
    if (!query.trim()) return users
    const q = query.toLowerCase()
    return users.filter(u =>
      u.nombre.toLowerCase().includes(q)
    )
  }, [users, query])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Search bar */}
      <div className="px-3 py-2.5 shrink-0">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'var(--overlay-04)', border: '1px solid var(--overlay-07)' }}
        >
          <Search size={13} style={{ color: '#4b5563', flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar usuario..."
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-slate-600"
            style={{ color: 'var(--color-text)' }}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <LoadingDots />
        ) : error ? (
          <div className="px-4 py-10 text-center text-xs text-text-muted">
            No se pudieron cargar los usuarios.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-4">
            <div
              className="w-12 h-12 flex items-center justify-center rounded-2xl"
              style={{ background: 'var(--overlay-04)', border: '1px solid var(--overlay-07)' }}
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
                      el.style.background = 'var(--overlay-04)'
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
                  </div>
                  {isSelected && (
                    <ChevronRight size={12} style={{ color: '#14b8a6', flexShrink: 0 }} />
                  )}
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
  selectedUser: UsuarioPublico | null
  onSelectUser: (u: UsuarioPublico) => void
}) {
  return (
    <div
      className="hidden md:flex flex-col shrink-0 h-full"
      style={{
        width: 280,
        background: 'var(--color-bg)',
        borderRight: '1px solid var(--overlay-06)',
      }}
    >
      {/* Sidebar header */}
      <div
        className="px-4 py-4 shrink-0 flex items-center gap-2.5"
        style={{ borderBottom: '1px solid var(--overlay-06)' }}
      >
        <div
          className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
          style={{ background: 'linear-gradient(135deg, #3d9f89, #2c8178)' }}
        >
          <MessageCircle size={13} style={{ color: 'white' }} />
        </div>
        <span className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>TopCode Chat</span>
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
            background: subTab === 'publico' ? 'rgba(61,159,137,0.12)' : 'transparent',
            border: subTab === 'publico' ? '1px solid rgba(61,159,137,0.22)' : '1px solid transparent',
          }}
        >
          <div
            className="w-6 h-6 flex items-center justify-center rounded-lg shrink-0"
            style={{
              background: subTab === 'publico' ? 'rgba(61,159,137,0.2)' : 'var(--overlay-05)',
            }}
          >
            <Hash size={11} style={{ color: subTab === 'publico' ? '#75b9aa' : '#4b5563' }} />
          </div>
          <span
            className="text-sm font-medium"
            style={{ color: subTab === 'publico' ? '#75b9aa' : '#6b7280' }}
          >
            general
          </span>
          {subTab === 'publico' && (
            <div
              className="w-1.5 h-1.5 rounded-full ml-auto"
              style={{ background: '#2f8f75', animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
            />
          )}
        </button>
      </div>

      {/* Divider */}
      <div className="mx-4 my-2 shrink-0" style={{ height: 1, background: 'var(--overlay-04)' }} />

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
  selectedUser: UsuarioPublico | null
  onBack: () => void
}) {
  return (
    <div
      className="md:hidden px-4 py-3 shrink-0"
      style={{
        background: 'rgba(15,17,23,0.97)',
        borderBottom: '1px solid var(--overlay-06)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center gap-3">
        {subTab === 'privado' && selectedUser && (
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/5 shrink-0"
            style={{ border: '1px solid var(--overlay-08)', color: '#94a3b8' }}
          >
            <ArrowLeft size={15} />
          </button>
        )}

        <div className="flex-1 min-w-0">
          {subTab === 'privado' && selectedUser ? (
            <div className="flex items-center gap-2.5">
              <Avatar nombre={selectedUser.nombre} url={selectedUser.avatar_url} size={30} />
              <div>
                <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--color-text)' }}>
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
              style={{ background: 'var(--overlay-04)', border: '1px solid var(--overlay-06)' }}
            >
              {(['publico', 'privado'] as SubTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSubTab(tab)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all duration-200"
                  style={subTab === tab ? {
                    background: tab === 'publico' ? 'rgba(61,159,137,0.15)' : 'rgba(20,184,166,0.12)',
                    border: tab === 'publico' ? '1px solid rgba(61,159,137,0.25)' : '1px solid rgba(20,184,166,0.22)',
                    color: tab === 'publico' ? '#75b9aa' : '#2dd4bf',
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
              style={{ background: '#2f8f75', animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
            />
            <span className="text-xs font-semibold" style={{ color: '#2f8f75' }}>Live</span>
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [subTab, setSubTab] = useState<SubTab>('publico')
  const [selectedUser, setSelectedUser] = useState<UsuarioPublico | null>(null)

  // Marcar visita y limpiar contadores de DM no leídos
  useEffect(() => {
    if (!usuario) return
    markChatVisited(usuario.id)
  }, [usuario?.id])

  // Deep-link: ?dm=userId&from=nombre → abrir DM directo
  useEffect(() => {
    const dmId = searchParams.get('dm')
    const fromName = searchParams.get('from') ?? ''
    if (!dmId || !usuario) return

    supabase
      .from('usuarios_publicos')
      .select('id, nombre, avatar_url, rol')
      .eq('id', dmId)
      .single()
      .then(({ data }) => {
        const peer: UsuarioPublico = data
          ? (data as UsuarioPublico)
          : { id: dmId, nombre: decodeURIComponent(fromName), avatar_url: null, rol: 'alumno' }
        setSelectedUser(peer)
        setSubTab('privado')
      })
    // Limpiar params de la URL para que no persistan
    setSearchParams({}, { replace: true })
  }, []) // solo en el primer montaje

  if (!usuario) return null

  function handleSetSubTab(tab: SubTab) {
    setSubTab(tab)
    if (tab === 'publico') setSelectedUser(null)
  }

  return (
    <>
      {/* Inject keyframes once */}
      <style>{globalStyles}</style>

      <div className="flex h-full overflow-hidden" style={{ background: 'var(--color-bg)' }}>

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
            style={{ background: 'var(--color-surface-2)' }}
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
                  style={{ borderBottom: '1px solid var(--overlay-05)', background: 'var(--color-surface-2)' }}
                >
                  <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Mensajes Directos</p>
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
