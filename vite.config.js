import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 상대 경로로 빌드해야 dist/index.html 을 file:// 로 직접 열어도 동작한다.
  // (공용 PC에서 dev 서버 없이 바로 쓰는 경우 대비 — HashRouter 와 짝을 이룬다)
  base: './',
  server: {
    host: true, // 같은 네트워크의 휴대폰에서 접속해 터치 UI 확인용
  },
});
