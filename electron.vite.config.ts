import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { outDir: 'dist/main', lib: { entry: 'app/main.ts' } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { outDir: 'dist/preload', lib: { entry: 'app/preload.ts' } }
  },
  renderer: {
    root: 'src',
    plugins: [react()],
    build: { outDir: 'dist/renderer', rollupOptions: { input: 'src/index.html' } }
  }
})
