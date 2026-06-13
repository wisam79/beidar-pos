import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    // Enable source maps for debugging
    sourcemap: false,

    // Optimize chunk splitting
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query', '@tanstack/react-virtual'],
          'ui-vendor': ['lucide-react'],
          'utils-vendor': ['i18next', 'react-i18next', 'zustand', 'zod'],
        },

        // Asset file naming
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },

    // Chunk size warnings
    chunkSizeWarningLimit: 500,

    // Minification options
    // Minification options
    minify: 'esbuild',
    esbuild: {
      drop: ['console', 'debugger']
    }
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'zustand',
      'i18next',
      'lucide-react'
    ]
  },

  // Dev server configuration
  server: {
    strictPort: true,
  }
})

