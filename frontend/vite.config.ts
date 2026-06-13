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
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) return 'react-vendor';
          if (id.includes('node_modules/@tanstack/react-query') || id.includes('node_modules/@tanstack/react-virtual')) return 'query-vendor';
          if (id.includes('node_modules/lucide-react')) return 'ui-vendor';
          if (id.includes('node_modules/i18next') || id.includes('node_modules/zustand') || id.includes('node_modules/zod')) return 'utils-vendor';
        },

        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },

    chunkSizeWarningLimit: 500,
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

