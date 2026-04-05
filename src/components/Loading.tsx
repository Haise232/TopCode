import { GraduationCap } from 'lucide-react'

export default function Loading() {
  return (
    <div
      className="flex items-center justify-center h-full min-h-screen"
      style={{ background: '#0f1117' }}
    >
      <div className="flex flex-col items-center gap-8">
        {/* Logo with spinner ring */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          {/* Spinner ring */}
          <svg
            className="absolute inset-0"
            style={{ animation: 'spin-smooth 0.9s linear infinite' }}
            width="80" height="80"
            viewBox="0 0 80 80"
          >
            <circle
              cx="40" cy="40" r="36"
              fill="none"
              stroke="rgba(99,102,241,0.12)"
              strokeWidth="2"
            />
            <circle
              cx="40" cy="40" r="36"
              fill="none"
              stroke="url(#indigo-gradient)"
              strokeWidth="2.5"
              strokeDasharray="56 170"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="indigo-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0" />
                <stop offset="50%" stopColor="#6366f1" stopOpacity="1" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.6" />
              </linearGradient>
            </defs>
          </svg>

          {/* Center icon */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
            }}
          >
            <GraduationCap size={22} className="text-white" />
          </div>
        </div>

        {/* Brand */}
        <div className="flex flex-col items-center gap-2">
          <span className="font-bold text-lg" style={{ color: '#f1f5f9' }}>
            Top<span style={{ color: '#818cf8' }}>Code</span>
          </span>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: '#6366f1',
                  animation: 'dot-bounce 1.4s ease-in-out infinite',
                  animationDelay: `${i * 0.18}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin-smooth { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes dot-bounce { 0%,80%,100%{transform:scale(0.6);opacity:0.3} 40%{transform:scale(1.2);opacity:1} }
      `}</style>
    </div>
  )
}
