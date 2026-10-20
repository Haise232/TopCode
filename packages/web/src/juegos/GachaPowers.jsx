import { GAME_NAME } from './gacha.js'

// Los seis poderes de una carta (uno por juego), plegados para no ocupar sitio.
function GachaPowers({ powers, open = false }) {
  return (
    <details className="gacha-pw" open={open}>
      <summary>✦ Poderes en 6 juegos</summary>
      <ul>
        {Object.entries(GAME_NAME).map(([game, label]) => (
          <li key={game} title={powers[game].text} className={powers[game].strong ? 'is-strong' : undefined}>
            <span>
              {label}
              {powers[game].strong && <small> ★ punto fuerte</small>}
            </span>
            <b>{powers[game].name}</b>
          </li>
        ))}
      </ul>
    </details>
  )
}

export default GachaPowers
