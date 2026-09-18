/**
 * 붙여넣은 SVG 코드의 형식 검사.
 *
 * 왜 필요한가: SVG 는 파일 업로드가 아니라 **텍스트 붙여넣기**로 들어온다.
 * claude.ai 의 답변을 긁어오다 보면 코드펜스가 함께 붙거나, 설명 문장이 앞에
 * 섞이거나, 스크롤 중간에서 잘린 조각이 들어온다. 그런 입력을 그대로 렌더하면
 * "아무것도 안 보인다" 또는 "글자만 나온다"가 되고, 원인을 알 수 없다.
 *
 * 그래서 둘을 구분한다.
 *   - blocking  : 렌더를 시도할 가치가 없는 입력 (일반 텍스트, 잘린 코드)
 *   - 경고만    : 그려지긴 하는데 짚어줄 문제 (앞에 섞인 설명, 태그 수 불일치)
 *
 * 순수 함수로 두어 브라우저 없이도 확인할 수 있게 한다. XML 문법 자체의 검사는
 * DOMParser 가 필요하므로 SvgEmbed 컴포넌트가 이어서 맡는다.
 */

import { stripCodeFence } from './structuredText.js';

/**
 * blocking 으로 취급하는 문제들. 경고는 따로 열거하지 않고 warnings 문장으로만
 * 전달한다 — 호출부가 종류별로 분기하는 곳이 없고, 늘어놓으면 죽은 상수가 된다.
 */
export const SVG_ISSUE = {
  OK: 'ok',
  EMPTY: 'empty',
  NOT_SVG: 'not-svg',
  TRUNCATED: 'truncated',
};

/**
 * @param {string} raw 붙여넣은 원문
 * @returns {{
 *   ok: boolean,          렌더를 시도해도 되는가
 *   blocking: boolean,    치명적 문제인가
 *   issue: string,        SVG_ISSUE 중 하나
 *   message: string|null, 사람이 읽을 설명
 *   warnings: string[],   그려지긴 하지만 짚어줄 문제들
 *   code: string,         코드펜스 등을 걷어낸, 렌더에 쓸 코드
 * }}
 */
export function validateSvgCode(raw) {
  const text = String(raw ?? '');
  const warnings = [];

  if (text.trim().length === 0) {
    return blocked(SVG_ISSUE.EMPTY, null, '');
  }

  // 코드펜스는 걷어내고 계속 간다 (붙여넣기에서 가장 흔한 군더더기다)
  const fenced = /^\s*```/.test(text);
  const code = fenced ? stripCodeFence(text) : text.trim();
  if (fenced) {
    warnings.push('코드펜스(```) 줄이 섞여 있어 빼고 읽었습니다.');
  }

  const opens = (code.match(/<svg\b/gi) ?? []).length;
  const closes = (code.match(/<\/svg\s*>/gi) ?? []).length;
  const selfClosing = /<svg\b[^>]*\/>/i.test(code);

  if (opens === 0) {
    return blocked(
      SVG_ISSUE.NOT_SVG,
      'SVG 코드가 아닙니다. <svg ...> 로 시작하는 코드를 그대로 붙여넣어 주세요.',
      code
    );
  }

  if (closes === 0 && !selfClosing) {
    return blocked(
      SVG_ISSUE.TRUNCATED,
      'SVG 코드가 중간에 잘린 것 같습니다. </svg> 로 닫혀 있지 않습니다.',
      code
    );
  }

  if (opens !== closes && !selfClosing) {
    warnings.push(
      `<svg> 태그 ${opens}개와 </svg> 태그 ${closes}개의 수가 맞지 않습니다. 일부가 빠졌을 수 있습니다.`
    );
  }

  // <svg 앞에 남은 글자 — 설명 문장을 함께 복사한 경우. 주석·선언은 정상이다.
  const head = code.slice(0, code.search(/<svg\b/i));
  const headLeftover = head
    .replace(/<\?xml[^>]*\?>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  if (headLeftover.length > 0) {
    warnings.push(
      `SVG 코드 앞에 다른 글자가 섞여 있습니다: "${truncate(headLeftover, 30)}" — 그림과 함께 글자로 나올 수 있습니다.`
    );
  }

  return {
    ok: true,
    blocking: false,
    issue: SVG_ISSUE.OK,
    message: null,
    warnings,
    code,
  };
}

function blocked(issue, message, code) {
  return { ok: false, blocking: true, issue, message, warnings: [], code };
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
