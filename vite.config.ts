import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 커스텀 도메인(blog.sanghak.kr)으로 배포하므로 base 는 '/'
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    // 기본 타깃으로 압축하면 미디어 쿼리가 `@media (width<=639px)` 범위 문법으로
    // 바뀐다. iOS 16.3 이하 사파리는 이 문법을 모르고 블록을 통째로 버린다.
    // 모바일 전용 글자 크기가 그렇게 사라져 본문이 데스크톱 크기로 나왔다.
    cssTarget: 'safari16',
  },
})
