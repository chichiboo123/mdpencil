import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 배포 시 레포지토리 이름을 base로 설정해야 자산 경로가 올바르게 동작함
// GITHUB_REPOSITORY 환경변수는 'owner/repo' 형태이므로 repo 이름만 추출
const repoName = process.env.GITHUB_REPOSITORY
  ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
  : '/';

export default defineConfig({
  base: repoName,
  plugins: [react()],
  build: {
    target: 'es2020',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          tesseract: ['tesseract.js'],
          pdfjs: ['pdfjs-dist'],
        },
      },
    },
  },
});
