import { useEffect, useState } from 'react';
import { newId } from '../lib/id.js';

/**
 * Mermaid 문법 텍스트를 그림으로 그린다.
 *
 * SVG 필드와 나란히 놓인 쌍둥이다. 저장은 문법 텍스트 원문 그대로 하고,
 * 화면에 그릴 때마다 mermaid.js 로 변환한다. 배치 로직을 직접 만들지 않는 이유는
 * 이 앱이 순수한 뷰어이기 때문이다 — 표준 mermaid.js 가 그리는 그림이면 충분하다.
 *
 * **지연 로딩**: mermaid 는 이 앱 전체보다 큰 라이브러리다. 첫 화면(캘린더)에서는
 * 전혀 쓰이지 않으므로 다이어그램이 실제로 있는 화면에서만 받아온다.
 * (react-markdown·DOMPurify 와 같은 이유, 같은 방식)
 *
 * **검증**: 문법 검사를 직접 만들지 않고 mermaid 자신의 파서를 쓴다.
 * mermaid.parse() 는 문법이 틀리면 예외를 던지므로, 그 예외를 그대로 받아
 * "해석할 수 없다"고 알리고 원문 메시지를 접어서 함께 보여준다.
 *
 * **정제**: mermaid 는 securityLevel 이 'loose' 가 아닐 때 자신의 출력물을
 * DOMPurify 로 한 번 정제해서 돌려준다. 그래서 여기서 또 정제하지 않는다.
 * 오히려 SVG 프로필로 다시 걸면 mermaid 가 넣은 <style> 이 잘려 나가 그림의
 * 색과 선이 전부 사라진다. (SvgEmbed 쪽은 정제되지 않은 남의 코드라 다르다)
 */
export default function DiagramEmbed({ code }) {
  const [view, setView] = useState({ status: 'idle', svg: null, detail: null });

  // 다크/라이트가 바뀌면 이미 그려 둔 그림의 색은 따라오지 않는다. 다시 그린다.
  const [themeNonce, setThemeNonce] = useState(0);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!mq?.addEventListener) return undefined;
    const bump = () => setThemeNonce((n) => n + 1);
    mq.addEventListener('change', bump);
    return () => mq.removeEventListener('change', bump);
  }, []);

  useEffect(() => {
    const source = String(code ?? '').trim();
    if (source.length === 0) {
      setView({ status: 'empty', svg: null, detail: null });
      return undefined;
    }

    let cancelled = false;
    setView({ status: 'loading', svg: null, detail: null });

    (async () => {
      // 두 단계를 따로 감싼다. 라이브러리를 못 받은 것(네트워크)과 코드가 틀린 것은
      // 사용자가 할 일이 완전히 다르므로 같은 오류로 뭉뚱그리면 안 된다.
      let mermaid;
      try {
        ({ default: mermaid } = await import('mermaid'));
      } catch {
        if (!cancelled) setView({ status: 'failed', svg: null, detail: null });
        return;
      }
      if (cancelled) return;

      try {
        mermaid.initialize(buildConfig());

        // 문법 검사를 먼저 따로 한다 — mermaid 자신의 파서가 곧 검증기다.
        await mermaid.parse(source);
        if (cancelled) return;

        // id 는 mermaid 가 CSS 선택자로도 쓰므로 콜론 같은 글자가 없어야 한다.
        const { svg } = await mermaid.render(
          `mermaid-${newId().replace(/[^a-z0-9]/gi, '')}`,
          source
        );
        if (!cancelled) setView({ status: 'ready', svg, detail: null });
      } catch (err) {
        if (!cancelled) {
          setView({ status: 'invalid', svg: null, detail: cleanupMermaidMessage(err) });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, themeNonce]);

  if (view.status === 'empty' || view.status === 'idle') return null;

  if (view.status === 'loading') {
    return <div className="svg-embed svg-embed--loading">다이어그램 불러오는 중…</div>;
  }

  if (view.status === 'failed') {
    return (
      <p className="svg-embed__error">
        다이어그램 렌더러를 불러오지 못했습니다. 새로고침해 주세요.
      </p>
    );
  }

  if (view.status === 'invalid') {
    return (
      <div className="svg-embed svg-embed--invalid">
        <p className="svg-embed__error">다이어그램 코드를 해석할 수 없습니다.</p>
        {view.detail && (
          <details className="svg-embed__detail">
            <summary>오류 내용 보기</summary>
            <pre>{view.detail}</pre>
          </details>
        )}
      </div>
    );
  }

  return (
    <div
      className="svg-embed diagram-embed"
      // mermaid 가 자체 DOMPurify 로 정제해 돌려준 결과만 들어간다 (위 주석 참고).
      dangerouslySetInnerHTML={{ __html: view.svg }}
    />
  );
}

/**
 * 앱의 색 토큰을 그대로 mermaid 에 넘긴다.
 *
 * mermaid 기본 테마를 쓰면 다이어그램만 다른 앱에서 오려 붙인 것처럼 보인다.
 * CSS 변수를 읽어 넘기면 다크·라이트 어느 쪽이든 본문과 같은 팔레트로 그려진다.
 */
function buildConfig() {
  const css = getComputedStyle(document.documentElement);
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;

  // 앱의 기본값이 다크다. 라이트는 prefers-color-scheme 로만 켜진다.
  const isDark = !window.matchMedia?.('(prefers-color-scheme: light)').matches;

  return {
    startOnLoad: false,
    securityLevel: 'strict',
    // HTML 라벨을 끄면 foreignObject 없이 순수 SVG 로 그려진다.
    // 앱 CSS 가 그림 안쪽 글자에 끼어들지 않아 결과가 예측 가능해진다.
    htmlLabels: false,
    flowchart: { htmlLabels: false, useMaxWidth: true },
    theme: 'base',
    fontFamily: v('--font', 'sans-serif'),
    themeVariables: {
      darkMode: isDark,
      background: v('--surface', '#1c1b19'),
      mainBkg: v('--surface-2', '#24231f'),
      primaryColor: v('--surface-2', '#24231f'),
      primaryTextColor: v('--text', '#f5f4ed'),
      primaryBorderColor: v('--border-strong', '#4c4941'),
      secondaryColor: v('--surface-3', '#2f2d28'),
      tertiaryColor: v('--surface', '#1c1b19'),
      nodeBorder: v('--border-strong', '#4c4941'),
      clusterBkg: v('--surface', '#1c1b19'),
      clusterBorder: v('--border', '#35332d'),
      lineColor: v('--text-faint', '#807d72'),
      textColor: v('--text', '#f5f4ed'),
      titleColor: v('--text', '#f5f4ed'),
      edgeLabelBackground: v('--surface', '#1c1b19'),
      fontSize: '14px',
    },
  };
}

/**
 * mermaid 의 오류 메시지는 줄 번호와 기대 토큰까지 들어 있어 그대로가 제일 쓸모 있다.
 * 다만 너무 길어질 수 있어 앞부분만 자른다.
 */
function cleanupMermaidMessage(err) {
  const raw = (err?.message ?? String(err ?? '')).trim();
  if (!raw) return null;
  return raw.length > 600 ? `${raw.slice(0, 600)}…` : raw;
}
