// Conexión a la base de datos del Supabase de TopCode desde la función de Vercel.
// JUEGOS_DATABASE_URL: cadena del «Transaction pooler» del proyecto de TopCode (Supabase → Connect).
// No se usa POSTGRES_URL de la integración Supabase-Vercel: apunta a otro proyecto.
import pg from 'pg'

// bigint (saldo) y bigint[] (días) como números normales.
pg.types.setTypeParser(20, (value) => Number(value))
pg.types.setTypeParser(1016, (value) => pg.types.arrayParser.create(value, (v) => (v === null ? null : Number(v))).parse())

let pool = null

function connectionString() {
  const url = process.env.JUEGOS_DATABASE_URL
  if (!url) throw new Error('Falta JUEGOS_DATABASE_URL')
  // El pooler de Supabase usa un certificado propio: TLS sí, pero sin validar la cadena (se quita sslmode de la URL).
  const parsed = new URL(url)
  parsed.searchParams.delete('sslmode')
  parsed.searchParams.delete('supa')
  return parsed.toString()
}

// La conexión se abre con la primera consulta (así la comprobación de salud puede informar si falta configuración).
export function createDb(config = null) {
  const getPool = () =>
    (pool ??= new pg.Pool(config ?? { connectionString: connectionString(), ssl: { rejectUnauthorized: false }, max: 2, idleTimeoutMillis: 10000 }))
  return {
    query: (sql, params) => getPool().query(sql, params),
    // Transacción: fn recibe q(sql, params) sobre la misma conexión.
    async tx(fn) {
      const client = await getPool().connect()
      try {
        await client.query('begin')
        const result = await fn((sql, params) => client.query(sql, params))
        await client.query('commit')
        return result
      } catch (error) {
        await client.query('rollback').catch(() => {})
        throw error
      } finally {
        client.release()
      }
    },
  }
}
