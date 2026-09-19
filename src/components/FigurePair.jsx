import DiagramEmbed from './DiagramEmbed.jsx';
import SvgEmbed from './SvgEmbed.jsx';

/**
 * 한 단위(과목·블록·기록)가 가진 그림 두 개 — 다이어그램이 위, SVG 가 아래.
 *
 * 순서를 컴포넌트가 정하는 이유: 세 화면에서 순서가 다르면 눈이 매번 자리를
 * 다시 찾는다. 한 곳에서 정해 두면 어긋날 수가 없다.
 *
 * 둘 다 비어 있을 때 빈 상자를 그리지는 않되 **아무것도 안 그리지도 않는다.**
 * 그러면 이 자리에 무엇이 들어올 수 있는지 알 길이 없다. 한 줄로만 남긴다.
 */
export default function FigurePair({ unit, emptyHint }) {
  const diagram = unit?.diagramCode?.trim();
  const svg = unit?.svgCode?.trim();

  if (!diagram && !svg) {
    return emptyHint ? <p className="empty empty--quiet">{emptyHint}</p> : null;
  }

  return (
    <>
      {diagram && (
        <section className="section">
          <h2 className="section__title">다이어그램</h2>
          <DiagramEmbed code={unit.diagramCode} />
        </section>
      )}
      {svg && (
        <section className="section">
          <h2 className="section__title">SVG</h2>
          <SvgEmbed code={unit.svgCode} />
        </section>
      )}
    </>
  );
}
