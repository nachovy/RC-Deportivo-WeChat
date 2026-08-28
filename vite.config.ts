import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { articleMetaApi } from './articleMetaPlugin.ts'

export default defineConfig({
  plugins: [react(), tailwindcss(), articleMetaApi()],
  base: './',
})
