import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 정적 호스팅(GitHub Pages) 대비 상대 경로 빌드.
  // 저장소 하위 경로(/learning-tracker/)에 올라가도 자산을 찾는다. HashRouter 와 짝이라
  // 서버 리라이트 없이도 새로고침이 깨지지 않는다.
  // 주의: file:// 로 직접 여는 것은 지원하지 않는다 — 브라우저가 ES 모듈을 CORS 로 막는다.
  base: './',
  server: {
    host: true, // 같은 네트워크의 휴대폰에서 접속해 터치 UI 확인용
  },
});
