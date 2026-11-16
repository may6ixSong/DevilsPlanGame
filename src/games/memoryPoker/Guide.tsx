import { useMemo } from 'react';
import type { GameOptions } from '../types';
import { fullDeck, shuffle, type Card } from './cards';
import { CardRow, CardView } from './CardView';
import { CATEGORY_NAMES } from './hand';

/** 고정 시드 난수 → 가이드 예시가 매번 같게 보이도록 */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COMMUNITY: Card[] = ['Ks', 'Kh', '7d'];
const ME: Card[] = ['Kd', '7c'];   // → 풀하우스
const OPP: Card[] = ['Qs', 'Qh'];  // → 투페어

const HAND_EXAMPLES: [number, Card[], Card[]][] = [
  [9, ['Ts', 'Js', 'Qs', 'Ks', 'As'], ['Ts', 'Js', 'Qs', 'Ks', 'As']],
  [8, ['5h', '6h', '7h', '8h', '9h'], ['5h', '6h', '7h', '8h', '9h']],
  [7, ['9s', '9h', '9d', '9c', '2d'], ['9s', '9h', '9d', '9c']],
  [6, ['Js', 'Jh', 'Jd', '4c', '4s'], ['Js', 'Jh', 'Jd', '4c', '4s']],
  [5, ['2d', '6d', '9d', 'Jd', 'Kd'], ['2d', '6d', '9d', 'Jd', 'Kd']],
  [4, ['4s', '5h', '6d', '7c', '8s'], ['4s', '5h', '6d', '7c', '8s']],
  [3, ['8s', '8h', '8d', 'Kc', '3s'], ['8s', '8h', '8d']],
  [2, ['As', 'Ah', '6d', '6c', 'Js'], ['As', 'Ah', '6d', '6c']],
  [1, ['Qs', 'Qh', '9d', '5c', '2s'], ['Qs', 'Qh']],
  [0, ['As', 'Jh', '8d', '5c', '3s'], ['As']],
];
const HAND_DESC: Record<number, string> = {
  9: '같은 무늬의 10 · J · Q · K · A',
  8: '같은 무늬로 숫자 5장 연속',
  7: '같은 숫자 4장',
  6: '트리플 + 원페어',
  5: '같은 무늬 5장 (연속 아니어도 OK)',
  4: '숫자 5장 연속 (무늬 상관없음)',
  3: '같은 숫자 3장',
  2: '원페어 2개',
  1: '같은 숫자 2장',
  0: '아무 족보도 없음 → 가장 높은 카드로 비교',
};

