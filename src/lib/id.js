/**
 * 고유 id 생성.
 *
 * crypto.randomUUID() 는 보안 컨텍스트(https/localhost)에서만 제공된다.
 * 빌드 결과를 file:// 로 직접 열어 쓰는 경우를 대비해 단계적으로 폴백한다.
 */
export function newId() {
  const c = globalThis.crypto;

  if (typeof c?.randomUUID === 'function') {
    return c.randomUUID();
  }

  if (typeof c?.getRandomValues === 'function') {
    // RFC 4122 v4 형식을 직접 조립한다.
    const bytes = c.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0'));
    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join(''),
    ].join('-');
  }

  // 최후의 폴백: 암호학적 강도는 없지만 개인용 로컬 데이터에는 충분하다.
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `id-${Date.now().toString(36)}-${rand()}${rand()}`;
}
