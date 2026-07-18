import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import os from 'os'
import fs from 'fs'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-local-images',
      configureServer(server) {
        const appData = process.env.APPDATA || 
          (process.platform === 'darwin' 
            ? path.join(os.homedir(), 'Library', 'Application Support') 
            : path.join(os.homedir(), '.config'));
            
        const imagesDir = path.join(appData, 'BeidarPOS_V3', 'images');

        server.middlewares.use('/local-image', (req, res, next) => {
          const filename = decodeURIComponent((req.url || '').split('?')[0].replace(/^\//, ''));
          const filePath = path.join(imagesDir, filename);

          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            let mime = 'application/octet-stream';
            if (ext === '.png') mime = 'image/png';
            else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
            else if (ext === '.webp') mime = 'image/webp';
            else if (ext === '.gif') mime = 'image/gif';

            res.setHeader('Content-Type', mime);
            fs.createReadStream(filePath).pipe(res);
          } else {
            next();
          }
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

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

