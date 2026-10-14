const STAR = Array.from({ length: 10 }, (_, i) => {
  const radius = i % 2 === 0 ? 40 : 17
  const angle = (Math.PI / 5) * i
  return `${(50 + radius * Math.sin(angle)).toFixed(1)},${(52 - radius * Math.cos(angle)).toFixed(1)}`
}).join(' ')

const DRAWINGS = {
  cherry: (
    <>
      <path
        d="M34 56 C36 36 48 22 64 16 M66 60 C66 42 64 28 64 16"
        fill="none"
        stroke="#2f7d4f"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <ellipse cx="77" cy="20" rx="14" ry="7" fill="#2f9d5f" transform="rotate(20 77 20)" />
      <circle cx="33" cy="70" r="18" fill="#d8362f" />
      <circle cx="67" cy="74" r="18" fill="#c22a25" />
      <circle cx="27" cy="64" r="5" fill="#fff" opacity="0.45" />
      <circle cx="61" cy="68" r="5" fill="#fff" opacity="0.45" />
    </>
  ),
  lemon: (
    <>
      <circle cx="82.6" cy="36.8" r="6" fill="#f4cf2f" />
      <circle cx="17.4" cy="67.2" r="6" fill="#f4cf2f" />
      <ellipse cx="50" cy="52" rx="36" ry="27" fill="#f4cf2f" transform="rotate(-25 50 52)" />
      <ellipse cx="42" cy="44" rx="14" ry="6" fill="#fff" opacity="0.4" transform="rotate(-25 42 44)" />
    </>
  ),
  bell: (
    <>
      <circle cx="50" cy="80" r="9" fill="#8a6a1f" />
      <path d="M50 12 C30 12 27 40 25 60 L15 74 H85 L75 60 C73 40 70 12 50 12 Z" fill="#d9ae45" />
      <path d="M15 74 H85 L80 66 H20 Z" fill="#b38a2c" />
      <path d="M40 24 C34 32 33 44 32 56" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.4" />
    </>
  ),
  star: <polygon points={STAR} fill="#ffcf3a" stroke="#d99a12" strokeWidth="3" strokeLinejoin="round" />,
  diamond: (
    <>
      <polygon points="50,90 14,40 30,16 70,16 86,40" fill="#4fc3e6" />
      <polygon points="14,40 30,16 70,16 86,40" fill="#9be3f7" />
      <polygon points="38,40 50,16 62,40 50,90" fill="#c9f1fb" opacity="0.6" />
    </>
  ),
  wild: (
    <>
      <circle cx="50" cy="50" r="40" fill="#7b3fe4" stroke="#ffe27a" strokeWidth="5" />
      <polygon points={STAR} fill="#ffe27a" opacity="0.35" />
      <text x="50" y="61" textAnchor="middle" fontSize="30" className="symbol__wild">
        WILD
      </text>
    </>
  ),
  seven: (
    <text x="50" y="85" textAnchor="middle" fontSize="100" className="symbol__seven">
      7
    </text>
  ),
}

function SlotSymbol({ name }) {
  return (
    <svg viewBox="0 0 100 100" className="symbol" aria-hidden="true">
      {DRAWINGS[name]}
    </svg>
  )
}

export default SlotSymbol
