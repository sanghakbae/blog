import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 커스텀 도메인(blog.sanghak.kr)으로 배포하므로 base 는 '/'
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist' },
})
