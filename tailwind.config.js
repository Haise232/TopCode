/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:           '#0f1117',
        surface:      '#1a1d27',
        'surface-2':  '#1e2130',
        card:         '#1a1d27',
        'card-hover': '#1e2130',
        input:        '#141720',
        border:       '#ffffff14',
        primary: {
          DEFAULT: '#6366f1',
          dark:    '#4f46e5',
          light:   '#818cf8',
          subtle:  'rgba(99,102,241,0.12)',
          glow:    'rgba(99,102,241,0.25)',
        },
        secondary: {
          DEFAULT: '#10b981',
          dark:    '#059669',
          light:   '#34d399',
          subtle:  'rgba(16,185,129,0.12)',
        },
        success:  '#10b981',
        error:    '#f43f5e',
        warning:  '#f59e0b',
        info:     '#3b82f6',
        'text-primary':   '#f1f5f9',
        'text-secondary': '#94a3b8',
        'text-muted':     '#64748b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'card':           '0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
        'card-hover':     '0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
        'primary':        '0 4px 16px rgba(99,102,241,0.3)',
        'primary-sm':     '0 2px 8px rgba(99,102,241,0.2)',
        'modal':          '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
        'success':        '0 4px 12px rgba(16,185,129,0.25)',
        'error':          '0 4px 12px rgba(244,63,94,0.25)',
        'warning':        '0 4px 12px rgba(245,158,11,0.25)',
        'inset-border':   'inset 0 0 0 1px rgba(255,255,255,0.06)',
      },
      backgroundImage: {
        'gradient-primary':      'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        'gradient-primary-soft': 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)',
        'gradient-secondary':    'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'gradient-surface':      'linear-gradient(180deg, #1a1d27 0%, #141720 100%)',
        'gradient-card':         'linear-gradient(145deg, #1a1d27 0%, #141720 100%)',
        'gradient-warm':         'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
        'gradient-success':      'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'gradient-error':        'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
        'gradient-warning':      'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        'gradient-info':         'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      },
      animation: {
        'fade-in':         'fade-in 0.2s ease-out',
        'slide-up':        'slide-up 0.25s ease-out',
        'scale-in':        'scale-in 0.18s ease-out',
        'scale-in-modal':  'scale-in-modal 0.22s cubic-bezier(0.16,1,0.3,1)',
        'slide-in-bottom': 'slide-in-bottom 0.3s cubic-bezier(0.16,1,0.3,1)',
        'shimmer':         'shimmer 1.8s ease-in-out infinite',
        'spin-smooth':     'spin-smooth 0.8s linear infinite',
        'pulse-soft':      'pulse-soft 2s ease-in-out infinite',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.94)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'scale-in-modal': {
          from: { opacity: '0', transform: 'scale(0.95) translateY(8px)' },
          to:   { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'slide-in-bottom': {
          from: { opacity: '0', transform: 'translateY(100%)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'spin-smooth': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0.6' },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16,1,0.3,1)',
        'smooth': 'cubic-bezier(0.4,0,0.2,1)',
      },
    },
  },
  plugins: [],
}