export function Guide({ options }: { options: GameOptions }) {
  const size = options.size ?? 4;
  const revealSec = options.revealSec ?? 20;
  const selectSec = options.selectSec ?? 10;
  const winRounds = options.winRounds ?? 3;
  const total = size * size;

  // 예시 판: 내 카드 2장과 상대 카드 2장이 들어 있는 size x size 판
  const { grid, mePos, oppPos } = useMemo(() => {
    const rnd = seeded(size * 7919);
    const fixed = [...ME, ...OPP];
    const rest = shuffle(fullDeck().filter((c) => !fixed.includes(c) && !COMMUNITY.includes(c)), rnd).slice(0, total - fixed.length);
    const g = shuffle([...fixed, ...rest], rnd);
    return { grid: g, mePos: ME.map((c) => g.indexOf(c)), oppPos: OPP.map((c) => g.indexOf(c)) };
  }, [size, total]);

  return (
    <div className="guide">
      <section className="guide-step">
        <h4><span data-n="1" />기억하기 · {revealSec}초</h4>
        <p>{size}x{size}, 총 <b>{total}장</b>의 카드가 무작위로 펼쳐져 <b>{revealSec}초</b> 동안 공개됩니다. 카드는 중복되지 않습니다. 위치를 최대한 기억하세요.</p>
        <div className="guide-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
          {grid.map((c, i) => <CardView key={i} card={c} faceUp />)}
        </div>
      </section>

      <section className="guide-step">
        <h4><span data-n="2" />고르기 · {selectSec}초</h4>
        <p>
          카드가 모두 <b>뒤집히고</b>, 위쪽에 <b>공유 카드 3장</b>이 나타납니다. 공유 카드도 판의 카드와 겹치지 않습니다.
          기억을 더듬어 뒤집힌 카드 중 <b>2장</b>을 고르세요. <b>{selectSec}초</b> 안에 골라야 하며, 미리 다 골랐다면 바로 제출할 수 있습니다.
        </p>
        <div className="guide-community">
          <span>공유 카드</span>
          <CardRow cards={COMMUNITY} size="sm" />
        </div>
        <div className="guide-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
          {grid.map((_, i) => (
            <CardView key={i} card={null} faceUp={false} selected={mePos.includes(i)} order={mePos.includes(i) ? mePos.indexOf(i) + 1 : undefined} />
          ))}
        </div>
        <p className="guide-tip">2장을 골라 두기만 해도 시간이 끝날 때 자동으로 제출됩니다. 하지만 <b>{selectSec}초 안에 2장을 다 고르지 못하면 그 라운드는 패배</b>입니다. 둘 다 못 고르면 무승부.</p>
      </section>

      <section className="guide-step">
        <h4><span data-n="3" />공개 · 비교</h4>
        <p>두 사람이 모두 고르면 동시에 공개합니다. <b>내가 고른 2장 + 공유 카드 3장 = 5장</b>으로 족보를 비교해 높은 쪽이 라운드를 가져갑니다.</p>
        <div className="guide-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
          {grid.map((c, i) => {
            const marks = [...(mePos.includes(i) ? ['host' as const] : []), ...(oppPos.includes(i) ? ['guest' as const] : [])];
            return <CardView key={i} card={c} faceUp marks={marks} mySeat="host" dim={marks.length === 0} />;
          })}
        </div>
        <div className="guide-vs">
          <div className="mp-hand seat-host winner">
            <div className="mp-hand-head"><span className="who">나 · 승리</span><span className="hand-name">풀하우스</span></div>
            <CardRow cards={[...ME, ...COMMUNITY]} size="sm" highlight={[...ME, ...COMMUNITY]} />
          </div>
          <div className="mp-hand seat-guest">
            <div className="mp-hand-head"><span className="who">상대</span><span className="hand-name">투페어</span></div>
            <CardRow cards={[...OPP, ...COMMUNITY]} size="sm" highlight={['Qs', 'Qh', 'Ks', 'Kh']} />
          </div>
        </div>
      </section>

      <section className="guide-step">
        <h4><span data-n="4" />족보 순위</h4>
        <p>일반 포커(홀덤)와 같습니다. 위쪽일수록 강합니다.</p>
        <ol className="guide-hands">
          {HAND_EXAMPLES.map(([cat, cards, hl]) => (
            <li key={cat}>
              <div className="gh-head"><b>{CATEGORY_NAMES[cat]}</b><small>{HAND_DESC[cat]}</small></div>
              <CardRow cards={cards} size="xs" highlight={hl} />
            </li>
          ))}
        </ol>
      </section>

      <section className="guide-step">
        <h4><span data-n="5" />같은 족보일 때</h4>
        <p><b>족보를 이루는 숫자</b>가 높은 쪽 → 같으면 <b>나머지 카드</b>를 높은 순서대로 비교합니다. <b>무늬는 비교하지 않습니다.</b> A가 가장 높습니다.</p>
        <div className="guide-cmp">
          <CardRow cards={['Ks', 'Kh', 'Ad', '7c', '3s']} size="xs" highlight={['Ad']} /><b className="gt">&gt;</b><CardRow cards={['Kd', 'Kc', 'Qs', '7h', '3d']} size="xs" highlight={['Qs']} />
          <small>K 원페어끼리 → 나머지 카드 A가 Q보다 높아 왼쪽 승리</small>
        </div>
        <div className="guide-cmp">
          <CardRow cards={['2h', '9h', 'Jh', '4h', 'Kh']} size="xs" /><b className="gt">=</b><CardRow cards={['2s', '9s', 'Js', '4s', 'Ks']} size="xs" />
          <small>숫자가 완전히 같으면 무늬와 상관없이 <b>무승부</b> → 점수 없이 다음 라운드</small>
        </div>
        <div className="guide-cmp">
          <CardRow cards={['As', '2h', '3d', '4c', '5s']} size="xs" /><b className="gt">&lt;</b><CardRow cards={['2s', '3h', '4d', '5c', '6s']} size="xs" />
          <small>A-2-3-4-5도 스트레이트지만 가장 낮은 스트레이트</small>
        </div>
        <div className="guide-cmp">
          <CardRow cards={['Kd', '7c']} size="xs" /><b className="gt">=</b><CardRow cards={['Kd', '7c']} size="xs" />
          <small>두 사람이 <b>똑같은 카드 2장</b>을 고르면 무승부</small>
        </div>
      </section>

      <section className="guide-step">
        <h4><span data-n="6" />승리 조건</h4>
        <p>라운드마다 새 카드가 깔립니다. 먼저 <b>{winRounds}라운드</b>를 이기는 사람이 최종 승리합니다.</p>
      </section>
    </div>
  );
}
