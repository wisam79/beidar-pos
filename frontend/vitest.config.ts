/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/setupTests.ts',
        css: true,
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        // Forks are stable with the WebView/jsdom mocks on Windows. The threads
        // pool can stall before running tests under newer Node versions.
        pool: 'forks',
        fileParallelism: false,
    },
});
