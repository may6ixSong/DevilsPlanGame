import { rankOf, suitOf, type Card } from './cards';

/** 족보 등급. 숫자가 클수록 강함 */
export const CATEGORY_NAMES = [
  '하이카드', '원페어', '투페어', '트리플', '스트레이트',
  '플러쉬', '풀하우스', '포카드', '스트레이트 플러쉬', '로열 스트레이트 플러쉬',
] as const;

export interface HandValue {
  category: number;
  /** 같은 족보일 때 비교할 숫자들 (족보를 이루는 숫자 → 나머지 카드 순) */
  tiebreak: number[];
  name: string;
}

/** 5장 족보 판정. 무늬는 족보(플러쉬 등) 판정에만 쓰고 비교에는 쓰지 않는다. */
export function evaluate(cards: Card[]): HandValue {
  const ranks = cards.map(rankOf).sort((a, b) => b - a);
  const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]));
  const unique = [...new Set(ranks)];
  let straightHigh = 0;
  if (unique.length === 5) {
    if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
    else if (ranks.join() === '14,5,4,3,2') straightHigh = 5; // A-2-3-4-5 (가장 낮은 스트레이트)
  }
  // 같은 숫자끼리 묶어서 (장수 많은 순 → 숫자 높은 순) 정렬
  const groups = unique
    .map((r) => ({ r, n: ranks.filter((x) => x === r).length }))
    .sort((a, b) => b.n - a.n || b.r - a.r);
  const byGroup = groups.map((g) => g.r);
  const shape = groups.map((g) => g.n).join('');

  let category: number;
  let tiebreak: number[];
  if (straightHigh && flush) { category = straightHigh === 14 ? 9 : 8; tiebreak = [straightHigh]; }
  else if (shape === '41') { category = 7; tiebreak = byGroup; }
  else if (shape === '32') { category = 6; tiebreak = byGroup; }
  else if (flush) { category = 5; tiebreak = ranks; }
  else if (straightHigh) { category = 4; tiebreak = [straightHigh]; }
  else if (shape === '311') { category = 3; tiebreak = byGroup; }
  else if (shape === '221') { category = 2; tiebreak = byGroup; }
  else if (shape === '2111') { category = 1; tiebreak = byGroup; }
  else { category = 0; tiebreak = ranks; }
  return { category, tiebreak, name: CATEGORY_NAMES[category] };
}

/** a 가 이기면 양수, 지면 음수, 완전히 같으면 0 */
export function compareHands(a: HandValue, b: HandValue): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
    const d = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** 판 위에서 만들 수 있는 가장 강한 조합(너트) */
export function bestPossible(grid: Card[], community: Card[]) {
  let best: { picks: [number, number]; hand: HandValue } | null = null;
  for (let i = 0; i < grid.length; i++) for (let j = i + 1; j < grid.length; j++) {
    const hand = evaluate([grid[i], grid[j], ...community]);
    if (!best || compareHands(hand, best.hand) > 0) best = { picks: [i, j], hand };
  }
  return best!;
}
