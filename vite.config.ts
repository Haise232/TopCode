import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// rollup-plugin-visualizer is an optional devDependency.
// It is only loaded when building with --mode analyze so that normal
// builds stay unaffected even if the package is not installed.
async function getPlugins(mode: string) {
  const plugins = [react()]
  if (mode === 'analyze') {
    try {
      const { visualizer } = await import('rollup-plugin-visualizer')
      plugins.push(
        visualizer({
          filename: 'dist/stats.html',
          open: true,
          gzipSize: true,
          brotliSize: true,
          template: 'treemap',
        }) as never,
      )
    } catch {
      console.warn('[vite] rollup-plugin-visualizer not installed — skipping bundle analysis.')
      console.warn('       Run: npm install -D rollup-plugin-visualizer')
    }
  }
  return plugins
}

export default defineConfig(async ({ mode }) => ({
  plugins: await getPlugins(mode),

  base: '/',

  // Pre-bundle heavy dependencies so Vite does not re-transform them on
  // every cold-start of the dev server.
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'lucide-react',
    ],
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    // Raise the warning threshold slightly — vendor chunks for supabase-js
    // and lucide-react legitimately exceed 500 kB before tree-shaking.
    chunkSizeWarningLimit: 700,

    rollupOptions: {
      output: {
        // Split the four heaviest dependencies into their own immutable
        // chunks so browsers can cache them independently of app code.
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
}))
