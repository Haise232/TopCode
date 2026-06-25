import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import { Modal } from './ui'

interface AlertModalProps {
  visible: boolean
  type?: 'error' | 'success' | 'info' | 'warning'
  title: string
  message?: string
  onClose: () => void
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
}

const CONFIG = {
  error: {
    Icon: AlertCircle,
    iconColor: '#f43f5e',
    bgColor: 'rgba(244,63,94,0.1)',
    borderColor: 'rgba(244,63,94,0.2)',
    btnBg: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
    btnShadow: '0 4px 14px rgba(244,63,94,0.3)',
  },
  success: {
    Icon: CheckCircle,
    iconColor: '#10b981',
    bgColor: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(16,185,129,0.2)',
    btnBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    btnShadow: '0 4px 14px rgba(16,185,129,0.3)',
  },
  info: {
    Icon: Info,
    iconColor: '#3b82f6',
    bgColor: 'rgba(59,130,246,0.1)',
    borderColor: 'rgba(59,130,246,0.2)',
    btnBg: 'linear-gradient(135deg, #55efc4 0%, #00cec9 100%)',
    btnShadow: '0 4px 14px rgba(85,239,196,0.3)',
  },
  warning: {
    Icon: AlertTriangle,
    iconColor: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.1)',
    borderColor: 'rgba(245,158,11,0.2)',
    btnBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    btnShadow: '0 4px 14px rgba(245,158,11,0.3)',
  },
}

export default function AlertModal({
  visible, type, title, message, onClose, onConfirm, confirmLabel, confirmDestructive,
}: AlertModalProps) {
  const config = type ? CONFIG[type] : null
  const defaultBtnBg = 'linear-gradient(135deg, #55efc4 0%, #00cec9 100%)'
  const defaultBtnShadow = '0 4px 14px rgba(85,239,196,0.3)'

  return (
    <Modal open={visible} onClose={onClose}>
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200"
        style={{
          background: 'var(--overlay-06)',
          color: '#64748b',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.color = '#e2e8f0'
          el.style.background = 'var(--overlay-10)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.color = '#64748b'
          el.style.background = 'var(--overlay-06)'
        }}
        aria-label="Cerrar"
      >
        <X size={14} />
      </button>

      <div className="p-6 flex flex-col items-center gap-5 text-center">
        {/* Icon */}
        {config && (
          <div
            className="w-14 h-14 flex items-center justify-center rounded-2xl"
            style={{
              background: config.bgColor,
              border: `1px solid ${config.borderColor}`,
            }}
          >
            <config.Icon size={26} style={{ color: config.iconColor }} />
          </div>
        )}

        {/* Text */}
        <div className="flex flex-col gap-2">
          <h3 className="font-bold text-base leading-snug text-text-primary">
            {title}
          </h3>
          {message && (
            <p className="text-sm leading-relaxed max-w-[260px] mx-auto text-text-muted">
              {message}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className={`flex gap-3 px-6 pb-6 ${onConfirm ? '' : 'justify-center'}`}>
        {onConfirm ? (
          <>
            <button
              onClick={onClose}
              className="flex-1 bg-surface border border-white/[0.08] text-text-secondary font-medium rounded-xl hover:bg-surface-2 hover:text-slate-200 active:scale-[0.98] transition-all duration-200 py-2.5 text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={() => { onConfirm(); onClose() }}
              className="flex-[2] font-semibold py-2.5 text-sm text-white rounded-xl active:scale-[0.98] transition-all duration-200"
              style={{
                background: confirmDestructive
                  ? 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)'
                  : defaultBtnBg,
                boxShadow: confirmDestructive
                  ? '0 4px 14px rgba(244,63,94,0.3)'
                  : defaultBtnShadow,
              }}
            >
              {confirmLabel ?? 'Confirmar'}
            </button>
          </>
        ) : (
          <button
            onClick={onClose}
            className="font-semibold py-2.5 px-8 text-sm text-white rounded-xl active:scale-[0.98] transition-all duration-200 hover:opacity-90"
            style={{
              background: config ? config.btnBg : defaultBtnBg,
              boxShadow: config ? config.btnShadow : defaultBtnShadow,
            }}
          >
            Aceptar
          </button>
        )}
      </div>
    </Modal>
  )
}
