import { useState } from 'react';
import Sheet from './Sheet.jsx';
import DiagramEmbed from './DiagramEmbed.jsx';
import SvgEmbed from './SvgEmbed.jsx';

const EMBEDS = { diagram: DiagramEmbed, svg: SvgEmbed };

/**
 * 그림 한 칸 — 제목 + 크게 보기 + 본체.
 *
 * 과목·블록·기록 세 화면이 같은 컴포넌트를 쓴다. 화면마다 따로 만들면 확대
 * 버튼이 한 곳에만 붙거나 아이콘이 제각각이 되는데, 그건 시간 문제일 뿐이다.
 *
 * ─ 아이콘을 인라인 SVG 로 그린 이유 ────────────────────────
 *
 * `⤢` 같은 기호 문자는 글꼴이 없는 PC에서 두부(□)가 된다. 이 앱은 글꼴을 고를
 * 수 없는 공용 PC에서도 써야 하므로, 모양을 문서에 직접 그린다.
 * (테마 전환 버튼에서 아이콘을 뺀 것과 같은 이유다)
 */
export default function FigureSection({ title, kind, code }) {
  const [zoomed, setZoomed] = useState(false);
  const Embed = EMBEDS[kind];

  if (!code?.trim()) return null;

  return (
    <section className="section figure">
      <div className="section__head">
        <h2 className="section__title">{title}</h2>
        <button
          type="button"
          className="figure__expand"
          onClick={() => setZoomed(true)}
          title={`${title} 크게 보기`}
        >
          <ExpandIcon />
          <span className="visually-hidden">{title} 크게 보기</span>
        </button>
      </div>

      <Embed code={code} />

      {/*
        확대는 같은 코드를 다시 그린다. 작은 칸의 그림을 CSS 로 늘리면
        mermaid 가 글자 크기를 맞춰 그려 둔 것이 함께 늘어나 뭉개진다.
      */}
      <Sheet open={zoomed} title={title} onClose={() => setZoomed(false)} wide>
        {zoomed && <Embed code={code} />}
      </Sheet>
    </section>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        d="M6 2H2v4M10 14h4v-4M14 6V2h-4M2 10v4h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
