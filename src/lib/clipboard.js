/**
 * 클립보드 복사.
 *
 * navigator.clipboard 는 보안 컨텍스트(https/localhost)에서만 동작한다.
 * 빌드 결과를 file:// 로 열었거나 권한이 거부된 경우를 대비해
 * 구식 execCommand 로 한 번 더 시도하고, 그것도 실패하면 호출부가
 * "수동으로 복사하세요" 화면을 띄울 수 있도록 실패를 명확히 알린다.
 */
export async function copyText(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return { ok: false, reason: 'empty' };
  }

  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true, method: 'clipboard-api' };
    } catch {
      // 폴백으로 계속 진행
    }
  }

  if (legacyCopy(text)) {
    return { ok: true, method: 'exec-command' };
  }

  return { ok: false, reason: 'blocked' };
}

function legacyCopy(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    // 화면 밖으로 빼되 포커스는 받을 수 있게 둔다 (모바일에서 화면 튐 방지)
    ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
