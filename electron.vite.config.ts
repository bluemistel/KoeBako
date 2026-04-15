import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

// Copy sql-wasm.wasm to resources for packaging
function copySqlWasm() {
  return {
    name: 'copy-sql-wasm',
    buildStart() {
      const src = resolve('node_modules/sql.js/dist/sql-wasm.wasm')
      const dest = resolve('resources/sql-wasm.wasm')
      if (!existsSync('resources')) mkdirSync('resources')
      try {
        copyFileSync(src, dest)
      } catch {
        // wasm file will be located at runtime
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['sql.js'] }), copySqlWasm()],
    build: {
      rollupOptions: {
        external: ['music-metadata']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
