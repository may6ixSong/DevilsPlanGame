import { card, fullDeck, shuffle, SUITS, type Card } from './cards';
import { bestPossible, evaluate } from './hand';

/**
 * 판 만들기.
 * 완전 무작위로 깔면 원페어·하이카드만 나와서 재미가 없으므로,
 * 대부분의 판에는 "공유 카드 3장 + 판 위 2장" 으로 완성되는 좋은 족보를 심어 둔다.
 * - 일부 판은 그냥 무작위 (원페어/투페어가 최고인 판도 가끔 나오게)
 * - 좋은 족보를 1개 심고, 종종 경쟁 조합(미끼)도 하나 더 심는다
 */
type Rand = () => number;
const pickOne = <T,>(arr: T[], random: Rand) => arr[Math.floor(random() * arr.length)];
const ranksFrom = (lo = 2, hi = 14) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

function distinctRanks(n: number, random: Rand, exclude: number[] = []) {
  return shuffle(ranksFrom().filter((r) => !exclude.includes(r)), random).slice(0, n);
}
const suitsN = (n: number, random: Rand) => shuffle(SUITS.split(''), random).slice(0, n);

/** 원하는 족보의 5장 만들기 */
const BUILDERS: Record<string, (random: Rand) => Card[]> = {
  royal: (random) => { const s = pickOne(SUITS.split(''), random); return [10, 11, 12, 13, 14].map((r) => card(r, s)); },
  straightFlush: (random) => {
    const s = pickOne(SUITS.split(''), random);
    const lo = 1 + Math.floor(random() * 9); // 1(A-5) ~ 9(9-K)
    return [0, 1, 2, 3, 4].map((k) => card(lo + k === 1 ? 14 : lo + k, s));
  },
  quads: (random) => {
    const [r, k] = distinctRanks(2, random);
    return [...SUITS.split('').map((s) => card(r, s)), card(k, pickOne(SUITS.split(''), random))];
  },
  fullHouse: (random) => {
    const [r1, r2] = distinctRanks(2, random);
    return [...suitsN(3, random).map((s) => card(r1, s)), ...suitsN(2, random).map((s) => card(r2, s))];
  },
  flush: (random) => {
    const s = pickOne(SUITS.split(''), random);
    for (;;) {
      const rs = distinctRanks(5, random);
      const cs = rs.map((r) => card(r, s));
      if (evaluate(cs).category === 5) return cs;
    }
  },
  straight: (random) => {
    for (;;) {
      const lo = 1 + Math.floor(random() * 10); // A-5 ~ 10-A
      const cs = [0, 1, 2, 3, 4].map((k) => card(lo + k === 1 ? 14 : lo + k, pickOne(SUITS.split(''), random)));
      if (evaluate(cs).category === 4) return cs;
    }
  },
  trips: (random) => {
    const [r, k1, k2] = distinctRanks(3, random);
    return [...suitsN(3, random).map((s) => card(r, s)), card(k1, pickOne(SUITS.split(''), random)), card(k2, pickOne(SUITS.split(''), random))];
  },
  twoPair: (random) => {
    const [r1, r2, k] = distinctRanks(3, random);
    return [...suitsN(2, random).map((s) => card(r1, s)), ...suitsN(2, random).map((s) => card(r2, s)), card(k, pickOne(SUITS.split(''), random))];
  },
};

const WEIGHTS: [string, number][] = [
  ['royal', 1], ['straightFlush', 4], ['quads', 4], ['fullHouse', 18],
  ['flush', 20], ['straight', 24], ['trips', 16], ['twoPair', 10],
];

function weighted(random: Rand) {
  let x = random() * WEIGHTS.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of WEIGHTS) { if ((x -= w) < 0) return k; }
  return 'straight';
}

export interface Deal { grid: Card[]; community: Card[]; }

export function generateDeal(size: number, random: Rand): Deal {
  const total = size * size;

  // 20%: 완전 무작위 판
  if (random() < 0.2) {
    const d = shuffle(fullDeck(), random);
    return { community: d.slice(0, 3), grid: d.slice(3, 3 + total) };
  }

  // 좋은 족보 하나를 만들어 3장은 공유 카드, 2장은 판 위에 심는다
  const target = shuffle(BUILDERS[weighted(random)](random), random);
  const community = target.slice(0, 3);
  const planted = target.slice(3);
  let rest = shuffle(fullDeck().filter((c) => !target.includes(c)), random);

  // 50%: 미끼 조합 하나 더 (투페어 이상이 되는 다른 2장)
  if (total >= 9 && random() < 0.5) {
    for (let tries = 0; tries < 300; tries++) {
      const a = rest[Math.floor(random() * rest.length)];
      const b = rest[Math.floor(random() * rest.length)];
      if (a === b) continue;
      const cat = evaluate([a, b, ...community]).category;
      if (cat >= 2) { planted.push(a, b); rest = rest.filter((c) => c !== a && c !== b); break; }
    }
  }

  const grid = shuffle([...planted, ...rest.slice(0, total - planted.length)], random);
  return { community, grid };
}

/** 개발용: 판 하나의 너트 족보 */
export const nutsOf = (d: Deal) => bestPossible(d.grid, d.community).hand.name;
