import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, '../..')
  const env = loadEnv(mode, envDir, '')

  // Extraer el origen del host de Supabase desde la variable de entorno.
  // Ej: "https://xyzabc.supabase.co" → origin = "https://xyzabc.supabase.co"
  let supabaseOrigin: string | null = null
  try {
    if (env.VITE_SUPABASE_URL) {
      supabaseOrigin = new URL(env.VITE_SUPABASE_URL).origin
    }
  } catch { /* URL inválida — se omiten los hints */ }

  // Plugin que inyecta <link rel="preconnect"> en el <head> en tiempo de build.
  const preconnectPlugin = {
    name: 'vite-plugin-preconnect',
    transformIndexHtml(html: string) {
      if (!supabaseOrigin) return html
      const hints = [
        // API REST + Auth + Realtime
        `  <link rel="preconnect" href="${supabaseOrigin}" crossorigin />`,
        // Storage CDN — mismo origen, pero la petición va a /storage/v1/object
        // El DNS es idéntico, así que un solo preconnect basta.
      ].join('\n')
      return html.replace('</head>', `${hints}\n  </head>`)
    },
  }

  return {
    envDir,
    plugins: [react(), preconnectPlugin],

    resolve: {
      alias: {
        '@topcode/shared': path.resolve(__dirname, '../shared/src'),
      },
    },

    base: '/',

    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      // Separar CSS por chunk permite que las rutas lazy carguen solo
      // el CSS que necesitan, reduciendo el CSS bloqueante en el LCP.
      cssCodeSplit: true,
      chunkSizeWarningLimit: 600,

      // Polyfill de modulepreload para Firefox < 115 y Safari < 17
      modulePreload: { polyfill: true },

      rollupOptions: {
        output: {
          // Función en vez de mapa de paquetes: el mapa no capta subrutas
          // (react/jsx-runtime, scheduler) y dejaba vendor-react vacío.
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('react-router')) return 'vendor-router'
            if (id.includes('@supabase')) return 'vendor-supabase'
            if (id.includes('lucide-react')) return 'vendor-icons'
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react'
          },
        },
      },
    },

    server: {
      port: 5173,
      strictPort: false,
    },

    preview: {
      port: 4173,
      strictPort: false,
    },
  }
})
