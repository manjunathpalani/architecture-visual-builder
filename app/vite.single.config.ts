import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Build config for compressing the SPA into a minimal asset set
 * (one JS + one CSS + HTML), then post-processed into a single file.
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-single-build',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 10_000_000,
    modulePreload: false,
    sourcemap: false,
    // Vite 8 uses Oxc minify by default; avoid requiring esbuild for this step
    minify: true,
    target: 'es2020',
    // One offline chunk is the point of this build; the 500 kB warning is noise.
    chunkSizeWarningLimit: 5000,
    rolldownOptions: {
      output: {
        codeSplitting: false,
        entryFileNames: 'app.js',
        chunkFileNames: 'app.js',
        assetFileNames: 'app.[ext]',
      },
    },
  },
  // No API proxy in single-file artifact (static host / file open)
})
