import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

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
    plugins: [react(), preconnectPlugin],

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
          manualChunks: {
            'vendor-react':    ['react', 'react-dom'],
            'vendor-router':   ['react-router-dom'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-icons':    ['lucide-react'],
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
