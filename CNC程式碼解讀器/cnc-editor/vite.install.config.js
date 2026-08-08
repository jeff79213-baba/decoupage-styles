import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  build: {
    outDir: '../安裝版',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    lib: {
      entry: 'src/main.js',
      name: 'cncApp',
      formats: ['iife'],
      fileName: () => 'app.js'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        exports: 'none'
      }
    }
  }
})
